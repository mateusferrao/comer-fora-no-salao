"use client";

import { StickyActions } from "../../components/StickyActions";
import { Select } from "../../components/Select";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { api, markStep } from "./api";
import { ExtractionStatus, useExtraction, type ExtractionState } from "./ExtractionStatus";

type Row = { categoria: "entrada" | "prato" | "porcao" | "sobremesa" | "bebida"; nome: string; preco: string; confira?: boolean };
const CATS: Array<[Row["categoria"], string]> = [
  ["entrada", "Entrada"],
  ["prato", "Prato"],
  ["porcao", "Porção"],
  ["sobremesa", "Sobremesa"],
  ["bebida", "Bebida"],
];
const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const cents = (s: string) => {
  const v = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) && s.trim() !== "" ? Math.round(v * 100) : null;
};

export type ReviewInitial = { rows: Array<{ categoria: Row["categoria"]; nome: string; precoCentavos: number; confira?: boolean }> | null; cuisine: string | null; priceBand: string | null };

/** Passo 3 (espec. 3.2): tabela editável do que a IA leu; o sistema já marcou o que conferir. */
export function Step3Revisao({ extractionId, extraction, initial, manual = false }: { extractionId: string | null; extraction: ExtractionState | null; initial: ReviewInitial; manual?: boolean }) {
  const router = useRouter();
  const ext = useExtraction(initial.rows ? null : extractionId, extraction);
  const [rows, setRows] = useState<Row[] | null>(initial.rows ? initial.rows.map((r) => ({ ...r, preco: reais(r.precoCentavos) })) : null);
  const [cuisine, setCuisine] = useState(initial.cuisine ?? "");
  const [band, setBand] = useState(initial.priceBand ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => markStep(3), []);

  useEffect(() => {
    if (rows || !extractionId || !ext || ext.status === "lendo") return;
    void (async () => {
      const r = await api<{ result: { itens?: Array<{ categoria: Row["categoria"]; nome: string; precoCentavos: number; confira: boolean }>; culinaria?: string | null; faixaPreco?: string | null } | null }>(`/api/parceiro/cardapio/${extractionId}`);
      const res = r.data.result;
      setRows(res?.itens?.length ? res.itens.map((i) => ({ categoria: i.categoria, nome: i.nome, preco: reais(i.precoCentavos), confira: i.confira })) : [{ categoria: "prato", nome: "", preco: "" }]);
      if (res?.culinaria) setCuisine(res.culinaria);
      if (res?.faixaPreco) setBand(res.faixaPreco);
    })();
  }, [ext, extractionId, rows]);

  const upd = (i: number, p: Partial<Row>) => setRows((rs) => rs!.map((r, k) => (k === i ? { ...r, ...p, confira: false } : r)));

  async function submit() {
    const items = (rows ?? []).filter((r) => r.nome.trim()).map((r) => ({ categoria: r.categoria, nome: r.nome.trim(), precoCentavos: cents(r.preco) }));
    if (!items.length) return setError("Adicione pelo menos um item.");
    if (items.some((i) => i.precoCentavos === null)) return setError("Confira os preços: use valores como 32,90.");
    setBusy(true);
    setError(null);
    const r = await api("/api/parceiro/cardapio", "POST", { items, cuisine: cuisine.trim() || null, priceBand: band || null, extractionId });
    setBusy(false);
    if (r.ok) {
      router.push("/parceiro/salao/ativar/4");
      router.refresh();
    } else setError("Não conseguimos salvar o cardápio. Tente de novo.");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-ink">{manual ? "Seu cardápio" : "Revisão do cardápio"}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {manual ? "Digite os itens: nome, categoria e preço. Você pode acrescentar, corrigir e apagar quantos quiser." : "Confira o que a IA leu. Você pode corrigir, apagar ou acrescentar itens. As linhas marcadas pedem atenção."}
        </p>
      </div>
      {!rows && <ExtractionStatus state={ext ?? { status: "lendo" }} />}
      {rows && ext && ext.status !== "pronto" && <ExtractionStatus state={ext} />}
      {rows && ext && ext.status !== "pronto" && (
        <p className="text-sm">
          <Link className="font-semibold text-red-text underline" href="/parceiro/salao/ativar/1">
            Voltar e usar um exemplo
          </Link>
        </p>
      )}
      {rows && (
        <>
          <div className="relative overflow-x-auto no-scrollbar rounded-sm border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Itens do cardápio</caption>
              <thead className="bg-surface-muted text-left">
                <tr>
                  <th scope="col" className="px-3 py-2">Categoria</th>
                  <th scope="col" className="px-3 py-2">Item</th>
                  <th scope="col" className="px-3 py-2">Preço (R$)</th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.confira ? "bg-nav-active" : "border-t border-divider"}>
                    <td className="px-2 py-1">
                      <Select
                        label={`Categoria de ${r.nome || `item ${i + 1}`}`}
                        hideLabel
                        value={r.categoria}
                        options={CATS.map(([v, l]) => ({ value: v, label: l }))}
                        onChange={(v) => upd(i, { categoria: v as Row["categoria"] })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      {/* Ajuste de 21/11: "confira" vira um ícone dentro do campo (não empurra a linha). */}
                      <div className="relative">
                        <input
                          aria-label={`Nome do item ${i + 1}`}
                          aria-describedby={
                            r.confira ? `confira-${i}` : undefined
                          }
                          className={
                            r.confira
                              ? "min-h-11 w-full rounded-sm border border-red-text px-2 pr-9"
                              : "min-h-11 w-full rounded-sm border border-border px-2"
                          }
                          value={r.nome}
                          maxLength={80}
                          onChange={(e) => upd(i, { nome: e.target.value })}
                        />
                        {r.confira && (
                          <span
                            className="pointer-events-none absolute inset-y-0 right-2 flex items-center"
                            title="Confira este item: a leitura pode ter errado o nome ou o preço."
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className="size-5 text-red-text"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                              <path d="M12 9v4M12 17h.01" />
                            </svg>
                            <span id={`confira-${i}`} className="sr-only">
                              Confira este item: a leitura pode ter errado o
                              nome ou o preço.
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <input aria-label={`Preço de ${r.nome || `item ${i + 1}`}`} inputMode="decimal" className="min-h-11 w-28 rounded-sm border border-border px-2" value={r.preco} onChange={(e) => upd(i, { preco: e.target.value })} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button type="button" aria-label={`Remover ${r.nome || `item ${i + 1}`}`} className="min-h-11 rounded-sm px-3 text-red-text hover:bg-surface-muted" onClick={() => setRows((rs) => rs!.filter((_, k) => k !== i))}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="min-h-11 self-start text-sm font-semibold text-red-text underline" onClick={() => setRows((rs) => [...(rs ?? []), { categoria: "prato", nome: "", preco: "" }])}>
            + Adicionar item
          </button>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Culinária (sugerida)" value={cuisine} maxLength={40} onChange={(e) => setCuisine(e.target.value)} />
            <Select
              label="Nível de preço (sugerido)"
              size="lg"
              className="gap-1.5"
              value={band}
              options={[{ value: "", label: "—" }, ...["$", "$$", "$$$", "$$$$"].map((b) => ({ value: b, label: b }))]}
              onChange={setBand}
            />
          </div>
          <StickyActions
            message={
              error && (
                <p role="alert" className="text-sm font-medium text-red-text">
                  {error}
                </p>
              )
            }
          >
            <Button variant="primary-portal" loading={busy} onClick={submit}>
              Continuar
            </Button>
          </StickyActions>
        </>
      )}
    </div>
  );
}
