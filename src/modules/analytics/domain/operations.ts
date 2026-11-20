/**
 * Insight 4 — operação do salão (espec. 3.7.1.4 e 3.7.8; flag `insight_operacao`) e tabela do A/B (flag `ab`).
 * Limiares [C] (D145): peça "converte 2× menos" só com ≥ 50 leituras em cada versão; turno com códigos sem
 * validação só com ≥ 10 códigos em 30 dias e ≥ 30% sem validar.
 */
import { abStatus, type AbStatus } from "./ab";

export const ALERT_MIN_SCANS = 50;
export const ALERT_MIN_CODES = 10;
export const ALERT_UNVALIDATED_PCT = 30;

export type VariantStat = { id: string; kind: "display" | "cartaz"; label: "A" | "B"; scans: number; checkins: number };
export type AbRow = { kind: "display" | "cartaz"; a: VariantStat | null; b: VariantStat | null; status: AbStatus | null };

export function abTable(stats: VariantStat[]): AbRow[] {
  return (["display", "cartaz"] as const).map((kind) => {
    const a = stats.find((s) => s.kind === kind && s.label === "A") ?? null;
    const b = stats.find((s) => s.kind === kind && s.label === "B") ?? null;
    return { kind, a, b, status: a && b ? abStatus(a, b) : null };
  });
}

export type TurnCodes = { weekday: number; turn: "almoco" | "tarde" | "noite"; codes: number; validated: number };
export type CapUse = { alias: string; cap: number; used: number };

export type OpsAlert =
  | { kind: "teto"; alias: string; cap: number }
  | { kind: "peca"; piece: "display" | "cartaz"; worse: "A" | "B"; ratio: number }
  | { kind: "validacao"; weekday: number; turn: TurnCodes["turn"]; pct: number; codes: number };

const rate = (s: VariantStat) => (s.scans ? s.checkins / s.scans : 0);

export function operationAlerts(input: { ab: AbRow[]; caps: CapUse[]; turns: TurnCodes[] }): OpsAlert[] {
  const out: OpsAlert[] = [];
  for (const c of input.caps) if (c.cap > 0 && c.used >= c.cap) out.push({ kind: "teto", alias: c.alias, cap: c.cap });
  for (const r of input.ab) {
    if (!r.a || !r.b || r.a.scans < ALERT_MIN_SCANS || r.b.scans < ALERT_MIN_SCANS) continue;
    const [ra, rb] = [rate(r.a), rate(r.b)];
    const hi = Math.max(ra, rb);
    const lo = Math.min(ra, rb);
    if (hi > 0 && lo <= hi / 2) out.push({ kind: "peca", piece: r.kind, worse: ra < rb ? "A" : "B", ratio: lo === 0 ? Infinity : Math.round((hi / lo) * 10) / 10 });
  }
  const bad = input.turns
    .filter((t) => t.codes >= ALERT_MIN_CODES)
    .map((t) => ({ ...t, pct: Math.round((100 * (t.codes - t.validated)) / t.codes) }))
    .filter((t) => t.pct >= ALERT_UNVALIDATED_PCT)
    .sort((x, y) => y.pct - x.pct || y.codes - x.codes)
    .slice(0, 3);
  for (const t of bad) out.push({ kind: "validacao", weekday: t.weekday, turn: t.turn, pct: t.pct, codes: t.codes });
  return out;
}

const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const TURN = { almoco: "no almoço", tarde: "à tarde", noite: "à noite" } as const;
const PIECE = { display: "display de mesa", cartaz: "cartaz" } as const;

/** Texto do alerta (o código escreve os números). */
export function alertText(a: OpsAlert, slotPhrase: (alias: string) => string): string {
  if (a.kind === "teto") return `Teto atingido em ${slotPhrase(a.alias)}: os ${a.cap} convites desta semana acabaram.`;
  if (a.kind === "peca") return `${PIECE[a.piece][0]!.toUpperCase()}${PIECE[a.piece].slice(1)}: a versão ${a.worse} converte ${Number.isFinite(a.ratio) ? `${String(a.ratio).replace(".", ",")}×` : "muito"} menos leituras em check-in.`;
  return `${WD[a.weekday]![0]!.toUpperCase()}${WD[a.weekday]!.slice(1)} ${TURN[a.turn]}: ${a.pct}% dos códigos sem validação (de ${a.codes} em 30 dias). Confira se a equipe está validando no Portal.`;
}
