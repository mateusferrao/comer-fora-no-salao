/**
 * Um tique do agendador (S6.1 — D187, D189, D196): por restaurante ativo com dono de e-mail real,
 * (1) gera o plano da semana a partir de T − 30 min, se não houver proposta nem aprovação recente;
 * (2) manda o resumo a partir de T (espera até 15 min o plano sair de "gerando"); recuperação até T + 24 h;
 * (3) enfileira os lembretes devidos e dispara o envio (antes das gerações; até 2 gerações por tique).
 * Idempotente: reservas no banco (`weekly_digests`, índice único do lembrete, estado `gerando`). Sem advisory lock de
 * sessão (revisão técnica I1). `scope`: "Rodar o ciclo agora neste restaurante" (Ferramentas do avaliador) — ignora
 * o horário e só toca o restaurante dado.
 */
import { and, eq, gt, isNotNull, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { owners, restaurants, weeklyPlans } from "@/src/db/schema";
import { parseNotifySettings } from "@/src/modules/config/domain/notify-settings";
import { queueDueReminders } from "@/src/modules/salao/application/reminders";
import { sendDigestNow, sendWeeklyDigest } from "@/src/modules/planos/application/digest";
import { GENERATING_STALE_MS } from "@/src/modules/planos/application/generating";
import type { MailSender } from "@/src/modules/contas/adapters/mail-sender";
import { log } from "@/src/shared/log";
import { safeErr } from "@/src/shared/safe-err";
import { digestDue, planDue } from "../domain/schedule";

export const DIGEST_WAIT_MS = 15 * 60_000;
/** Aprovação que vale para a semana de T: feita a partir de T − 72 h (sábado antes de um resumo de segunda). */
const APPROVAL_BEFORE_T_MS = 72 * 3_600_000;
const RECENT_PROPOSAL_MS = 7 * 86_400_000;
/** Gerações por tique (revisão S4–S6, técnica M2): o resto fica para os próximos tiques (a janela vai até T + 24 h). */
export const MAX_GENERATIONS_PER_TICK = 2;

export type TickDeps = {
  sender: MailSender | null;
  baseUrl: string;
  flags: { agendador: boolean; resumo_email: boolean };
  /** Gera o plano (a rota passa `generateWeeklyPlan` com o gateway certo; o teste passa um falso). */
  generatePlan: (p: { restaurantId: string; ownerId: string; now: Date }) => Promise<unknown>;
  /** Envia os e-mails pendentes dos convites dados (depois das transações). */
  sendPending: (restaurantId: string, inviteIds: string[]) => Promise<unknown>;
  /** SIGTERM: o tique para entre restaurantes. */
  stopped?: () => boolean;
};
export type TickResult = { planos: number; resumos: { enviados: number; falhas: number }; lembretes: number };

/**
 * Precisa de plano novo? Não, se há proposta recente (até 7 dias), geração em andamento ou plano aprovado para a
 * semana de T (aprovado a partir de T − 72 h). Ancorar em T, não em "agora" (revisão S4–S6, técnica A1): uma
 * aprovação na quarta não pode pular a semana seguinte.
 */
export async function needsPlan(db: Db, restaurantId: string, now: Date, anchor: Date = now): Promise<boolean> {
  const [x] = await db
    .select({ id: weeklyPlans.id })
    .from(weeklyPlans)
    .where(
      and(
        eq(weeklyPlans.restaurantId, restaurantId),
        or(
          and(eq(weeklyPlans.status, "proposto"), gt(weeklyPlans.createdAt, new Date(now.getTime() - RECENT_PROPOSAL_MS))),
          and(eq(weeklyPlans.status, "aprovado"), isNotNull(weeklyPlans.approvedAt), gt(weeklyPlans.approvedAt, new Date(anchor.getTime() - APPROVAL_BEFORE_T_MS))),
          and(eq(weeklyPlans.status, "gerando"), gt(weeklyPlans.createdAt, new Date(now.getTime() - GENERATING_STALE_MS))),
        ),
      ),
    )
    .limit(1);
  return !x;
}

async function generating(db: Db, restaurantId: string, now: Date): Promise<boolean> {
  const [x] = await db
    .select({ id: weeklyPlans.id })
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.restaurantId, restaurantId), eq(weeklyPlans.status, "gerando"), gt(weeklyPlans.createdAt, new Date(now.getTime() - GENERATING_STALE_MS))))
    .limit(1);
  return !!x;
}

export async function runSchedulerTick(db: Db, now: Date, deps: TickDeps, scope?: { restaurantId: string }): Promise<TickResult> {
  const out: TickResult = { planos: 0, resumos: { enviados: 0, falhas: 0 }, lembretes: 0 };
  if (!deps.flags.agendador && !scope) return out;
  const rows = await db
    .select({ id: restaurants.id, ownerId: restaurants.ownerId, settings: restaurants.notifySettings, hasEmail: sql<boolean>`${owners.emailEnc} is not null` })
    .from(restaurants)
    .innerJoin(owners, eq(owners.id, restaurants.ownerId))
    .where(and(eq(restaurants.status, "ativo"), ne(owners.via, "e2e"), scope ? eq(restaurants.id, scope.restaurantId) : isNotNull(owners.emailEnc)));
  // Lembretes primeiro (revisão S4–S6, técnica M2): dependem do horário e não podem esperar as gerações de IA.
  const due = await queueDueReminders(db, { now, restaurantId: scope?.restaurantId });
  for (const [rid, ids] of Object.entries(due)) {
    out.lembretes += ids.length;
    await deps.sendPending(rid, ids).catch((err) => log.error("falha no envio dos lembretes", { area: "agendador", err: safeErr(err) }));
  }
  let generations = 0;
  for (const r of rows) {
    if (deps.stopped?.()) break;
    const s = parseNotifySettings(r.settings);
    try {
      const pd = scope ? { at: now } : planDue(now, s.resumo);
      if (s.planoAuto && pd && generations < MAX_GENERATIONS_PER_TICK && (await needsPlan(db, r.id, now, pd.at))) {
        generations++;
        const g = (await deps.generatePlan({ restaurantId: r.id, ownerId: r.ownerId, now })) as { ok?: boolean } | undefined;
        if (!g || g.ok !== false) out.planos++;
      }
      if (!s.resumo.on || !deps.flags.resumo_email || !r.hasEmail) continue;
      if (scope) {
        const x = await sendDigestNow(db, { restaurantId: r.id, now, baseUrl: deps.baseUrl, sender: deps.sender });
        if (x.ok) out.resumos.enviados++;
        continue;
      }
      const dd = digestDue(now, s.resumo);
      if (!dd) continue;
      if (s.planoAuto && (await generating(db, r.id, now)) && now.getTime() < dd.at.getTime() + DIGEST_WAIT_MS) continue;
      const res = await sendWeeklyDigest(db, { restaurantId: r.id, weekKey: dd.weekKey, now, baseUrl: deps.baseUrl, sender: deps.sender });
      if (res === "enviado") out.resumos.enviados++;
      if (res === "falhou") out.resumos.falhas++;
    } catch (err) {
      log.error("falha no tique do agendador", { area: "agendador", err: safeErr(err) });
    }
  }
  return out;
}
