/**
 * Limites de uso persistidos (S2, tarefa 2.2): janela fixa por chave, contada no Postgres com UPSERT
 * atômico — vale entre processos e sobrevive a restart (substitui `rate-limit-memory`, D115).
 */
import { lt, sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { rateLimits } from "@/src/db/schema";

export type ConsumeResult = { ok: true } | { ok: false; retryAfterSec: number };

/** Meia-noite de SP = 03h UTC. */
const SP_OFFSET_MS = 3 * 3_600_000;

export async function consume(ex: Executor, key: string, max: number, windowSec: number, now: Date = new Date()): Promise<ConsumeResult> {
  const windowMs = windowSec * 1000;
  // Janelas de dia(s) começam à meia-noite de SP (UTC−3, sem horário de verão), não às 21h (D150).
  const offset = windowSec % 86_400 === 0 ? SP_OFFSET_MS : 0;
  const start = new Date(Math.floor((now.getTime() - offset) / windowMs) * windowMs + offset);
  const [row] = await ex
    .insert(rateLimits)
    .values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  // Limpeza "de carona" das janelas antigas (~1 em 200 chamadas).
  if (Math.random() < 0.005) void ex.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 2 * 86_400_000))).catch(() => {});
  if ((row?.count ?? 1) > max) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((start.getTime() + windowMs - now.getTime()) / 1000)) };
  return { ok: true };
}

/** Consome várias chaves; para na primeira estourada (as anteriores já contaram — aceitável para limites). */
export async function consumeAll(ex: Executor, rules: Array<{ key: string; max: number; windowSec: number }>, now: Date = new Date()): Promise<ConsumeResult> {
  for (const r of rules) {
    const res = await consume(ex, r.key, r.max, r.windowSec, now);
    if (!res.ok) return res;
  }
  return { ok: true };
}
