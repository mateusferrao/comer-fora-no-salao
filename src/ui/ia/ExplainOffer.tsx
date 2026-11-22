"use client";

import { useState } from "react";
import type { OfferExplanation } from "@/src/modules/planos/application/explain-offer";
import { SidePanel } from "@/src/ui/components/SidePanel";
import { guardNote, REASON, usd } from "./labels";

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const REVIEW: Record<string, string> = { ok: "ok", atencao: "atenção", bloquear: "bloqueado", revisando: "revisando", nao_revisado: "não revisado" };

/**
 * "Por que esta oferta?" (S5.3, D180): link por faixa → painel lateral. Camada do dono (opções do código, escolha,
 * fatos, regras, revisor) e, recolhida, "Como a IA decidiu" (modelo, tentativas, custo, tempo, prompt). Textos
 * montados a partir dos dados (revisão de produto B2): nada de afirmar IA onde não houve chamada.
 */
export function ExplainOfferLink({ planId, slotId }: { planId: string; slotId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<OfferExplanation | null>(null);
  const [error, setError] = useState(false);
  const load = async () => {
    setOpen(true);
    setError(false);
    try {
      const r = await fetch(`/api/parceiro/plano/explicar?plano=${planId}&faixa=${slotId}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setData((await r.json()) as OfferExplanation);
    } catch {
      setError(true);
    }
  };
  return (
    <>
      <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center text-sm font-semibold text-red-text underline sm:min-h-6">
        Por que esta oferta?
      </button>
      <SidePanel open={open} onClose={() => setOpen(false)} title="Por que esta oferta?">
        {error ? <p className="text-sm text-ink">Não foi possível carregar agora. Tente de novo.</p> : !data ? <p className="text-sm text-ink-muted">Carregando…</p> : <Explanation e={data} />}
      </SidePanel>
    </>
  );
}

function Explanation({ e }: { e: OfferExplanation }) {
  const ai = e.opcoes.find((o) => o.escolhaIa);
  const notTop = ai && !ai.maiorNota;
  return (
    <div className="flex flex-col gap-5 text-sm text-ink" data-testid="por-que">
      <p className="font-semibold">{e.slotLabel}</p>

      <section aria-labelledby="pq-opcoes" className="flex flex-col gap-2">
        <h3 id="pq-opcoes" className="text-base font-semibold">
          O sistema achou {e.opcoes.length} {e.opcoes.length === 1 ? "oferta possível" : "ofertas possíveis"} para {e.slotLabel}
        </h3>
        <div
          className="relative overflow-x-auto no-scrollbar"
          tabIndex={0}
          role="region"
          aria-label="Ofertas possíveis (rolável)"
        >
          <table className="w-full min-w-[420px]">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="py-1 pr-2 font-medium">Oferta</th>
                <th className="py-1 pr-2 font-medium">Custo por convite</th>
                <th className="py-1 font-medium">Custo-benefício</th>
              </tr>
            </thead>
            <tbody>
              {e.opcoes.map((o) => (
                <tr key={o.id} className="border-t border-divider align-top">
                  <td className="py-2 pr-2">
                    {o.gain}
                    <span className="block text-xs text-ink-muted">
                      {[o.maiorNota && "melhor custo-benefício", o.escolhaIa && e.modo === "ia" && "escolha da IA", o.escolhaDono && "sua escolha"].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{brl(o.unitCostCents)}</td>
                  <td className="py-2 tabular-nums">{o.score.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-muted">Custo-benefício: quanto menor o custo comparado ao ticket médio, maior o número.</p>
      </section>

      <section aria-labelledby="pq-escolha" className="flex flex-col gap-1">
        <h3 id="pq-escolha" className="text-base font-semibold">
          {e.modo === "ia" ? `A IA escolheu ${ai?.gain ?? e.escolhida ?? "esta oferta"}` : e.modo === "fixo" ? "Plano escrito antes" : "Escolhida pelo melhor custo-benefício"}
        </h3>
        {e.modo === "fixo" && <p>Plano escrito antes para o restaurante de exemplo, sem IA. Gere um plano novo para ver a IA decidir.</p>}
        {e.modo === "sem_ia" && <p>IA indisponível: {REASON[e.semIa ?? ""] ?? e.semIa ?? "motivo não registrado"}.</p>}
        {e.modo === "ia" && notTop && <p>A IA não escolheu a oferta de melhor custo-benefício.{e.justificativa ? " O motivo dela está logo abaixo." : ""}</p>}
        {e.justificativa && <p className="italic">“{e.justificativa}”</p>}
      </section>

      {e.fatos.length > 0 && (
        <section aria-labelledby="pq-fatos" className="flex flex-col gap-1">
          <h3 id="pq-fatos" className="text-base font-semibold">
            Fatos usados
          </h3>
          <ul className="list-disc pl-5">
            {e.fatos.map((f) => (
              <li key={f.key}>
                {f.label}: <span className="font-semibold">{f.value}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="pq-regras" className="flex flex-col gap-1">
        <h3 id="pq-regras" className="text-base font-semibold">
          Regras
        </h3>
        {/* Só o texto da IA passa pelas regras; o texto modelo e o do dono não (revisão S4–S6, produto 9). */}
        {e.modo === "ia" ? (
          <p>Passou nas regras: sem números inventados, item e horário certos, convite com dia e horário.</p>
        ) : (
          <p>Texto padrão do sistema: não passou pela IA.</p>
        )}
        <p>
          Conferência por uma segunda IA:{" "}
          {e.kind === "pacote" ? "não se aplica ao pacote" : e.revisor ? `${REVIEW[e.revisor.status] ?? e.revisor.status}${e.revisor.reasons.length ? ` · ${e.revisor.reasons.join("; ")}` : ""}` : "não revisado"}
        </p>
      </section>

      <details className="rounded-sm border border-border p-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold sm:min-h-6">Como a IA decidiu</summary>
        {e.tecnico ? (
          <ul className="mt-2 flex flex-col gap-1" data-testid="como-ia-decidiu">
            <li>
              Modelo: {e.tecnico.servedModel ?? e.tecnico.model ?? "não registrado"}
              {e.tecnico.provider ? ` (${e.tecnico.provider})` : ""}
            </li>
            <li>
              Tentativas:{" "}
              {e.tecnico.attempts
                .map((a, i) => `${i + 1}ª ${a.ok ? `ok (${a.model})` : `bloqueada (${a.model}): ${a.notes.length ? a.notes.map(guardNote).join(", ") : (REASON[a.error ?? ""] ?? a.error ?? "falhou")}`}`)
                .join(" → ")}
              {e.tecnico.reserva ? " · usou o modelo reserva" : ""}
            </li>
            {e.passos.length > 0 && (
              <li>
                Passos da IA:
                <ol className="ml-5 list-decimal" data-testid="passos-agente">
                  {e.passos.map((s, i) => (
                    <li key={i}>
                      {s.label} · {(s.ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s
                    </li>
                  ))}
                </ol>
              </li>
            )}
            <li>
              Custo: {usd(e.tecnico.costUsd)} · Tempo: {(e.tecnico.latencyMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s · Prompt: {e.tecnico.promptVersion}
            </li>
          </ul>
        ) : (
          <p className="mt-2">Sem chamada de IA registrada para esta oferta.</p>
        )}
      </details>
    </div>
  );
}
