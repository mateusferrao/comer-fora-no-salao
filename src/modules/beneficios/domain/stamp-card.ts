/** Cartela de selos (igual ao app — print 10): 6 selos, 1 por dia, vence 90 dias após o 1º check-in. */
import { daySP } from "@/src/shared/tz";
import { dayDiff } from "@/src/shared/week";

export type StampCardState = { startedDay: string; stamps: number; lastDay: string | null; completedDay: string | null };
export type StampCardConfig = { required: number; validityDays: number };

export const STAMP_CARD_DEFAULTS: StampCardConfig = { required: 6, validityDays: 90 };

export function isCardExpired(card: StampCardState, today: string, cfg: StampCardConfig): boolean {
  return dayDiff(card.startedDay, today) > cfg.validityDays;
}

export function applyCheckin(
  card: StampCardState | null,
  at: Date,
  cfg: StampCardConfig,
): { card: StampCardState; stamped: boolean; completed: boolean; renewed: boolean } {
  const today = daySP(at);
  if (card && card.lastDay === today) return { card, stamped: false, completed: false, renewed: false };
  const renew = !card || card.completedDay !== null || isCardExpired(card, today, cfg);
  if (renew) {
    const fresh: StampCardState = { startedDay: today, stamps: 1, lastDay: today, completedDay: null };
    return { card: fresh, stamped: true, completed: cfg.required <= 1, renewed: card !== null };
  }
  const stamps = card.stamps + 1;
  const completed = stamps >= cfg.required;
  return { card: { ...card, stamps, lastDay: today, completedDay: completed ? today : null }, stamped: true, completed, renewed: false };
}
