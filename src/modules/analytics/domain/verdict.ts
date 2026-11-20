/**
 * Veredito por oferta (D220; limiares [C] da S3 — D145): decidido pelo código com indicadores antecipados,
 * não causal. Só uso e amostra: o custo já é filtrado nas candidatas (revisão técnica do plano, T-I2).
 */
export const VERDICT_MIN_ISSUED = 10;
export const VERDICT_MIN_USAGE = 0.15;
export type Verdict = "manter" | "trocar" | "cedo_demais";

/** `issued7d`: convites reais com ≥ 7 dias desde a emissão; `used7d`: desses, usados em até 7 dias. */
export function verdict(o: { issued7d: number; used7d: number }): Verdict {
  if (o.issued7d < VERDICT_MIN_ISSUED) return "cedo_demais";
  return o.used7d / o.issued7d >= VERDICT_MIN_USAGE ? "manter" : "trocar";
}

/**
 * Entradas do veredito para uma oferta, num dia de referência: convites reais emitidos entre 37 e 7 dias antes
 * (janela de 30 dias, todos com ≥ 7 dias de idade) e, desses, os usados em até 7 dias da emissão.
 */
export function verdictInputs(invites: ReadonlyArray<{ issuedDay: string; usedDay: string | null }>, refDay: string, addDays: (d: string, n: number) => string): { issued7d: number; used7d: number } {
  const from = addDays(refDay, -37);
  const to = addDays(refDay, -7);
  const xs = invites.filter((i) => i.issuedDay >= from && i.issuedDay <= to);
  return { issued7d: xs.length, used7d: xs.filter((i) => i.usedDay !== null && i.usedDay <= addDays(i.issuedDay, 7)).length };
}
