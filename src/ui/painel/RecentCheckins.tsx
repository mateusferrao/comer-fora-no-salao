import type { RecentCheckin } from "@/src/modules/analytics/application/recent-checkins";
import { TZ_SP } from "@/src/shared/tz";

const hhmm = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ_SP, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * "Últimos check-ins de hoje" (D172): o grupo de controle aparece só aqui, para o dono, com o motivo —
 * o cliente nunca vê (o holdout não pode ser contaminado).
 */
export function RecentCheckins({ list }: { list: RecentCheckin[] }) {
  return (
    <section aria-labelledby="ultimos" className="flex flex-col gap-2 rounded-sm border border-border bg-white p-4">
      <h2 id="ultimos" className="text-base font-semibold text-ink">
        Últimos check-ins de hoje
      </h2>
      {list.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum check-in hoje ainda.</p>
      ) : (
        <ul className="flex flex-col" data-testid="ultimos-checkins">
          {list.map((c) => (
            <li key={c.at + c.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-divider py-2 text-sm first:border-t-0">
              <span className="w-12 tabular-nums text-ink-muted">{hhmm(c.at)}</span>
              <span className="font-medium text-ink">{c.name}</span>
              <span className="text-ink-muted">{c.firstVisit ? "1ª visita" : "volta"}</span>
              {c.validated && <span className="text-ink-muted">· código validado</span>}
              {c.controle && <span className="rounded-xs bg-surface-muted px-1.5 py-0.5 text-xs text-ink">grupo sem convite (para comparar)</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
