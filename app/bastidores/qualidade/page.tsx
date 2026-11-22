import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/src/db/client";
import { getQualityViewCached } from "@/src/modules/analytics/application/quality";
import { guardNote, REASON, TASK, usd } from "@/src/ui/ia/labels";
import { getCopilotMetrics } from "@/src/modules/agente/application/metrics";
import { IaDiagrama, RepoLink } from "@/src/ui/bastidores/Diagramas";

export const dynamic = "force-dynamic";
/** Nota cega do candidato na T3 (D137): atualizada quando ele responde (eval/relatorio-t3.md). */
const T3_HUMANO = "o candidato preferiu a IA em 8 de 9; concordou com o juiz em 7 de 9 (κ 0,55; amostra pequena)";
export const metadata: Metadata = { title: "Qualidade da IA · Comer Fora no Salão · protótipo de case" };


/** Qualidade da IA (espec. 2, 4.8): pública, agregada, sem conteúdo nem dados pessoais. */
export default async function Qualidade() {
  const v = await getQualityViewCached(getDb());
  const cm = await getCopilotMetrics(getDb());
  const ACTION: Record<string, string> = { oferta: "Oferta / teto / texto", item: "Prato do cardápio", faixa: "Horário vazio", plano: "Aprovar plano", tom: "Tom da IA", item_novo: "Prato novo", restaurante: "Ticket e margem", avisos: "Resumo semanal" };
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm">
        <Link className="text-red-text underline" href="/bastidores/como-funciona">
          ← Como funciona
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-ink">Qualidade da IA</h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        Cada chamada de IA passa por contrato (schema), regras fixas (referências, palavras proibidas, tamanho) e aprovação do dono; se falhar, entra o modelo reserva e, por fim, o texto modelo (sem IA). Números agregados, fora as chamadas dos testes automáticos. Explicação completa em <RepoLink path="docs/ia-no-produto.md">IA no produto</RepoLink>.
      </p>
      <IaDiagrama />
      <div
        className="mt-4 overflow-x-auto no-scrollbar rounded-sm border border-border bg-white p-4"
        tabIndex={0}
        role="region"
        aria-label="Qualidade por tarefa (rolável)"
      >
        <table className="w-full min-w-[640px] text-sm">
          <caption className="pb-2 text-left text-sm font-semibold text-ink">Por tarefa · custo total {usd(v.totalCostUsd)}</caption>
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th scope="col" className="font-normal">Tarefa</th>
              <th scope="col" className="font-normal">Chamadas</th>
              <th scope="col" className="font-normal">Ok</th>
              <th scope="col" className="font-normal">Sem IA (motivo)</th>
              <th scope="col" className="font-normal">Usou a reserva</th>
              <th scope="col" className="font-normal">Bloqueios mais comuns</th>
              <th scope="col" className="font-normal">Custo médio</th>
              <th scope="col" className="font-normal">Latência p50</th>
            </tr>
          </thead>
          <tbody>
            {v.tasks.length === 0 && (
              <tr>
                <td colSpan={8} className="py-2 text-ink">
                  Nenhuma chamada ainda.
                </td>
              </tr>
            )}
            {v.tasks.map((t) => (
              <tr key={t.task} className="border-t border-divider align-top">
                <td className="py-2">{TASK[t.task] ?? t.task}</td>
                <td>{t.calls}</td>
                <td>{t.okPct}%</td>
                <td className="text-xs">{Object.entries(t.fallbackByReason).map(([r, n]) => `${n} · ${REASON[r] ?? r}`).join("; ") || "—"}</td>
                <td>{t.reservePct}%</td>
                <td className="text-xs">{t.topBlocks.map((b) => `${guardNote(b.reason)} (${b.n})`).join("; ") || "—"}</td>
                <td>{usd(t.avgCostUsd)}</td>
                <td>{t.p50Ms === null ? "—" : `${(t.p50Ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <section className="rounded-sm border border-border bg-white p-4" aria-labelledby="aceite">
          <h2 id="aceite" className="text-base font-bold text-ink">
            Aceitas sem edição pelo dono
          </h2>
          <ul className="mt-2 text-sm text-ink">
            {v.acceptedNoEdit.length === 0 && <li>Nenhuma decisão ainda.</li>}
            {v.acceptedNoEdit.map((a) => (
              <li key={a.what}>
                {a.what === "pacote" ? "Pacote da ativação" : "Plano da semana"}: {a.accepted} de {a.total}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-sm border border-border bg-white p-4" aria-labelledby="nota">
          <h2 id="nota" className="text-base font-bold text-ink">
            A IA escolheu diferente da maior nota
          </h2>
          <p className="mt-2 text-sm text-ink">
            {v.aiVsTop.compared === 0 ? "Ainda sem escolhas da IA para comparar." : `${v.aiVsTop.differs} de ${v.aiVsTop.compared} escolhas (${Math.round((100 * v.aiVsTop.differs) / v.aiVsTop.compared)}%)`}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            A nota do código é só econômica; quem casa item × turno é a IA. Escolher diferente mostra que ela não repete a regra do código, mas não mostra que
            escolhe melhor: isso é hipótese, a medir no piloto.
          </p>
        </section>
      </div>
      <section className="mt-4 rounded-sm border border-border bg-white p-4" aria-labelledby="avaliacao">
        <h2 id="avaliacao" className="text-base font-bold text-ink">
          Mini-avaliação
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink">
          <strong>Ganho medido da IA:</strong> leitura do cardápio (T1, contra OCR) e texto do convite e da justificativa (T3, contra o texto modelo).{" "}
          <strong>Hipótese:</strong> a escolha de item × turno pela IA rende mais que a de maior nota; mede-se no piloto, com restaurantes sem a escolha da IA.
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-ink">
          <li>T1 (leitura do cardápio): 7 modelos de visão e 3 linhas de base de OCR em 4 cardápios. Venceu google/gemini-3.1-flash-lite (nota 1,000; p50 2,4 s; US$ 0,0017 por cardápio); OCR + regras ficou em 0,42–0,46 e OCR + IA de texto, em 0,73. <RepoLink path="eval/relatorio-t1.md">Relatório</RepoLink>.</li>
          <li>
            T3 (pacote e plano): 6 modelos × 5 cenários fictícios × 2 repetições, com um juiz de IA de um provedor que não concorre. Venceu google/gemini-3.8-flash (regras ok em 90%; p50 2,8 s), com openai/gpt-6-luna de reserva. Contra o texto modelo, o juiz preferiu a IA em 8 de 9 pares; {T3_HUMANO}. O texto modelo é reconhecível pelo formato, e no critério item × turno o vencedor empatou com ele em 3 de 4 cenários: a vantagem medida está no texto. <RepoLink path="eval/relatorio-t3.md">Relatório</RepoLink> · <RepoLink path="eval/t3-cego.md">pares cegos</RepoLink>.
          </li>
          <li>T3 do agente (plano da semana): agente com ferramentas × chamada única, 3 rodadas. Na última, os dois passaram nas regras em 10 de 10; o juiz preferiu o agente em 6, empate em 1, chamada única em 3; custo por plano US$ 0,014 × US$ 0,002 e p50 13,8 s × 3,6 s. <RepoLink path="eval/relatorio-t3-agente.md">Relatório</RepoLink>.</li>
          <li>Revisor (outro provedor, só nos textos que chegam ao cliente): em 10 planos gerados pela IA, 0 bloqueados e 3 com &quot;atenção&quot;. Mede só bloqueio indevido; textos ruins de propósito ainda não foram testados (<RepoLink path="eval/resultados-revisor.json">resultados</RepoLink>).</li>
          <li>T4 (Assistente do salão): 16 pedidos com gabarito; fora da amostra, 6 casos novos × 3 repetições: gemini-3.8-flash acertou 17 de 18 e gpt-6-luna, 14 de 18 (<RepoLink path="eval/relatorio-t4-validacao.md">relatório</RepoLink>; escopo: <RepoLink path="eval/relatorio-t4-escopo.md">30 de 30</RepoLink>).</li>
        </ul>
      </section>
          <section className="mt-6 rounded-sm border border-border bg-white p-4 text-sm" aria-labelledby="copiloto-metricas">
        <h2 id="copiloto-metricas" className="font-semibold text-ink">Assistente do salão (copiloto e MCP)</h2>
        <p className="mt-1 text-ink-muted">Hipótese: o dono ajusta pouco porque as Configurações dão trabalho. O que mostra que funcionou: propostas aplicadas sobre as mostradas e mais mudanças feitas por semana.</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Pedidos ao copiloto: {cm.turns}{cm.turnsNoAiPct !== null ? ` · sem IA em ${cm.turnsNoAiPct}%` : ""}</li>
          <li>Propostas mostradas: {cm.shown} · aplicadas: {cm.applied}{cm.appliedPct !== null ? ` (${cm.appliedPct}%)` : ""} · descartadas: {cm.discarded} · vencidas: {cm.expired} · com falha: {cm.failed}</li>
          <li>Pedidos fora do escopo do restaurante (D277): {cm.outOfScope.total}{cm.outOfScope.total > 0 ? ` · barrados pelo portão do sistema, mesmo marcados como do restaurante: ${cm.outOfScope.byGate}` : ""}. O dono vê uma recusa fixa e nenhuma proposta.</li>
          <li>Tempo até aplicar (mediana): {cm.p50SecToApply === null ? "—" : `${cm.p50SecToApply} s`}</li>
          <li>Mudanças nas Configurações nos últimos 7 dias: {cm.editsLast7.total}, das quais {cm.editsLast7.copilot} pelo assistente ou por agente</li>
          {cm.byOrigin.length > 0 && <li>Aplicadas por canal: {cm.byOrigin.map((o) => `${o.origin === "mcp" ? "app de IA conectado (MCP)" : "Assistente do salão"} ${o.applied}`).join(" · ")}</li>}
        </ul>
        {cm.byAction.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <caption className="pb-1 text-left text-xs text-ink-muted">Por tipo de mudança</caption>
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th scope="col" className="font-normal">Mudança</th>
                <th scope="col" className="font-normal">Mostradas</th>
                <th scope="col" className="font-normal">Aplicadas</th>
              </tr>
            </thead>
            <tbody>
              {cm.byAction.map((a) => (
                <tr key={a.action} className="border-t border-divider">
                  <th scope="row" className="py-1 text-left font-normal">{ACTION[a.action] ?? a.action}</th>
                  <td>{a.shown}</td>
                  <td>{a.applied}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-ink-muted">Recusas pelas regras aparecem só no cartão do dono (não são gravadas) e o abandono do passo 2 com × sem frase fica para o piloto.</p>
      </section>
    </main>
  );
}
