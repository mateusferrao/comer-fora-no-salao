import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/src/db/client";
import { getPlatformViewCached } from "@/src/modules/analytics/application/platform";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Visão da plataforma · Comer Fora no Salão · protótipo de case" };

const STEP: Record<number, string> = { 1: "Cardápio", 2: "Seu salão", 3: "Revisão do cardápio", 4: "Pacote proposto", 5: "Resumo e ativar" };
const usd = (x: number) => (x > 0 && x < 0.01 ? "< US$ 0,01" : `US$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const duration = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`);

/** Visão do iFood (D144; critério 4 do case): adoção e custo, agregados, sem dados pessoais. */
export default async function Plataforma() {
  const v = await getPlatformViewCached(getDb(), new Date());
  const card = "rounded-sm border border-border bg-white p-4";
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm">
        <Link className="text-red-text underline" href="/bastidores/como-funciona">
          ← Como funciona
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-ink">Visão da plataforma</h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        O que o iFood acompanharia, medido nos restaurantes que pessoas cadastraram neste protótipo (fora: vitrine, demonstrações, testes automáticos e dados simulados). Amostra pequena: serve para mostrar a métrica, não para concluir.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className={card}>
          <p className="text-sm text-ink-muted">Restaurantes ativados</p>
          <p className="text-3xl font-bold text-ink" data-testid="plat-ativados">
            {v.activated}
          </p>
          <p className="text-xs text-ink-muted">de {v.created} criados</p>
        </div>
        <div className={card}>
          <p className="text-sm text-ink-muted">Divulgando no salão</p>
          <p className="text-3xl font-bold text-ink">{v.divulgandoPct === null ? "—" : `${v.divulgandoPct}%`}</p>
          <p className="text-xs text-ink-muted">
            ativados com leitura de QR nos últimos 7 dias; {v.divulgandoCriadosPct === null ? "—" : `${v.divulgandoCriadosPct}%`} dos criados. Não é comparável direto com os 20% do briefing (lá, sobre todos os restaurantes com salão).
          </p>
        </div>
        <div className={card}>
          <p className="text-sm text-ink-muted">Novos usuários do Comer Fora vindos do salão</p>
          <p className="text-3xl font-bold text-ink">{v.newUsers30d}</p>
          <p className="text-xs text-ink-muted">1º check-in da vida por uma peça, últ. 30 dias</p>
        </div>
        <div className={card}>
          <p className="text-sm text-ink-muted">Tempo até ativar (mediana)</p>
          <p className="text-3xl font-bold text-ink">{v.medianActivationMin === null ? "—" : duration(v.medianActivationMin)}</p>
        </div>
        <div className={card}>
          <p className="text-sm text-ink-muted">Custo de IA por restaurante ativado</p>
          <p className="text-3xl font-bold text-ink">{v.aiCostPerActivatedUsd === null ? "—" : usd(v.aiCostPerActivatedUsd)}</p>
          <p className="text-xs text-ink-muted">total: {usd(v.aiCostTotalUsd)}</p>
        </div>
      </div>

      <section className={`${card} mt-4`} aria-labelledby="abandono">
        <h2 id="abandono" className="text-base font-bold text-ink">
          Abandono por passo do assistente (hipótese H5)
        </h2>
        {v.funnel.length === 0 ? (
          <p className="mt-2 text-sm text-ink">Ninguém passou pelo assistente ainda.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th scope="col" className="font-normal">Passo</th>
                <th scope="col" className="font-normal">Entraram</th>
                <th scope="col" className="font-normal">Concluíram</th>
              </tr>
            </thead>
            <tbody>
              {v.funnel.map((f) => (
                <tr key={f.step} className="border-t border-divider">
                  <td className="py-1">{STEP[f.step] ?? `Passo ${f.step}`}</td>
                  <td>{f.entered}</td>
                  <td>{f.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={`${card} mt-4`} aria-labelledby="bolso">
        <h2 id="bolso" className="text-base font-bold text-ink">
          Conta de bolso [hipótese]
        </h2>
        <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-ink">
          <li>Briefing (números fictícios do case): 400 mil restaurantes parceiros, 75% só delivery → ~100 mil com salão [interpretação nossa]; 20% divulgam o Comer Fora no salão (~20 mil).</li>
          <li>Hipótese: se a ativação proposta levar a divulgação de 20% para 30% dos restaurantes com salão, são ~10 mil restaurantes a mais divulgando.</li>
          <li>Meta do briefing: 2,5 → 5 milhões de usuários ativos até 2028 (gap de 2,5 mi). Para o salão cobrir metade do gap com esses ~10 mil restaurantes, cada um precisaria trazer ~125 novos usuários por ano (≈ 2–3 por semana). É esse o número que o piloto testa; aqui ele aparece no card &quot;Novos usuários&quot; acima.</li>
          <li>Custo de IA medido neste protótipo por restaurante ativado: {v.aiCostPerActivatedUsd === null ? "ainda sem dados" : usd(v.aiCostPerActivatedUsd)} (uma vez, na ativação, mais cerca de US$ 0,002 por plano semanal). O custo do benefício é do restaurante e é limitado pelo teto semanal.</li>
        </ul>
      </section>
    </main>
  );
}
