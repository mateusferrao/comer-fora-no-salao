/**
 * Central de preferências do cliente (S6.1 — D198): por restaurante, "E-mail" (chave-mestra, `opt_email`) com
 * "Convites" (mesa + convite de volta) e "Lembretes" abaixo, e "Convites de volta no app" (`opt_app` — o
 * consentimento da reativação no app, `hasOptIn`). Desligar um tipo pula o que estava pendente daquele tipo.
 * Usada na Jornada (sessão do cliente) e no link do e-mail (token assinado `descadastro:<cliente>:<restaurante>`).
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { customerMessages, restaurantCustomers, restaurants } from "@/src/db/schema";
import { verifySigned } from "@/src/shared/crypto";
import { parseEmailPrefs, type EmailPrefs } from "../domain/email-prefs";

export type CustomerPrefs = { restaurantId: string; restaurant: string; email: boolean; convites: boolean; lembretes: boolean; app: boolean };
export type PrefsPatch = { email?: boolean; convites?: boolean; lembretes?: boolean; app?: boolean };

export function prefsTarget(token: string | null | undefined): { customerId: string; restaurantId: string } | null {
  const v = verifySigned(token);
  const m = v ? /^descadastro:([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(v) : null;
  return m ? { customerId: m[1]!, restaurantId: m[2]! } : null;
}

export async function listCustomerPrefs(ex: Executor, customerId: string, restaurantId?: string): Promise<CustomerPrefs[]> {
  const rows = await ex
    .select({ restaurantId: restaurantCustomers.restaurantId, name: restaurants.name, optEmail: restaurantCustomers.optEmail, optApp: restaurantCustomers.optApp, prefs: restaurantCustomers.emailPrefs })
    .from(restaurantCustomers)
    .innerJoin(restaurants, eq(restaurants.id, restaurantCustomers.restaurantId))
    .where(and(eq(restaurantCustomers.customerId, customerId), restaurantId ? eq(restaurantCustomers.restaurantId, restaurantId) : sql`true`))
    .orderBy(asc(restaurants.name))
    .limit(50);
  return rows.map((r) => {
    const p = parseEmailPrefs(r.prefs);
    return { restaurantId: r.restaurantId, restaurant: r.name, email: r.optEmail, convites: p.convites, lembretes: p.lembretes, app: r.optApp };
  });
}

/** Pelo link do e-mail (não expira, pode ser encaminhado), só desligar: ligar é consentir e exige a sessão (revisão S4–S6). */
export function linkPatchAllowed(patch: PrefsPatch): boolean {
  return !Object.values(patch).some((v) => v === true);
}

export async function setCustomerPrefs(ex: Executor, p: { customerId: string; restaurantId: string; patch: PrefsPatch }): Promise<CustomerPrefs | null> {
  const [cur] = await listCustomerPrefs(ex, p.customerId, p.restaurantId);
  if (!cur) return null;
  const next = { ...cur, ...Object.fromEntries(Object.entries(p.patch).filter(([, v]) => typeof v === "boolean")) } as CustomerPrefs;
  const prefs: EmailPrefs = { convites: next.convites, lembretes: next.lembretes };
  await ex
    .update(restaurantCustomers)
    .set({ optEmail: next.email, optApp: next.app, emailPrefs: prefs })
    .where(and(eq(restaurantCustomers.customerId, p.customerId), eq(restaurantCustomers.restaurantId, p.restaurantId)));
  const off: string[] = [];
  if (!next.email) off.push("convite_mesa", "reativacao", "lembrete");
  else {
    if (!next.convites) off.push("convite_mesa", "reativacao");
    if (!next.lembretes) off.push("lembrete");
  }
  if (off.length)
    await ex
      .update(customerMessages)
      .set({ emailStatus: "pulado", emailSkipReason: "cliente_desligou" })
      .where(and(eq(customerMessages.customerId, p.customerId), eq(customerMessages.restaurantId, p.restaurantId), eq(customerMessages.emailStatus, "pendente"), inArray(customerMessages.kind, off)));
  return next;
}
