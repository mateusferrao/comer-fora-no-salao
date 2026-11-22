/**
 * "Seu salão" por frase (S8 — D265): roda a leitura da IA e devolve o preenchimento conferido pelo código. Não grava
 * nada (revisão técnica I2: `saveSalon` substitui tudo e avança o passo); o dono revisa no formulário e clica Continuar.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { owners } from "@/src/db/schema";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { gatewayFor, keyKindFor } from "@/src/modules/ia/gateway-factory";
import { COPILOT_PUBLIC_DAILY_CAP_USD, copilotSpentToday, recordAiCall } from "@/src/modules/ia/ai-calls";
import { MODELS } from "@/src/modules/ia/models";
import { runTask } from "@/src/modules/ia/run-task";
import { langfuseTracer } from "@/src/modules/ia/tracing";
import { buildSalonTask, MAX_SALON_TEXT, SALON_PROMPT_VERSION, SALON_SYSTEM, toSalonFill, type SalonFill } from "@/src/modules/ia/tasks/salon";
import { systemClock } from "@/src/shared/clock";

export type SalonSentenceResult = { ok: true; fill: SalonFill } | { ok: false; motivo: "sem_ia" | "nada_entendido" };

export async function readSalonSentence(db: Db, p: { restaurantId: string; ownerId: string; text: string; now: Date; gateway?: AiGateway | null }): Promise<SalonSentenceResult> {
  const text = p.text.slice(0, MAX_SALON_TEXT);
  const [owner] = await db.select({ emailHmac: owners.emailHmac, via: owners.via }).from(owners).where(eq(owners.id, p.ownerId));
  const keyKind = keyKindFor({ emailHmac: owner?.emailHmac ?? null, via: owner?.via ?? null });
  let gateway = p.gateway;
  if (gateway === undefined) gateway = (await gatewayFor(db, keyKind, p.now)).gateway;
  if (!gateway) return { ok: false, motivo: "sem_ia" };
  if (keyKind === "publica" && !(await getFlags(db)).ia_sem_teto && (await copilotSpentToday(db, "publica", p.now)) >= COPILOT_PUBLIC_DAILY_CAP_USD) return { ok: false, motivo: "sem_ia" };
  const res = await runTask(buildSalonTask(MODELS.copiloto), SALON_SYSTEM, { text: `<texto_do_dono>${text.replace(/[<>]/g, "")}</texto_do_dono>` }, { gateway, clock: systemClock, trace: langfuseTracer });
  await recordAiCall(db, { task: "salao_frase", promptVersion: SALON_PROMPT_VERSION, restaurantId: p.restaurantId, result: res, keyKind });
  if (res.status !== "ok") return { ok: false, motivo: "sem_ia" };
  const fill = toSalonFill(text, res.data);
  return fill.naoInformado.length === 7 ? { ok: false, motivo: "nada_entendido" } : { ok: true, fill };
}
