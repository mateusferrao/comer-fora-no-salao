/**
 * Passos 2 e 3 do assistente (espec. 3.2): salão + horários vazios e revisão do cardápio. Retomável
 * (`restaurants.onboarding_step`) e com entrada/conclusão de cada passo registrada (abandono — H5).
 */
import { slugify } from "@/src/shared/slug";
import { randomSuffix } from "@/src/shared/random";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/src/db/client";
import type { Executor } from "@/src/db/executor";
import { idleSlots, kitPieces, menuExtractions, menuItems, menus, onboardingEvents, ownerEdits, restaurants } from "@/src/db/schema";
import { MENU_CATEGORIES } from "@/src/modules/beneficios/domain/menu";
import { INTENSITIES, openingBlockSchema, validateSlot, type SlotError } from "@/src/modules/beneficios/domain/slots";
import { cleanItemName, PRICE_BANDS } from "../domain/menu-extraction";
import { dishNameProblem, restaurantNameProblem } from "../domain/safe-name";

export async function recordStep(ex: Executor, restaurantId: string, step: number, event: "entrou" | "concluiu", now: Date): Promise<void> {
  await ex.insert(onboardingEvents).values({ restaurantId, step, event, at: now });
  if (event === "concluiu") {
    const [r] = await ex.select({ s: restaurants.onboardingStep }).from(restaurants).where(eq(restaurants.id, restaurantId));
    if ((r?.s ?? 1) < step + 1) await ex.update(restaurants).set({ onboardingStep: step + 1 }).where(eq(restaurants.id, restaurantId));
  }
}

export const salonInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  tables: z.number().int().min(1).max(500),
  weeklyCustomers: z.number().int().min(0).max(100_000).nullable(),
  opening: z.array(openingBlockSchema).min(1).max(7),
  slots: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        days: z.array(z.number().int().min(0).max(6)).min(1),
        startMin: z.number().int().min(0).max(1440),
        endMin: z.number().int().min(0).max(1440),
        intensity: z.enum(INTENSITIES),
        extraTables: z.number().int().min(1).max(200),
      }),
    )
    .min(1)
    .max(4),
  ticketCents: z.number().int().min(100).max(1_000_000).nullable(),
  marginPct: z.number().int().min(1).max(95).nullable(),
});
export type SalonInput = z.infer<typeof salonInputSchema>;

export type SaveSalonResult = { ok: true; slotIds: string[] } | { ok: false; erro: "faixas"; slotErrors: SlotError[][] } | { ok: false; erro: "nome_marca" | "nome_contato" };

export async function saveSalon(db: Db, restaurantId: string, input: SalonInput, now: Date): Promise<SaveSalonResult> {
  // S9 (M1): o nome vai no assunto e no corpo dos e-mails; sem contato e sem a marca iFood.
  const nameProblem = restaurantNameProblem(input.name);
  if (nameProblem) return { ok: false, erro: nameProblem };
  const slotErrors = input.slots.map((s) => validateSlot({ id: s.id ?? "nova", ...s }, input.opening));
  if (slotErrors.some((e) => e.length)) return { ok: false, erro: "faixas", slotErrors };
  return db.transaction(async (tx) => {
    await tx
      .update(restaurants)
      .set({ name: input.name, tables: input.tables, weeklyCustomers: input.weeklyCustomers, openingHours: input.opening, ticketCents: input.ticketCents, marginPct: input.marginPct })
      .where(eq(restaurants.id, restaurantId));
    // S4 §4.4 (revisão técnica): slug pelo nome enquanto não há kit (o QR impresso leva o slug; depois, congela).
    const hasKit = await tx.select({ id: kitPieces.id }).from(kitPieces).where(eq(kitPieces.restaurantId, restaurantId)).limit(1);
    if (!hasKit.length) {
      await tx
        .update(restaurants)
        .set({ slug: `${slugify(input.name)}-${randomSuffix(4)}` })
        .where(and(eq(restaurants.id, restaurantId), eq(restaurants.kind, "teste"), eq(restaurants.protected, false)));
    }
    const keep: string[] = [];
    for (const [i, s] of input.slots.entries()) {
      const values = { days: s.days, startMin: s.startMin, endMin: s.endMin, intensity: s.intensity, extraTables: s.extraTables, position: i, active: true };
      if (s.id) {
        const upd = await tx.update(idleSlots).set(values).where(and(eq(idleSlots.id, s.id), eq(idleSlots.restaurantId, restaurantId))).returning({ id: idleSlots.id });
        if (upd[0]) {
          keep.push(upd[0].id);
          continue;
        }
      }
      const [row] = await tx.insert(idleSlots).values({ restaurantId, ...values, createdAt: now }).returning({ id: idleSlots.id });
      keep.push(row!.id);
    }
    // Faixas removidas ficam inativas (convites guardam o snapshot — D218).
    await tx
      .update(idleSlots)
      .set({ active: false })
      .where(keep.length ? and(eq(idleSlots.restaurantId, restaurantId), notInArray(idleSlots.id, keep)) : eq(idleSlots.restaurantId, restaurantId));
    await recordStep(tx, restaurantId, 2, "concluiu", now);
    return { ok: true as const, slotIds: keep };
  });
}

