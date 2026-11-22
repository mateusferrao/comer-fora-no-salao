import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import { unitCost, type Offer } from "@/src/modules/beneficios/domain/offers";

/**
 * Custo dos convites da semana se todos forem usados (S9, auditoria do Portal 1.8): soma de teto × custo por convite.
 * É "máximo" só quando todos os custos são máximos (sem margem informada); com margem ou desconto, é estimado.
 */
export function weeklyInviteCost(slots: ReadonlyArray<{ offer: Offer; weeklyCap: number }>, menu: readonly MenuItem[], marginPct?: number): { cents: number; isMax: boolean } {
  let cents = 0;
  let isMax = true;
  for (const s of slots) {
    const c = unitCost(s.offer, menu, marginPct);
    cents += c.cents * s.weeklyCap;
    if (!c.isMax) isMax = false;
  }
  return { cents, isMax };
}
