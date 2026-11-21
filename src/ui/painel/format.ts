/** Formatação dos números do painel (pt-BR). */
export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const signed = (x: number, digits = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const int = (n: number) => n.toLocaleString("pt-BR");
export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Semana ISO ("2026-W48") → "23–29/11" (revisão de produto S3: nada de "sem. 48" na tela). */
export function weekLabel(weekKey: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) return weekKey;
  const [y, w] = [Number(m[1]), Number(m[2])];
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000 + (w - 1) * 7 * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  const dm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return monday.getUTCMonth() === sunday.getUTCMonth() ? `${monday.getUTCDate()}–${dm(sunday)}` : `${dm(monday)}–${dm(sunday)}`;
}
