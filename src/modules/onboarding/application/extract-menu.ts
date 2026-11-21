/**
 * Passo 1 do assistente (espec. 3.2): a extração roda em segundo plano (`menu_extractions`) enquanto o dono
 * preenche o salão. Os exemplos ficam prontos na hora (leitura feita antes e guardada). A imagem nunca é gravada (D50).
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { menuExtractions, owners } from "@/src/db/schema";
import { consumeAll } from "@/src/shared/rate-limit";
import { safeErr } from "@/src/shared/safe-err";
import { systemClock } from "@/src/shared/clock";
import { getActivePrompt, promptSuffix } from "@/src/modules/config/application/app-config";
import { recordAiCall, type KeyKind } from "@/src/modules/ia/ai-calls";
import { gatewayFor, keyKindFor } from "@/src/modules/ia/gateway-factory";
import { langfuseTracer } from "@/src/modules/ia/tracing";
import { MODELS } from "@/src/modules/ia/models";
import { runTask } from "@/src/modules/ia/run-task";
import { buildMenuTask, menuInput, menuSystem, MENU_PROMPT_VERSION } from "@/src/modules/ia/tasks/menu";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { cleanExtraction, type CleanExtraction } from "../domain/menu-extraction";
import { EXAMPLES, type ExampleId } from "../adapters/example-source";
import { log } from "@/src/shared/log";

export const EXTRACTION_STALE_MS = 90_000;
export type ExtractionSource = "foto" | "pdf" | "exemplo" | "importado";
export type ExtractionView = { id: string; source: ExtractionSource; status: "lendo" | "pronto" | "falhou" | "nao_cardapio"; result: (CleanExtraction & { cache?: boolean; semIa?: string }) | null; startedAt: Date };

export async function startCachedExtraction(db: Db, p: { restaurantId: string; source: "exemplo"; exampleId: ExampleId; now: Date }): Promise<string> {
  const result = { ...EXAMPLES[p.exampleId].cached.extraction, cache: true };
  const [row] = await db
    .insert(menuExtractions)
    .values({
      restaurantId: p.restaurantId,
      source: p.source,
      inputHash: EXAMPLES[p.exampleId].cached.inputHash,
      status: "pronto",
      result,
      model: EXAMPLES[p.exampleId].cached.model,
      startedAt: p.now,
      finishedAt: p.now,
    })
    .returning({ id: menuExtractions.id });
  return row!.id;
}

export type StartAiResult = { ok: true; extractionId: string; run: () => Promise<void> } | { ok: false; erro: "limite"; retryAfterSec?: number };

/**
 * Reserva o limite, cria a linha `lendo` e devolve `run` para a rota rodar depois da resposta (`after`).
 * Limites [C]: 5/dia por conta, 15/dia por IP, 150/dia global (contas E2E isentas).
 */
export async function startAiExtraction(
  db: Db,
  p: { restaurantId: string; ownerId: string; ip: string; source: "foto" | "pdf"; images: Array<{ data: Uint8Array; mediaType: string }>; now: Date; gateway?: AiGateway | null },
): Promise<StartAiResult> {
  const [owner] = await db.select({ via: owners.via, emailHmac: owners.emailHmac }).from(owners).where(eq(owners.id, p.ownerId));
  if (owner?.via !== "e2e") {
    const lim = await consumeAll(
      db,
      [
        { key: `extracao:conta:${p.ownerId}`, max: 5, windowSec: 86_400 },
        { key: `extracao:ip:${p.ip}`, max: 15, windowSec: 86_400 },
        { key: "extracao:global", max: 150, windowSec: 86_400 },
      ],
      p.now,
    );
    if (!lim.ok) return { ok: false, erro: "limite", retryAfterSec: lim.retryAfterSec };
  }
  const [row] = await db.insert(menuExtractions).values({ restaurantId: p.restaurantId, source: p.source, status: "lendo", startedAt: p.now }).returning({ id: menuExtractions.id });
  const keyKind: KeyKind = keyKindFor({ emailHmac: owner?.emailHmac ?? null, via: owner?.via ?? null });
  const id = row!.id;
  const run = async () => {
    try {
      const choice = p.gateway !== undefined ? { gateway: p.gateway, keyKind, reason: p.gateway ? undefined : ("sem_chave" as const) } : await gatewayFor(db, keyKind, new Date());
      if (!choice.gateway) {
        await db.update(menuExtractions).set({ status: "falhou", result: { semIa: choice.reason }, finishedAt: new Date() }).where(eq(menuExtractions.id, id));
        return;
      }
      const prompt = await getActivePrompt(db, "cardapio");
      const r = await runTask(buildMenuTask(MODELS.cardapio), menuSystem(prompt.instructions), menuInput(p.images), { gateway: choice.gateway, clock: systemClock, trace: langfuseTracer });
      await recordAiCall(db, { task: "cardapio", promptVersion: `${MENU_PROMPT_VERSION}${promptSuffix(prompt)}`, restaurantId: p.restaurantId, result: r, keyKind: choice.keyKind });
      if (r.status !== "ok") {
        await db.update(menuExtractions).set({ status: "falhou", finishedAt: new Date() }).where(eq(menuExtractions.id, id));
        return;
      }
      const clean = cleanExtraction(r.data);
      await db
        .update(menuExtractions)
        .set({ status: clean.ehCardapio ? "pronto" : "nao_cardapio", result: clean, model: r.model, finishedAt: new Date() })
        .where(eq(menuExtractions.id, id));
    } catch (err) {
      log.error("falha na extração", { area: "cardapio", err: safeErr(err) });
      await db.update(menuExtractions).set({ status: "falhou", finishedAt: new Date() }).where(eq(menuExtractions.id, id)).catch(() => {});
    }
  };
  return { ok: true, extractionId: id, run };
}

/** Lê a extração do próprio restaurante; `lendo` há mais de 90 s vira `falhou` (restart no meio — revisão T-I5). */
export async function getExtraction(db: Db, restaurantId: string, id: string, now: Date): Promise<ExtractionView | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await db.select().from(menuExtractions).where(and(eq(menuExtractions.id, id), eq(menuExtractions.restaurantId, restaurantId)));
  if (!row) return null;
  let status = row.status as ExtractionView["status"];
  if (status === "lendo" && now.getTime() - row.startedAt.getTime() > EXTRACTION_STALE_MS) {
    status = "falhou";
    await db.update(menuExtractions).set({ status, finishedAt: now }).where(eq(menuExtractions.id, id));
  }
  return { id: row.id, source: row.source as ExtractionSource, status, result: (row.result as ExtractionView["result"]) ?? null, startedAt: row.startedAt };
}
