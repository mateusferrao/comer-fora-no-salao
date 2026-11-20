/**
 * Roda o revisor (tarefa 4) para um conjunto de textos já renderizados e devolve o resultado a gravar.
 * Falha, sem chave ou fora do contrato → "nao_revisado" (nunca bloqueia).
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { owners, restaurants } from "@/src/db/schema";
import type { AiGateway } from "../gateway";
import { gatewayFor, keyKindFor } from "../gateway-factory";
import { recordAiCall } from "../ai-calls";
import { MODELS } from "../models";
import { runTask } from "../run-task";
import { langfuseTracer } from "../tracing";
import { systemClock } from "@/src/shared/clock";
import { buildReviewerTask, buildReviewerText, REVIEWER_PROMPT_VERSION, REVIEWER_SYSTEM, type StoredReview } from "../tasks/reviewer";

export async function runReview(db: Db, p: { restaurantId: string; offer: string; texts: Array<{ label: string; text: string }>; now: Date; gateway?: AiGateway | null }): Promise<StoredReview> {
  const at = p.now.toISOString();
  const [r] = await db.select({ name: restaurants.name, emailHmac: owners.emailHmac, via: owners.via }).from(restaurants).innerJoin(owners, eq(owners.id, restaurants.ownerId)).where(eq(restaurants.id, p.restaurantId));
  if (!r) return { status: "nao_revisado", reasons: [], at };
  const keyKind = keyKindFor({ emailHmac: r.emailHmac, via: r.via });
  const gw = p.gateway !== undefined ? { gateway: p.gateway, keyKind } : await gatewayFor(db, keyKind, p.now);
  if (!gw.gateway) return { status: "nao_revisado", reasons: [], at };
  const text = buildReviewerText({ restaurantName: r.name, offer: p.offer, texts: p.texts });
  const res = await runTask(buildReviewerTask(MODELS.revisor), REVIEWER_SYSTEM, { text }, { gateway: gw.gateway, clock: systemClock, trace: langfuseTracer });
  await recordAiCall(db, { task: "revisor", promptVersion: REVIEWER_PROMPT_VERSION, restaurantId: p.restaurantId, result: res, keyKind: gw.keyKind });
  if (res.status !== "ok") return { status: "nao_revisado", reasons: [], at };
  return { status: res.data.veredito, reasons: res.data.veredito === "ok" ? [] : res.data.motivos.map((m) => m.replace(/\s+/g, " ").trim().slice(0, 160)), at };
}
