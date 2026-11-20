/**
 * Limite de uso em memória, por janela fixa (revisão S1, M2). Provisório até os limites persistidos da S2 (2.2):
 * protege o teto de convites da vitrine e a contagem de leituras contra scripts.
 */
type Globals = { __salaoLimits?: Map<string, { windowStart: number; count: number }> };
const g = globalThis as typeof globalThis & Globals;

export function hitLimit(key: string, max: number, windowMs: number, nowMs = Date.now()): boolean {
  g.__salaoLimits ??= new Map();
  const m = g.__salaoLimits;
  if (m.size > 50_000) m.clear(); // proteção de memória
  const cur = m.get(key);
  if (!cur || nowMs - cur.windowStart >= windowMs) {
    m.set(key, { windowStart: nowMs, count: 1 });
    return false;
  }
  cur.count++;
  return cur.count > max;
}

export function resetLimitsForTests(): void {
  g.__salaoLimits = undefined;
}

/** IP do cliente atrás do proxy do Easypanel (primeiro item do X-Forwarded-For). */
export function clientIp(headers: Headers): string {
  // O proxy da VPS (Traefik) acrescenta o IP de quem conectou no FIM do X-Forwarded-For; o 1º item vem do
  // cliente e pode ser forjado (revisão da S2). Sem CDN na frente, o último item é o IP real.
  const xff = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return xff?.at(-1) || headers.get("x-real-ip") || "desconhecido";
}
