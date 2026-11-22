"use client";

import { Select } from "../components/Select";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardView } from "@/src/modules/analytics/application/dashboard";
import type { Incremental } from "@/src/modules/analytics/domain/incremental";
import type { Period } from "@/src/modules/analytics/domain/funnel";
import { marginState } from "@/src/modules/analytics/domain/value";
import { crossZeroMoneyText } from "@/src/modules/analytics/domain/value-text";
import { brl, int, pct, signed, weekLabel } from "./format";
import { RecentCheckins } from "./RecentCheckins";
import { SlotGoals } from "./SlotGoals";
import { TodayFeed } from "./TodayFeed";
import { ValueHero } from "./ValueHero";

/** Visão geral (planejamento S3 §4.2). Funil a cada 3 s (aba visível); métrica e cartões a cada 60 s. */
export function Dashboard({ initial }: { initial: DashboardView }) {
  const [d, setD] = useState(initial);
  const [funnel, setFunnel] = useState(initial.funnel);
  const [period, setPeriod] = useState<Period>(initial.funnel.period);
  const [variant, setVariant] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [stale, setStale] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const qs = useCallback(() => `periodo=${period}${variant ? `&peca=${variant}` : ""}`, [period, variant]);
  const lastFull = useRef(0);

  useEffect(() => {
    let alive = true;
    if (!lastFull.current) lastFull.current = Date.now();
    let inflight = false;
    const run = async () => {
      // Uma consulta por vez (revisão técnica S3): resposta lenta não empilha outras nem chega fora de ordem.
      if (document.visibilityState !== "visible" || inflight) return;
      inflight = true;
      try {
        const full = Date.now() - lastFull.current > 60_000;
        if (full) lastFull.current = Date.now();
        const res = await fetch(`/api/parceiro/painel/${full ? "resumo" : "funil"}?${qs()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        if (!alive) return;
        if (full) {
          setD(j);
          setFunnel(j.funnel);
        } else setFunnel(j);
        setUpdatedAt(Date.now());
        setStale(false);
      } catch {
        if (alive) setStale(true);
      } finally {
        inflight = false;
      }
    };
    void run();
    const t = setInterval(run, 3_000);
    const c = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(c);
    };
  }, [qs]);

  const ago = nowMs ? Math.max(0, Math.round((nowMs - updatedAt) / 1000)) : 0;
  const isTest = d.restaurant.kind === "teste";
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {d.value ? <ValueHero topline={d.value.topline} /> : <MetricHero d={d} showMoney />}
        <div className="flex flex-col gap-3">
          <div className="rounded-sm border border-border bg-white p-4">
            <p className="text-sm text-ink-muted">Clientes que conheceram o Comer Fora no seu salão · últ. 30 dias</p>
            <p className="text-3xl font-bold text-ink">{int(d.newUsers30d)}</p>
            <p className="text-xs text-ink-muted">1º check-in no Comer Fora, feito aqui pelo QR de uma peça do kit.</p>
          </div>
          <Link href="/parceiro/salao/validar" className="flex min-h-11 items-center justify-center rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text hover:bg-red-text/5">
            Validar código
          </Link>
          <PlanCard plan={d.plan} />
        </div>
      </div>

      {d.value && (
        <>
          <SlotGoals goals={d.value.goals} />
          <MetricHero d={d} />
        </>
      )}

      <section aria-labelledby="funil" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="funil" className="text-lg font-bold text-ink">
            Funil do salão
          </h2>
          <p className="text-xs text-ink-muted" aria-live="off">
            {stale ? "Atualizando…" : `Atualizado há ${ago} s`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted" id="periodo-label">
            Período:
          </span>
          <div role="radiogroup" aria-labelledby="periodo-label" className="flex flex-wrap gap-2">
            {(
              [
                ["hoje", "Hoje"],
                ["7d", "Últ. 7 dias"],
                ["30d", "Últ. 30 dias"],
              ] as const
            ).map(([p, label]) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                onClick={() => setPeriod(p)}
                className={`min-h-11 rounded-full px-4 text-sm font-semibold sm:min-h-8 ${period === p ? "bg-red-button text-white" : "border border-border bg-white text-ink-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {funnel.variants.length > 0 && (
            <Select
              label="Peça"
              className="ml-auto flex-row items-center gap-2"
              labelClassName="text-sm text-ink-muted"
              triggerClassName="w-auto sm:min-h-8"
              value={variant}
              options={[{ value: "", label: "Todas" }, ...funnel.variants.map((v) => ({ value: v.id, label: v.label }))]}
              onChange={setVariant}
            />
          )}
        </div>
        <FunnelBars steps={funnel.steps} />
        <p className="text-sm text-ink-muted">
          Fora do funil: {int(funnel.side.invitesReactivation)} {funnel.side.invitesReactivation === 1 ? "convite enviado" : "convites enviados"} ao aprovar o plano da semana ·{" "}
          {int(funnel.side.firstVisitValidated)} {funnel.side.firstVisitValidated === 1 ? "benefício de 1ª visita entregue" : "benefícios de 1ª visita entregues"} (código validado)
        </p>
      </section>

      {funnel.feed ? <TodayFeed feed={funnel.feed} /> : <RecentCheckins list={funnel.recent ?? []} />}

      <Cards d={d} />
      {isTest && (
        <p className="text-xs text-ink-muted">Os números aparecem conforme os clientes fazem check-in.</p>
      )}
    </div>
  );
}

const STATE_TEXT: Record<Incremental["state"], string> = {
  positivo: "Quem recebeu convite voltou mais do que o grupo sem convite",
  negativo: "Quem recebeu convite voltou menos do que o grupo sem convite. Vale trocar a oferta no plano da semana",
  inconclusivo: "Ainda não dá para dizer se os convites trouxeram gente a mais: a diferença ainda pode ser acaso",
  amostra_insuficiente: "Ainda não dá para afirmar",
};

/** Diferença por cliente → visitas a cada 100 convidados (auditoria do Portal 1.4: "+0,12 visita" ninguém visualiza). */
const per100 = (x: number) => Math.round(x * 100);
const visits100 = (x: number) => `${signed(per100(x), 0)} ${Math.abs(per100(x)) === 1 ? "visita" : "visitas"}`;

function missingText(m: DashboardView["metric"]["missing"]): string {
  const parts = [
    m.controle > 0 ? `${int(m.controle)} ${m.controle === 1 ? "cliente sem convite" : "clientes sem convite"}` : null,
    m.convidados > 0 ? `${int(m.convidados)} ${m.convidados === 1 ? "cliente com convite" : "clientes com convite"}` : null,
  ].filter(Boolean);
  return parts.length ? `Para medir, faltam ${parts.join(" e ")} acompanhados por 14 dias.` : "Para medir, faltam clientes acompanhados por 14 dias.";
}

/** R$ da medida causal: só aparece aqui quando não há o topo em R$ (sem `painel_valor`); texto pelo estado da margem (A5). */
function moneyText(d: DashboardView): string {
  const { inc, margin } = d.metric;
  if (!d.metric.marginDeclared) return "Informe ticket médio e margem em Configurações › Restaurante para ver o resultado em reais.";
  if (!margin || (inc.state !== "positivo" && inc.state !== "negativo")) return "O resultado em reais aparece quando houver resultado nas visitas.";
  const range = `entre ${brl(margin.lo)} e ${brl(margin.hi)}`;
  const st = marginState(margin);
  if (st === "positiva") return `≈ ${brl(margin.cents)} de margem a mais, já descontado o custo dos convites (pode ficar ${range}). Conta feita com o ticket e a margem que você informou.`;
  if (st === "negativa") return `Os convites custaram ≈ ${brl(Math.abs(margin.cents))} a mais do que renderam de margem (${range}). Conta feita com o ticket e a margem que você informou.`;
  return `${crossZeroMoneyText(brl(margin.lo), brl(margin.hi))} Conta feita com o ticket e a margem que você informou.`;
}

function MetricHero({ d, showMoney = false }: { d: DashboardView; showMoney?: boolean }) {
  const { inc } = d.metric;
  const has = inc.state !== "amostra_insuficiente";
  return (
    <section aria-labelledby="metrica" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="metrica" className="text-base font-semibold text-ink">
          Visitas a mais de quem recebeu convite (14 dias)
        </h2>
      </div>
      {has ? (
        <>
          <p className={inc.state === "inconclusivo" ? "text-xl font-semibold text-ink" : "text-3xl font-bold text-ink"}>
            {visits100(inc.diff)} a cada 100 convidados
            <span className="block text-base font-normal text-ink-muted">
              provavelmente entre {signed(per100(inc.lo), 0)} e {signed(per100(inc.hi), 0)}
              {d.metric.totalExtra !== null && inc.state === "positivo" ? ` · ≈ ${int(d.metric.totalExtra)} visitas a mais no total, entre ${int(inc.nT)} clientes com convite` : ""}
              {" "}(cada cliente acompanhado por 14 dias)
            </span>
          </p>
          <p className="font-semibold text-ink" data-testid="metric-state" data-state={inc.state}>
            {STATE_TEXT[inc.state]}
          </p>
        </>
      ) : (
        <p className="font-semibold text-ink" data-testid="metric-state" data-state={inc.state}>
          Ainda não dá para afirmar. {missingText(d.metric.missing)} Enquanto isso, veja os sinais iniciais abaixo.
        </p>
      )}
      {showMoney && <p className="text-sm text-ink">{moneyText(d)}</p>}
      <p className="text-sm text-ink-muted">1 em cada 10 clientes fica sem convite, por sorteio, para comparar. Contamos as visitas com check-in.</p>
      <details className="text-sm text-ink-muted">
        <summary className="inline-flex min-h-6 cursor-pointer items-center">Como medimos</summary>
        <ul className="mt-2 list-disc pl-5">
          <li>Comparamos quem recebeu convite com o grupo de controle: clientes sorteados (1 em 10) que não recebem convite.</li>
          <li>Positivo: o intervalo inteiro fica acima de zero.</li>
          <li>Negativo: o intervalo inteiro fica abaixo de zero.</li>
          <li>Ainda não dá para afirmar: o intervalo cruza o zero.</li>
          <li>Poucos dados: menos de 30 clientes em um dos grupos com 14 dias completos.</li>
          <li>Quem não faz check-in não aparece: medimos visitas registradas, não todas as visitas.</li>
        </ul>
      </details>
    </section>
  );
}

const PLAN_TEXT: Record<string, string> = { proposto: "Sugerido · esperando sua aprovação", aprovado: "Aprovado nesta semana", vencido: "O plano da semana passada venceu", gerando: "Gerando…" };
/** CTA pelo estado (auditoria do Portal 1.2): diz o que acontece ao clicar. */
const PLAN_CTA: Record<string, string> = { proposto: "Revisar e aprovar", aprovado: "Ver o plano", vencido: "Gerar o plano da semana", gerando: "Ver o plano" };

function PlanCard({ plan }: { plan: DashboardView["plan"] }) {
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border bg-white p-4">
      <p className="text-sm text-ink-muted">Plano da semana</p>
      <p className="font-semibold text-ink">{plan ? PLAN_TEXT[plan.status] ?? plan.status : "Nenhum plano ainda"}</p>
      <Link href="/parceiro/salao/plano" className="flex min-h-11 items-center justify-center rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text hover:bg-red-text/5">
        {plan ? PLAN_CTA[plan.status] ?? "Ver o plano" : "Gerar o plano da semana"}
      </Link>
    </div>
  );
}

function FunnelBars({ steps }: { steps: DashboardView["funnel"]["steps"] }) {
  // Duas escalas (revisão de produto S3): "Do QR ao contato" e "Convite de volta" têm ordens de grandeza diferentes;
  // numa escala só, as barras do convite (o diferencial) sumiam.
  const GROUP2 = new Set(["convites", "voltaram", "validados"]);
  const max1 = Math.max(1, ...steps.filter((s) => !GROUP2.has(s.key)).map((s) => s.value));
  const max2 = Math.max(1, ...steps.filter((s) => GROUP2.has(s.key)).map((s) => s.value));
  const maxOf = (k: string) => (GROUP2.has(k) ? max2 : max1);
  return (
    <>
      <div className="hidden grid-cols-6 gap-2 text-xs font-semibold text-ink-muted sm:grid" aria-hidden="true">
        <p className="col-span-3 border-b border-divider pb-1">Do QR ao cliente novo</p>
        <p className="col-span-3 border-b border-divider pb-1">Convite de volta (barras em outra escala)</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-6" aria-hidden="true">
        {steps.map((s) => (
          <li key={s.key} className={`flex flex-row items-center gap-3 sm:flex-col sm:items-stretch ${s.key === "convites" ? "max-sm:mt-3 max-sm:border-t max-sm:border-divider max-sm:pt-3" : ""}`}>
            <div className="w-40 shrink-0 sm:min-h-16 sm:w-auto">
              <p className="text-xs text-ink-muted">{s.label}</p>
              <p className="text-lg font-bold text-ink" data-testid={`funil-${s.key}`}>
                {int(s.value)}
                {s.pctOfPrev !== null && <span className="ml-1 text-xs font-normal text-ink-muted">({s.pctOfPrev}%)</span>}
              </p>
            </div>
            {/* 390 px: barra horizontal; a partir de 640 px: coluna (padrão "Conversão do cardápio", portal/05). */}
            <div className="flex h-4 flex-1 items-stretch rounded-xs bg-surface-muted sm:h-24 sm:w-full sm:flex-none sm:items-end">
              <div className="rounded-xs bg-red-chart sm:hidden" style={{ width: `${Math.max(1, (100 * s.value) / maxOf(s.key))}%` }} />
              <div className="hidden w-full rounded-xs bg-red-chart sm:block" style={{ height: `${Math.max(2, (100 * s.value) / maxOf(s.key))}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <div className="sr-only">
      <table>
        <caption>Funil do salão</caption>
        <thead>
          <tr>
            <th scope="col">Etapa</th>
            <th scope="col">Quantidade</th>
            <th scope="col">% da etapa anterior</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.key}>
              <th scope="row">{s.label}</th>
              <td>{s.value}</td>
              <td>{s.pctOfPrev === null ? "—" : `${s.pctOfPrev}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

function controlText(i: Incremental, kind: "idle" | "migration"): string {
  if (i.state === "amostra_insuficiente") return "Poucos dados · ainda não dá para afirmar";
  if (kind === "migration") {
    if (i.state === "negativo") return `Quem recebeu convite veio menos fora do horário vazio (${visits100(i.diff)} a cada 100): parte do efeito pode ser cliente que trocou de horário`;
    if (i.state === "positivo") return `Não: quem recebeu convite veio mais também fora do horário vazio (${visits100(i.diff)} a cada 100)`;
    return "Não deu para ver diferença fora do horário vazio";
  }
  return i.state === "positivo" || i.state === "negativo" ? `${visits100(i.diff)} no horário vazio a cada 100 convidados` : "Ainda não dá para afirmar";
}

function Cards({ d }: { d: DashboardView }) {
  const m = d.metric;
  const range = (i: Incremental) => (i.state === "amostra_insuficiente" ? "" : `entre ${signed(per100(i.lo), 0)} e ${signed(per100(i.hi), 0)} a cada 100`);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="controle" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
        <h2 id="controle" className="text-base font-bold text-ink">
          Comparado ao grupo sem convite
        </h2>
        <div>
          <p className="text-sm text-ink-muted">Visitas no horário vazio</p>
          <p className="font-semibold text-ink">{controlText(m.idle, "idle")}</p>
          <p className="text-xs text-ink-muted">{range(m.idle)}</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted">O convite tirou cliente de outro horário?</p>
          <p className="font-semibold text-ink">{controlText(m.migration, "migration")}</p>
          <p className="text-xs text-ink-muted">{range(m.migration)}</p>
        </div>
      </section>
      <section aria-labelledby="antecipados" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
        <h2 id="antecipados" className="text-base font-bold text-ink">
          Sinais iniciais <span className="text-sm font-normal text-ink-muted">· ainda não provam efeito</span>
        </h2>
        <div>
          <p className="text-sm text-ink-muted">Convites usados por semana de entrega</p>
          {d.cards.cohorts.length === 0 ? (
            <p className="text-sm text-ink">Nenhum convite entregue ainda.</p>
          ) : (
            <table className="mt-1 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th scope="col" className="font-normal">
                    Semana
                  </th>
                  <th scope="col" className="font-normal">
                    Entregues
                  </th>
                  <th scope="col" className="font-normal">
                    Usados em 14 dias
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.cards.cohorts.map((c) => (
                  <tr key={c.weekKey}>
                    <td>{weekLabel(c.weekKey)}</td>
                    <td>{int(c.issued)}</td>
                    <td>
                      {int(c.used)} ({pct(c.pct)})
                      {c.open ? <span className="text-xs text-ink-muted"> (ainda contando)</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-muted">Custo médio por convite entregue</dt>
            <dd className="font-semibold text-ink">{d.cards.costPerInviteCents === null ? "—" : brl(d.cards.costPerInviteCents)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Custo do benefício de 1ª visita por cliente novo</dt>
            <dd className="font-semibold text-ink">{d.cards.costPerIdentifiedCents === null ? "—" : brl(d.cards.costPerIdentifiedCents)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Quanto da margem vai para benefícios</dt>
            <dd className="font-semibold text-ink">{d.cards.costOverMarginPct === null ? "Informe ticket e margem" : `${d.cards.costOverMarginPct}%`}</dd>
          </div>
        </dl>
        <p className="text-xs text-ink-muted">Custos dos últimos 30 dias. A margem usa o ticket e a margem que você informou.</p>
      </section>
    </div>
  );
}
