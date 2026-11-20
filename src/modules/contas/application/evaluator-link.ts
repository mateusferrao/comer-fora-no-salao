/**
 * Link privado do avaliador (D126): enviado junto com a entrega do case; cada abertura confirmada cria uma
 * conta própria, sem e-mail. Limite global de 20 contas/dia pelo link. Sem a variável, o recurso fica desligado.
 */
import type { Db } from "@/src/db/client";
import { owners } from "@/src/db/schema";
import { safeEqual } from "@/src/shared/crypto";
import { consume } from "@/src/shared/rate-limit";

export type EvaluatorLinkResult = { ok: true; ownerId: string } | { ok: false; erro: "invalido" | "limite"; retryAfterSec?: number };

export function evaluatorTokenValid(token: string, expected: string | undefined): boolean {
  return !!expected && safeEqual(token, expected);
}

export async function openEvaluatorLink(db: Db, p: { token: string; expected: string | undefined; now: Date }): Promise<EvaluatorLinkResult> {
  if (!evaluatorTokenValid(p.token, p.expected)) return { ok: false, erro: "invalido" };
  const lim = await consume(db, "link-avaliador:dia", 20, 86_400, p.now);
  if (!lim.ok) return { ok: false, erro: "limite", retryAfterSec: lim.retryAfterSec };
  const [o] = await db
    .insert(owners)
    .values({ kind: "teste", emailHint: "acesso por link", via: "link", lastSeenAt: p.now, createdAt: p.now })
    .returning({ id: owners.id });
  return { ok: true, ownerId: o!.id };
}
