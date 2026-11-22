/**
 * Link privado do avaliador (D126): enviado junto com a entrega do case; cada abertura confirmada cria uma
 * conta própria, sem e-mail. Limite global de EVALUATOR_DAILY_LIMIT contas/dia pelo link (S7: 20 → 60; os testes da própria entrega já gastavam ~16 num dia). Sem a variável, o recurso fica desligado.
 */
import type { Db } from "@/src/db/client";
import { owners } from "@/src/db/schema";
import { safeEqual } from "@/src/shared/crypto";
import { consume } from "@/src/shared/rate-limit";

export type EvaluatorLinkResult = { ok: true; ownerId: string } | { ok: false; erro: "invalido" | "limite"; retryAfterSec?: number };

export const EVALUATOR_DAILY_LIMIT = 60;

export function evaluatorTokenValid(token: string, expected: string | undefined): boolean {
  return !!expected && safeEqual(token, expected);
}

export async function openEvaluatorLink(db: Db, p: { token: string; expected: string | undefined; now: Date }): Promise<EvaluatorLinkResult> {
  if (!evaluatorTokenValid(p.token, p.expected)) return { ok: false, erro: "invalido" };
  const lim = await consume(db, "link-avaliador:dia", EVALUATOR_DAILY_LIMIT, 86_400, p.now);
  if (!lim.ok) return { ok: false, erro: "limite", retryAfterSec: lim.retryAfterSec };
  const [o] = await db
    .insert(owners)
    .values({ kind: "teste", emailHint: "acesso por link", via: "link", lastSeenAt: p.now, createdAt: p.now })
    .returning({ id: owners.id });
  return { ok: true, ownerId: o!.id };
}
