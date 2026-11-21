import Link from "next/link";
import type { SegmentsView } from "@/src/modules/analytics/application/customers";
import type { Segment } from "@/src/modules/analytics/domain/segments";
import { int } from "./format";

const LABEL: Record<Segment, { title: string; hint: string }> = {
  sumiu: { title: "1 visita e sumiu", hint: "Uma visita, há 14 dias ou mais. Alvo da reativação." },
  perto: { title: "Perto da recompensa", hint: "4 ou 5 selos na cartela. Alvo da reativação." },
  convite_ativo: { title: "Com convite ativo", hint: "Têm um convite de volta válido." },
  frequente: { title: "Frequentes", hint: "3 ou mais visitas em 30 dias. Não recebem reativação, para não trocar o horário de quem já vem." },
};
const ORDER: Segment[] = ["sumiu", "perto", "convite_ativo", "frequente"];
const fmtDay = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");

export function CustomersView({ data }: { data: SegmentsView }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ORDER.map((s) => (
          <li key={s}>
            <Link
              href={`/parceiro/salao/clientes?segmento=${s}`}
              aria-current={data.segment === s ? "true" : undefined}
              className={`flex h-full flex-col gap-1 rounded-sm border p-4 focus-visible:outline-2 focus-visible:outline-ink ${data.segment === s ? "border-red-text bg-nav-active" : "border-border bg-white hover:border-ink-muted"}`}
            >
              <span className="text-sm font-semibold text-ink">{LABEL[s].title}</span>
              <span className="text-2xl font-bold text-ink" data-testid={`seg-${s}`}>
                {int(data.counts[s].count)}
              </span>
              <span className="text-xs text-ink-muted">com opt-in: {int(data.counts[s].optIn)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="lista" className="flex flex-col gap-2 rounded-sm border border-border bg-white p-4">
        <h2 id="lista" className="text-base font-bold text-ink">
          {LABEL[data.segment].title}
        </h2>
        <p className="text-sm text-ink-muted">{LABEL[data.segment].hint}</p>
        {data.list.length === 0 ? (
          <p className="text-sm text-ink">Nenhum cliente neste grupo ainda.</p>
        ) : (
          <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Lista de clientes (rolável)">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-divider text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 font-normal">Cliente</th>
                  <th scope="col" className="font-normal">Telefone</th>
                  <th scope="col" className="font-normal">1ª visita</th>
                  <th scope="col" className="font-normal">Última</th>
                  <th scope="col" className="font-normal">Selos</th>
                  <th scope="col" className="font-normal">Peça de origem</th>
                  <th scope="col" className="font-normal">Opt-in</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((c) => (
                  <tr key={c.id} className="border-b border-divider last:border-0">
                    <td className="py-2 text-ink">{c.displayName}</td>
                    <td className="text-ink-muted">{c.phoneHint}</td>
                    <td>{fmtDay(c.firstDay)}</td>
                    <td>{fmtDay(c.lastDay)}</td>
                    <td>{c.stamps}/6</td>
                    <td>{c.piece ?? "—"}</td>
                    <td className="text-xs">{[c.optIn.email && "E-mail", c.optIn.app && "App"].filter(Boolean).join(" · ") || "nenhum"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-ink-muted">Até 20 clientes, pelos mais recentes. Nome só com a inicial do sobrenome; telefone só com os 4 últimos dígitos.</p>
      </section>
    </div>
  );
}