export const menuInputSchema = z.object({
  items: z
    .array(z.object({ categoria: z.enum(MENU_CATEGORIES), nome: z.string().max(120), precoCentavos: z.number().int().min(0).max(1_000_000) }))
    .min(1)
    .max(80),
  cuisine: z.string().max(60).nullable(),
  priceBand: z.enum(PRICE_BANDS).nullable(),
  extractionId: z.string().uuid().nullable(),
});
export type MenuInput = z.infer<typeof menuInputSchema>;

/** Grava o cardápio revisado (só antes de ativar; depois, pelas Configurações). Registra a edição do dono. */
export async function saveMenu(db: Db, restaurantId: string, input: MenuInput, now: Date): Promise<{ ok: true; count: number } | { ok: false; erro: "ja_ativo" | "vazio" | "item_contato" | "item_marca" }> {
  const items = input.items.map((i) => ({ ...i, nome: cleanItemName(i.nome) })).filter((i) => i.nome);
  if (!items.length) return { ok: false, erro: "vazio" };
  // S9 (M1): o nome do prato vai nos e-mails do convite; com contato ou a marca iFood, o cardápio não grava.
  const dishProblem = items.map((i) => dishNameProblem(i.nome)).find((x) => x !== null);
  if (dishProblem) return { ok: false, erro: dishProblem };
  return db.transaction(async (tx) => {
    const [r] = await tx.select({ status: restaurants.status }).from(restaurants).where(eq(restaurants.id, restaurantId)).for("update");
    if (r?.status === "ativo") return { ok: false as const, erro: "ja_ativo" as const };
    let source = "manual";
    let suggested: unknown = null;
    if (input.extractionId) {
      const [ext] = await tx.select().from(menuExtractions).where(and(eq(menuExtractions.id, input.extractionId), eq(menuExtractions.restaurantId, restaurantId)));
      if (ext) {
        source = ext.source;
        suggested = ext.result;
      }
    }
    const old = await tx.select({ id: menus.id }).from(menus).where(eq(menus.restaurantId, restaurantId));
    if (old.length) await tx.delete(menus).where(inArray(menus.id, old.map((m) => m.id)));
    const [menu] = await tx.insert(menus).values({ restaurantId, source, createdAt: now }).returning({ id: menus.id });
    await tx.insert(menuItems).values(items.map((i, pos) => ({ menuId: menu!.id, restaurantId, category: i.categoria, name: i.nome, priceCents: i.precoCentavos, position: pos })));
    await tx.update(restaurants).set({ cuisine: input.cuisine?.trim() || null, priceBand: input.priceBand }).where(eq(restaurants.id, restaurantId));
    const sugg = suggested as { itens?: Array<{ categoria: string; nome: string; precoCentavos: number }>; culinaria?: string | null; faixaPreco?: string | null } | null;
    const same =
      !!sugg?.itens &&
      sugg.itens.length === items.length &&
      sugg.itens.every((s, k) => s.nome === items[k]!.nome && s.precoCentavos === items[k]!.precoCentavos && s.categoria === items[k]!.categoria);
    if (sugg) {
      await tx.insert(ownerEdits).values({
        restaurantId,
        kind: "cardapio",
        ref: input.extractionId,
        suggested: { itens: sugg.itens ?? [], culinaria: sugg.culinaria ?? null, faixaPreco: sugg.faixaPreco ?? null },
        final: { itens: items, culinaria: input.cuisine, faixaPreco: input.priceBand, semEdicao: same },
        at: now,
      });
    }
    await recordStep(tx, restaurantId, 3, "concluiu", now);
    return { ok: true as const, count: items.length };
  });
}
