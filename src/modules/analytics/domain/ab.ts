/**
 * Status do A/B por peça (D34): decide só pela conversão leitura → check-in entre versões da mesma peça.
 * Amostra mínima por versão para detectar 30% → 40% com α = 0,05 bilateral e poder 0,8 (≈ 356).
 */
export const AB_MIN_SAMPLE = 356;
export type AbArm = { scans: number; checkins: number };
export type AbStatus = { state: "faltam"; missing: number } | { state: "sem_diferenca" } | { state: "vencedora"; winner: "A" | "B" };

export function abStatus(a: AbArm, b: AbArm): AbStatus {
  const min = Math.min(a.scans, b.scans);
  if (min < AB_MIN_SAMPLE) return { state: "faltam", missing: AB_MIN_SAMPLE - min };
  const pa = Math.min(1, a.checkins / a.scans);
  const pb = Math.min(1, b.checkins / b.scans);
  const p = (a.checkins + b.checkins) / (a.scans + b.scans);
  const se = Math.sqrt(p * (1 - p) * (1 / a.scans + 1 / b.scans));
  if (se === 0 || Math.abs(pa - pb) / se < 1.96) return { state: "sem_diferenca" };
  return { state: "vencedora", winner: pa > pb ? "A" : "B" };
}
