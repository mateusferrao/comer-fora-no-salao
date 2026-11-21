/**
 * Convite entregue de verdade (S4.4 — D155, D163, D174, D175): toda vez que nasce um convite REAL (na mesa ou na
 * reativação), o cliente recebe uma mensagem no app (Jornada › Seus convites) e, se aceitou e-mail, um e-mail
 * DEPOIS do commit (`after()` nas rotas). O grupo de controle nunca recebe nada (convite fantasma).
 * E-mail: texto simples, links só para o nosso domínio, descadastro em todo e-mail, teto diário por restaurante,
 * nada para endereços de teste; texto do dono com link ou contato vai só para o app (D174).
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Executor } from "@/src/db/executor";
import { customerContacts, customerMessages, invites, restaurantCustomers, restaurants } from "@/src/db/schema";
import type { MailSender } from "@/src/modules/contas/adapters/mail-sender";
import { slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { decryptEmail, signValue } from "@/src/shared/crypto";
import { log } from "@/src/shared/log";
import { consume } from "@/src/shared/rate-limit";
import { safeErr } from "@/src/shared/safe-err";
import { daySP } from "@/src/shared/tz";
import { hasContactInfo } from "../domain/contact-info";
import { loadContext, loadVersion } from "./context";
import { inviteMessage } from "./do-checkin";
import { PROTOTYPE_FOOTER } from "./customer-login";
import { offerView } from "./views";
import { agendaPath } from "./agenda";
import { nextValidWindow } from "../domain/invite-window";
import { emailDecision, parseEmailPrefs, type MessageKind, type SkipReason } from "../domain/email-prefs";
import { parseNotifySettings } from "@/src/modules/config/domain/notify-settings";

export { queueInviteMessages, type MessageKind } from "./queue-messages";
export const EMAILS_PER_RESTAURANT_DAY = 200;

export function unsubscribeToken(customerId: string, restaurantId: string): string {
  return signValue(`descadastro:${customerId}:${restaurantId}`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const ddmm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function inviteEmail(p: { restaurant: string; when: string; gain: string; message: string | null; untilDay: string; baseUrl: string; token: string; agendaUrl?: string | null; v2?: boolean }) {
  // S5.2 (copy_v2): assunto e 1ª linha reescritos (o quando primeiro) + "Adicionar à agenda".
  const verb = p.gain.startsWith("Leve 2") ? "e aproveite:" : "e ganhe";
  const subject = p.v2 ? `${p.restaurant} guardou ${p.gain} para você` : `Seu convite: ${p.gain} · ${p.restaurant}`;
  const first = p.v2 ? `Volte ${p.when} ${verb} ${p.gain}.` : `${p.restaurant} te convida para voltar ${p.when}: ${p.gain}.`;
  const journey = `${p.baseUrl}/app/jornada`;
  const unsub = `${p.baseUrl}/cliente/descadastrar?t=${encodeURIComponent(p.token)}`;
  const agenda = p.v2 && p.agendaUrl ? p.agendaUrl : null;
  const lines = [
    first,
    ...(p.message ? ["", `"${p.message}"`] : []),
    "",
    `Vale até ${ddmm(p.untilDay)}. Faça check-in nesse horário para receber o código.`,
    ...(agenda ? [`Adicionar à agenda: ${agenda}`] : []),
    `Ver o convite: ${journey}`,
    "",
    `Preferências de e-mail · Descadastrar: ${unsub}`,
    PROTOTYPE_FOOTER,
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#151515">
<p>${p.v2 ? `Volte ${esc(p.when)} ${verb} <strong>${esc(p.gain)}</strong>.` : `${esc(p.restaurant)} te convida para voltar ${esc(p.when)}: <strong>${esc(p.gain)}</strong>.`}</p>
${p.message ? `<p><em>“${esc(p.message)}”</em></p>` : ""}
<p>Vale até ${ddmm(p.untilDay)}. Faça check-in nesse horário para receber o código.</p>
${agenda ? `<p><a href="${esc(agenda)}">Adicionar à agenda</a></p>` : ""}
<p><a href="${esc(journey)}">Ver o convite</a></p>
<p style="color:#666;font-size:12px"><a href="${esc(unsub)}">Preferências de e-mail · Descadastrar</a><br>${PROTOTYPE_FOOTER}</p>
</div>`;
  return { subject, text: lines.join("\n"), html };
}

/** Lembrete no dia do convite (S6.1 — D189): 1 por convite, X h antes da janela. */
export function reminderEmail(p: { restaurant: string; gain: string; startMin: number; endMin: number; baseUrl: string; token: string; agendaUrl?: string | null }) {
  const hh = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
  const subject = `${p.restaurant} · hoje vale seu convite`.replace(/[\r\n]+/g, " ");
  const first = `${p.restaurant} · hoje vale seu convite: ${p.gain}, das ${hh(p.startMin)} às ${hh(p.endMin)}. Faça check-in no salão para receber o código.`;
  const journey = `${p.baseUrl}/app/jornada`;
  const prefs = `${p.baseUrl}/cliente/descadastrar?t=${encodeURIComponent(p.token)}`;
  const lines = [
    first,
    "",
    ...(p.agendaUrl ? [`Adicionar à agenda: ${p.agendaUrl}`] : []),
    `Ver o convite: ${journey}`,
    "",
    `Preferências de e-mail · Descadastrar: ${prefs}`,
    PROTOTYPE_FOOTER,
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#151515">
<p>${esc(p.restaurant)} · hoje vale seu convite: <strong>${esc(p.gain)}</strong>, das ${hh(p.startMin)} às ${hh(p.endMin)}. Faça check-in no salão para receber o código.</p>
${p.agendaUrl ? `<p><a href="${esc(p.agendaUrl)}">Adicionar à agenda</a></p>` : ""}
<p><a href="${esc(journey)}">Ver o convite</a></p>
<p style="color:#666;font-size:12px"><a href="${esc(prefs)}">Preferências de e-mail · Descadastrar</a><br>${PROTOTYPE_FOOTER}</p>
</div>`;
  return { subject, text: lines.join("\n"), html };
}

function sendable(email: string | null): email is string {
  return !!email && !email.endsWith(".invalid") && !email.endsWith("@simulator.amazonses.com");
}

/**
 * Envia os e-mails pendentes de um restaurante. Reserva as linhas (`pendente` → `enviado`) com SKIP LOCKED antes
 * de enviar: duas execuções ao mesmo tempo nunca mandam o mesmo e-mail. Falha de envio → `falhou`.
 */
export async function sendPendingInviteEmails(
  db: Db,
  p: { restaurantId: string; sender: MailSender | null; baseUrl: string; now: Date; limitPerDay?: number; inviteIds?: string[]; v2?: boolean },
): Promise<{ sent: number; skipped: number; failed: number }> {
  const out = { sent: 0, skipped: 0, failed: 0 };
  const scope = p.inviteIds?.length ? sql`and invite_id in (${sql.join(p.inviteIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``;
  const claimed = (await db.execute(sql`
    update customer_messages set email_status = 'enviado', emailed_at = ${p.now.toISOString()}
    where id in (select id from customer_messages where restaurant_id = ${p.restaurantId} and email_status = 'pendente' ${scope} order by created_at limit 50 for update skip locked)
    returning id, customer_id, invite_id, kind`)) as unknown as { rows: Array<{ id: string; customer_id: string; invite_id: string; kind: MessageKind }> };
  if (!claimed.rows.length) return out;
  const mark = (id: string, status: "pulado" | "falhou", reason: SkipReason | null = null) => db.update(customerMessages).set({ emailStatus: status, emailSkipReason: reason }).where(eq(customerMessages.id, id));
  const ctx = await loadContext(db, p.restaurantId);
  const [rs] = await db.select({ s: restaurants.notifySettings }).from(restaurants).where(eq(restaurants.id, p.restaurantId));
  const ownerEmails = parseNotifySettings(rs?.s).emails;
  for (const m of claimed.rows) {
    const [contact] = await db.select({ enc: customerContacts.emailEnc }).from(customerContacts).where(eq(customerContacts.customerId, m.customer_id));
    const [inv] = await db.select().from(invites).where(eq(invites.id, m.invite_id));
    const [rc] = await db
      .select({ optEmail: restaurantCustomers.optEmail, prefs: restaurantCustomers.emailPrefs })
      .from(restaurantCustomers)
      .where(and(eq(restaurantCustomers.restaurantId, p.restaurantId), eq(restaurantCustomers.customerId, m.customer_id)));
    const email = decryptEmail(contact?.enc);
    // S6 (revisão técnica): reconfere as preferências na hora do envio — o que estava pendente não sai se alguém desligou.
    const now = emailDecision({ kind: m.kind, hasEmail: !!email, optEmail: rc?.optEmail ?? false, prefs: parseEmailPrefs(rc?.prefs), owner: ownerEmails });
    if (now.status === "pulado") {
      await mark(m.id, "pulado", now.reason);
      out.skipped++;
      continue;
    }
    if (!ctx || !inv || !sendable(email) || !p.sender) {
      await mark(m.id, "pulado", !p.sender ? "sem_envio" : "sem_email");
      out.skipped++;
      continue;
    }
    const version = await loadVersion(db, inv.benefitVersionId);
    const slot = inv.slotSnapshot as Slot;
    const gain = offerView(version?.offer, ctx.menu, "convite")?.gain;
    const message = inviteMessage(version, slot, ctx, gain);
    if (!gain || (message && hasContactInfo(message))) {
      await mark(m.id, "pulado", !gain ? "sem_oferta" : "contato_no_texto");
      out.skipped++;
      continue;
    }
    const lim = await consume(db, `emails:restaurante:${p.restaurantId}:${daySP(p.now)}`, p.limitPerDay ?? EMAILS_PER_RESTAURANT_DAY, 86_400, p.now);
    if (!lim.ok) {
      await mark(m.id, "pulado", "teto_diario");
      out.skipped++;
      continue;
    }
    const agendaUrl = nextValidWindow({ slot, issuedDay: inv.issuedDay, expiresAt: inv.expiresAt, now: p.now }) ? `${p.baseUrl}${agendaPath(inv.id)}` : null;
    const token = unsubscribeToken(m.customer_id, p.restaurantId);
    try {
      if (m.kind === "lembrete") {
        await p.sender.send({ to: email, ...reminderEmail({ restaurant: ctx.restaurant.name, gain, startMin: slot.startMin, endMin: slot.endMin, baseUrl: p.baseUrl, token, agendaUrl: p.v2 ? agendaUrl : null }) });
        out.sent++;
        continue;
      }
      await p.sender.send({
        to: email,
        ...inviteEmail({
          restaurant: ctx.restaurant.name,
          when: slotPhrase(slot),
          gain,
          message,
          untilDay: daySP(inv.expiresAt),
          baseUrl: p.baseUrl,
          token,
          v2: p.v2,
          agendaUrl,
        }),
      });
      out.sent++;
    } catch (err) {
      log.error("falha no envio do convite", { area: "convite_email", err: safeErr(err) });
      await mark(m.id, "falhou");
      out.failed++;
    }
  }
  return out;
}

export type CustomerMessageView = { id: string; kind: string; restaurantName: string; slug: string; createdAt: string; unread: boolean };

export async function listCustomerMessages(ex: Executor, customerId: string): Promise<CustomerMessageView[]> {
  const rows = await ex
    .select({ id: customerMessages.id, kind: customerMessages.kind, createdAt: customerMessages.createdAt, readAt: customerMessages.readAt, name: restaurants.name, slug: restaurants.slug })
    .from(customerMessages)
    .innerJoin(restaurants, eq(restaurants.id, customerMessages.restaurantId))
    // O lembrete (S6.1) vai só por e-mail: a Jornada já mostra "Seu convite vale hoje" (S5).
    .where(and(eq(customerMessages.customerId, customerId), sql`${customerMessages.kind} <> 'lembrete'`))
    .orderBy(desc(customerMessages.createdAt))
    .limit(20);
  return rows.map((r) => ({ id: r.id, kind: r.kind, restaurantName: r.name, slug: r.slug, createdAt: r.createdAt.toISOString(), unread: r.readAt === null }));
}

export async function markMessagesRead(ex: Executor, customerId: string, now: Date): Promise<void> {
  await ex.update(customerMessages).set({ readAt: now }).where(and(eq(customerMessages.customerId, customerId), isNull(customerMessages.readAt)));
}

/** Descadastro pelo link do e-mail (token assinado, confirmado por POST): desliga só o e-mail daquele restaurante. */
export async function unsubscribe(ex: Executor, p: { customerId: string; restaurantId: string }): Promise<void> {
  await ex.update(restaurantCustomers).set({ optEmail: false }).where(and(eq(restaurantCustomers.customerId, p.customerId), eq(restaurantCustomers.restaurantId, p.restaurantId)));
  await ex.update(customerMessages).set({ emailStatus: "pulado" }).where(and(eq(customerMessages.customerId, p.customerId), eq(customerMessages.restaurantId, p.restaurantId), inArray(customerMessages.emailStatus, ["pendente"])));
}
