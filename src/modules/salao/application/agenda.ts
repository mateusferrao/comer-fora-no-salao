/**
 * "Adicionar à agenda" (S5.2, D185): link assinado do `.ics` de um convite REAL. O token leva o id assinado
 * (`agenda:<uuid>`); a rota confere arm, status, validade e janela e responde o mesmo 404 em qualquer falha —
 * o grupo de controle nunca recebe link nem descobre o convite fantasma.
 */
import { and, eq } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { invites, restaurants } from "@/src/db/schema";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { signValue, verifySigned } from "@/src/shared/crypto";
import { inviteIcs } from "../domain/ics";
import { nextValidWindow } from "../domain/invite-window";
import { loadContext, loadVersion } from "./context";
import { offerView } from "./views";

export function agendaToken(inviteId: string): string {
  return signValue(`agenda:${inviteId}`);
}

export function agendaPath(inviteId: string): string {
  return `/api/convite/agenda?t=${encodeURIComponent(agendaToken(inviteId))}`;
}

/** `.ics` do convite pelo token, ou null (token inválido, fantasma, usado/vencido, sem janela pela frente). */
export async function inviteCalendar(ex: Executor, p: { token: string | null; now: Date; baseUrl: string }): Promise<{ filename: string; body: string } | null> {
  const v = verifySigned(p.token);
  const m = v ? /^agenda:([0-9a-f-]{36})$/.exec(v) : null;
  if (!m) return null;
  const [inv] = await ex
    .select()
    .from(invites)
    .where(and(eq(invites.id, m[1]!), eq(invites.arm, "convidavel"), eq(invites.status, "ativo")))
    .limit(1);
  if (!inv || inv.expiresAt.getTime() <= p.now.getTime()) return null;
  const win = nextValidWindow({ slot: inv.slotSnapshot as Slot, issuedDay: inv.issuedDay, expiresAt: inv.expiresAt, now: p.now });
  if (!win) return null;
  const [r] = await ex.select({ name: restaurants.name, address: restaurants.address, slug: restaurants.slug }).from(restaurants).where(eq(restaurants.id, inv.restaurantId));
  const ctx = await loadContext(ex, inv.restaurantId);
  if (!r || !ctx) return null;
  const gain = offerView((await loadVersion(ex, inv.benefitVersionId))?.offer, ctx.menu, "convite")?.gain ?? "Seu convite";
  return {
    filename: `convite-${r.slug}.ics`,
    body: inviteIcs({ uid: `${inv.id}@comer-fora-no-salao`, restaurant: r.name, address: r.address, gain, window: win, journeyUrl: `${p.baseUrl}/app/jornada`, now: p.now }),
  };
}
