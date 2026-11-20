/**
 * Validar código (espec. 3.3; D27): o garçom digita, o sistema reconhece o tipo e mostra cliente (fictício,
 * mascarado), item e condições; "Confirmar" vale uma vez (idempotente pela chave). Código de outro dono
 * nunca é revelado (revisão T-m: `OUTRO_RESTAURANTE` só entre lojas do mesmo dono).
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Executor } from "@/src/db/executor";
import { codes, customerContacts, invites, menuItems, restaurants } from "@/src/db/schema";
import { checkCode, isCodeFormat, normalizeCode, type CodeType } from "@/src/modules/beneficios/domain/codes";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { slotLabel } from "@/src/modules/beneficios/domain/slot-text";
import { daySP, TZ_SP } from "@/src/shared/tz";
import { loadVersion } from "./context";
import { describeOffer } from "@/src/modules/beneficios/domain/offers";

export type CodeDetails = { code: string; type: CodeType; typeLabel: string; customer: string; phone: string; item: string; title: string; conditions: string };
export type CodeLookup =
  | ({ status: "OK" } & CodeDetails)
  | ({ status: "JA_USADO"; validatedAt: string } & CodeDetails)
  | ({ status: "VALIDADO"; validatedAt: string } & CodeDetails)
  | { status: "INVALIDO" | "EXPIRADO" | "OUTRO_RESTAURANTE"; code: string };

const TYPE_LABEL: Record<CodeType, string> = { primeira_visita: "1ª visita", convite: "Convite", recompensa: "Recompensa da cartela" };
const hhmm = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ_SP, hour: "2-digit", minute: "2-digit" }).format(d);
const ddmm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** "Ana Souza" → "Ana S." (só primeiro nome + inicial — nada de PII inteira na tela do salão). */
export function shortName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Cliente";
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]!.toUpperCase()}.` : parts[0]!;
}

type CodeRow = typeof codes.$inferSelect;

async function details(ex: Executor, row: CodeRow): Promise<CodeDetails> {
  const [contact] = await ex.select({ name: customerContacts.name, last4: customerContacts.phoneLast4 }).from(customerContacts).where(eq(customerContacts.customerId, row.customerId));
  const [item] = row.itemId ? await ex.select({ name: menuItems.name, category: menuItems.category, id: menuItems.id, priceCents: menuItems.priceCents }).from(menuItems).where(eq(menuItems.id, row.itemId)) : [];
  const version = await loadVersion(ex, row.benefitVersionId);
  const menu = item ? [{ id: item.id, name: item.name, category: item.category as never, priceCents: item.priceCents }] : [];
  const title = version ? describeOffer(version.offer, menu, row.type === "primeira_visita" ? "agora" : (row.type as "convite" | "recompensa")).gain : (item?.name ?? "Benefício");
  let conditions = `${TYPE_LABEL[row.type as CodeType]} · vale hoje`;
  if (row.type === "convite" && row.inviteId) {
    const [inv] = await ex.select({ slot: invites.slotSnapshot, expiresAt: invites.expiresAt, testValidDay: invites.testValidDay }).from(invites).where(eq(invites.id, row.inviteId));
    if (inv) conditions = `Convite · válido ${slotLabel(inv.slot as Slot)} · até ${ddmm(daySP(inv.expiresAt))}${inv.testValidDay === row.validDay ? " · Só no teste: liberado hoje, fora do horário" : ""}`;
  }
  if (row.type === "recompensa") conditions = "Recompensa da cartela (6 selos) · vale hoje";
  return {
    code: row.code,
    type: row.type as CodeType,
    typeLabel: TYPE_LABEL[row.type as CodeType],
    customer: shortName(contact?.name),
    phone: contact?.last4 ? `(••) •••••-${contact.last4}` : "",
    item: item?.name ?? "",
    title,
    conditions,
  };
}

export async function lookupCode(ex: Executor, p: { ownerId: string; restaurantId: string; raw: string; now: Date }): Promise<CodeLookup> {
  const code = normalizeCode(p.raw);
  if (!isCodeFormat(code)) return { status: "INVALIDO", code };
  const [row] = await ex.select().from(codes).where(and(eq(codes.restaurantId, p.restaurantId), eq(codes.code, code)));
  if (!row) {
    const [other] = await ex
      .select({ id: codes.id })
      .from(codes)
      .innerJoin(restaurants, eq(restaurants.id, codes.restaurantId))
      .where(and(eq(codes.code, code), eq(restaurants.ownerId, p.ownerId)))
      .limit(1);
    return { status: other ? "OUTRO_RESTAURANTE" : "INVALIDO", code };
  }
  const st = checkCode({ restaurantId: row.restaurantId, status: row.status as "emitido" | "validado", validDay: row.validDay }, { restaurantId: p.restaurantId, now: p.now });
  if (st === "EXPIRADO" || st === "INVALIDO" || st === "OUTRO_RESTAURANTE") return { status: st, code };
  const d = await details(ex, row);
  return st === "JA_USADO" ? { status: "JA_USADO", validatedAt: row.validatedAt ? hhmm(row.validatedAt) : "", ...d } : { status: "OK", ...d };
}

/** Confirma uma vez: `FOR UPDATE` no código; a mesma chave devolve o mesmo resultado; convite → `usado`. */
export async function confirmCode(db: Db, p: { restaurantId: string; raw: string; idempotencyKey: string; now: Date }): Promise<CodeLookup> {
  const code = normalizeCode(p.raw);
  if (!isCodeFormat(code)) return { status: "INVALIDO", code };
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(codes).where(and(eq(codes.restaurantId, p.restaurantId), eq(codes.code, code))).for("update");
    if (!row) return { status: "INVALIDO" as const, code };
    if (row.status === "validado") {
      const d = await details(tx, row);
      const at = row.validatedAt ? hhmm(row.validatedAt) : "";
      return row.validationKey === p.idempotencyKey ? { status: "VALIDADO" as const, validatedAt: at, ...d } : { status: "JA_USADO" as const, validatedAt: at, ...d };
    }
    if (row.validDay < daySP(p.now)) return { status: "EXPIRADO" as const, code };
    await tx.update(codes).set({ status: "validado", validatedAt: p.now, validationKey: p.idempotencyKey }).where(eq(codes.id, row.id));
    if (row.type === "convite" && row.inviteId) await tx.update(invites).set({ status: "usado", usedAt: p.now }).where(eq(invites.id, row.inviteId));
    const d = await details(tx, row);
    return { status: "VALIDADO" as const, validatedAt: hhmm(p.now), ...d };
  });
}
