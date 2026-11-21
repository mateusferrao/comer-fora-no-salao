/**
 * Agendador dentro do processo do servidor (S6.1 — D168, D187): um tique por minuto com `setTimeout` encadeado
 * (nunca 2 tiques ao mesmo tempo no mesmo processo — revisão técnica I1), guarda em `globalThis` contra o hot reload
 * do `next dev` e `SCHEDULER=off` (E2E). A flag `agendador` é lida a cada tique; desligar nos Bastidores para tudo.
 * Duas instâncias não duplicam nada: as reservas no banco são idempotentes.
 */
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { getMailSender } from "@/src/modules/contas/adapters/mail-factory";
import { runSchedulerTick, type TickDeps } from "@/src/modules/agendador/application/tick";
import { generateWeeklyPlan } from "@/src/modules/planos/application/generate-plan";
import { sendPendingInviteEmails } from "@/src/modules/salao/application/deliver-messages";
import { log } from "@/src/shared/log";
import { safeErr } from "@/src/shared/safe-err";
import { publicBaseUrl } from "./qr";

const TICK_MS = 60_000;
type State = { timer: ReturnType<typeof setTimeout> | null; stopped: boolean; running: Promise<unknown> | null };
const g = globalThis as typeof globalThis & { __salaoScheduler?: State };

/** Dependências reais do tique (também usadas pelo "Rodar o ciclo agora" das Ferramentas do avaliador). */
export async function tickDeps(): Promise<TickDeps> {
  const db = getDb();
  const flags = await getFlags(db);
  return {
    sender: getMailSender(),
    baseUrl: publicBaseUrl(),
    flags: { agendador: flags.agendador, resumo_email: flags.resumo_email },
    generatePlan: (p) => generateWeeklyPlan(db, p),
    sendPending: (restaurantId, inviteIds) => sendPendingInviteEmails(db, { restaurantId, inviteIds, sender: getMailSender(), baseUrl: publicBaseUrl(), now: new Date(), v2: flags.copy_v2 }),
  };
}

export function startScheduler(): void {
  if (process.env.SCHEDULER === "off" || g.__salaoScheduler) return;
  const st: State = { timer: null, stopped: false, running: null };
  g.__salaoScheduler = st;
  const loop = async () => {
    if (st.stopped) return;
    st.running = (async () => {
      try {
        const deps = await tickDeps();
        if (!deps.flags.agendador) return;
        const r = await runSchedulerTick(getDb(), new Date(), deps);
        if (r.planos || r.resumos.enviados || r.resumos.falhas || r.lembretes) log.info("tique do agendador", { area: "agendador", ...r });
      } catch (err) {
        log.error("tique do agendador falhou", { area: "agendador", err: safeErr(err) });
      }
    })();
    await st.running;
    st.running = null;
    if (!st.stopped) st.timer = setTimeout(loop, TICK_MS);
  };
  st.timer = setTimeout(loop, 10_000);
}

/** SIGTERM: para de agendar e espera o tique em andamento terminar. */
export async function stopScheduler(): Promise<void> {
  const st = g.__salaoScheduler;
  if (!st) return;
  st.stopped = true;
  if (st.timer) clearTimeout(st.timer);
  await st.running;
}
