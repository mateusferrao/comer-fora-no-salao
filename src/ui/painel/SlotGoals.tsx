import type { SlotGoal } from "@/src/modules/analytics/domain/value";
import { slotLabel } from "@/src/modules/beneficios/domain/slot-text";
import { int } from "./format";

/** "Metas desta semana" (S5.1): convites usados na faixa × mesas a mais que o dono quer. Não causal. */
export function SlotGoals({ goals }: { goals: SlotGoal[] }) {
  if (!goals.length) return null;
  return (
    <section aria-labelledby="metas" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="metas" className="text-base font-semibold text-ink">
          Metas desta semana
        </h2>
        <span className="text-xs text-ink-muted">não causal</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="metas">
        {goals.map((g) => {
          const label = slotLabel(g);
          const ratio = g.metaMesas > 0 ? Math.min(1, g.usados / g.metaMesas) : 0;
          const main = `${int(g.usados)} ${g.usados === 1 ? "convite usado" : "convites usados"} · meta: ${int(g.metaMesas)} ${g.metaMesas === 1 ? "mesa" : "mesas"} a mais por semana`;
          return (
            <li key={g.slotId} className="flex flex-col gap-1 rounded-xs border border-divider p-3">
              <p className="font-semibold text-ink">{label}</p>
              <p className="text-sm text-ink">{main}</p>
              <div role="progressbar" aria-label={`${label}: ${main}`} aria-valuemin={0} aria-valuemax={g.metaMesas} aria-valuenow={Math.min(g.usados, g.metaMesas)} className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full bg-red-button" style={{ width: `${Math.round(ratio * 100)}%` }} />
              </div>
              <p className="text-xs text-ink-muted">
                {int(g.emitidos)}
                {g.teto != null ? ` de ${int(g.teto)}` : ""} convites emitidos nesta semana{g.teto != null ? " (teto)" : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
