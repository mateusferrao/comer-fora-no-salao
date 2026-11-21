import Link from "next/link";
import type { SegmentsView } from "@/src/modules/analytics/application/customers";
import type { Segment } from "@/src/modules/analytics/domain/segments";
import type { ListQuery, SortKey } from "@/src/modules/analytics/domain/customer-list";
import { int } from "./format";

const LABEL: Record<Segment, { title: string; hint: string }> = {
  sumiu: { title: "1 visita e sumiu", hint: "Uma visita, há 14 dias ou mais. Alvo da reativação." },
  perto: { title: "Perto da recompensa", hint: "4 ou 5 selos na cartela. Alvo da reativação." },
  convite_ativo: { title: "Com convite ativo", hint: "Têm um convite de volta válido." },
  frequente: { title: "Frequentes", hint: "3 ou mais visitas em 30 dias. Não recebem reativação, para não trocar o horário de quem já vem." },
};
const ORDER: Segment[] = ["sumiu", "perto", "convite_ativo", "frequente"];
const fmtDay = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
const BASE = "/parceiro/salao/clientes";
/** Colunas da lista; `sort` = ordenável ao clicar no título (ajuste de 21/11). Telefone não ordena (é só a dica). */
const COLS: Array<{ label: string; sort?: SortKey }> = [
  { label: "Cliente", sort: "cliente" },
  { label: "Telefone" },
  { label: "1ª visita", sort: "primeira" },
  { label: "Última", sort: "ultima" },
  { label: "Selos", sort: "selos" },
  { label: "Peça de origem", sort: "peca" },
  { label: "Opt-in", sort: "optin" },
];

/** Setas pretas de ordenação (SVG, nunca emoji): as duas em cinza quando a coluna não está ordenada. */
function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 10 14" className="h-3.5 w-2.5 shrink-0">
      <path d="M5 1 9 6H1z" className={dir === "asc" ? "fill-ink" : dir === null ? "fill-ink-muted" : "fill-transparent"} />
      <path d="M5 13 1 8h8z" className={dir === "desc" ? "fill-ink" : dir === null ? "fill-ink-muted" : "fill-transparent"} />
    </svg>
  );
}

function href(segment: Segment, q: Partial<ListQuery>): string {
  const p = new URLSearchParams({ segmento: segment });
  if (q.q) p.set("q", q.q);
  if (q.sort) p.set("ordem", q.sort);
  if (q.dir) p.set("dir", q.dir);
  if (q.page && q.page > 1) p.set("pagina", String(q.page));
  return `${BASE}?${p.toString()}`;
}

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
      <section aria-labelledby="lista" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
        <h2 id="lista" className="text-base font-bold text-ink">
          {LABEL[data.segment].title}
        </h2>
        <p className="text-sm text-ink-muted">{LABEL[data.segment].hint}</p>
        <form method="get" action={`${BASE}#lista`} role="search" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="segmento" value={data.segment} />
          <input type="hidden" name="ordem" value={data.query.sort} />
          <input type="hidden" name="dir" value={data.query.dir} />
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-ink">
            Buscar por nome
            <input
              type="search"
              name="q"
              defaultValue={data.query.q}
              maxLength={60}
              placeholder="Ex.: Ana"
              className="min-h-11 rounded-sm border border-border bg-white px-3 text-base font-normal"
            />
          </label>
          <button type="submit" className="min-h-11 rounded-xs bg-red-button px-5 text-sm font-semibold text-white">
            Buscar
          </button>
          {data.query.q && (
            <Link href={href(data.segment, { sort: data.query.sort, dir: data.query.dir })} scroll={false} className="min-h-11 content-center px-2 text-sm font-semibold text-red-text underline">
              Limpar busca
            </Link>
          )}
        </form>
        <p className="text-sm text-ink" role="status" data-testid="clientes-total">
          {data.query.q ? `${int(data.total)} ${data.total === 1 ? "cliente encontrado" : "clientes encontrados"} para “${data.query.q}”` : `${int(data.total)} ${data.total === 1 ? "cliente" : "clientes"} neste grupo`}
        </p>
        {data.list.length === 0 ? (
          <p className="text-sm text-ink">{data.query.q ? "Nenhum cliente com esse nome neste grupo." : "Nenhum cliente neste grupo ainda."}</p>
        ) : (
          <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Lista de clientes (rolável)">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-divider text-left text-xs text-ink-muted">
                  {COLS.map((c) => {
                    const active = c.sort === data.query.sort;
                    const next = active ? (data.query.dir === "asc" ? "desc" : "asc") : c.sort === "cliente" || c.sort === "peca" ? "asc" : "desc";
                    return (
                      <th key={c.label} scope="col" className="py-2 font-normal" aria-sort={active ? (data.query.dir === "asc" ? "ascending" : "descending") : undefined}>
                        {c.sort ? (
                          <Link
                            href={href(data.segment, { q: data.query.q, sort: c.sort, dir: next })}
                            scroll={false}
                            className={`inline-flex min-h-8 items-center gap-1 underline-offset-2 hover:underline ${active ? "font-semibold text-ink" : ""}`}
                          >
                            {c.label}
                            <SortIcon dir={active ? data.query.dir : null} />
                            <span className="sr-only">{active ? `, ordenado ${data.query.dir === "asc" ? "do menor para o maior" : "do maior para o menor"}` : ", ordenar"}</span>
                          </Link>
                        ) : (
                          c.label
                        )}
                      </th>
                    );
                  })}
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
        {data.pages > 1 && (
          <nav aria-label="Páginas da lista de clientes" className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {data.query.page > 1 ? (
              <Link href={`${href(data.segment, { ...data.query, page: data.query.page - 1 })}#lista`} className="min-h-11 content-center font-semibold text-red-text underline" rel="prev">
                ← Anterior
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            <span className="text-ink">
              Página {data.query.page} de {data.pages}
            </span>
            {data.query.page < data.pages ? (
              <Link href={`${href(data.segment, { ...data.query, page: data.query.page + 1 })}#lista`} className="min-h-11 content-center font-semibold text-red-text underline" rel="next">
                Próxima →
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        )}
        <p className="text-xs text-ink-muted">20 por página. Nome só com a inicial do sobrenome; telefone só com os 4 últimos dígitos.</p>
      </section>
    </div>
  );
}
