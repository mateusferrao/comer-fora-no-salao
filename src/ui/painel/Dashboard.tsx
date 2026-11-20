"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardView } from "@/src/modules/analytics/application/dashboard";
import type { Incremental } from "@/src/modules/analytics/domain/incremental";
import type { Period } from "@/src/modules/analytics/domain/funnel";
import { Badge } from "../components/Badge";
import { brl, int, pct, signed, weekLabel } from "./format";

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
        <MetricHero d={d} />
        <div className="flex flex-col gap-3">
          <div className="rounded-sm border border-border bg-white p-4">
            <p className="text-sm text-ink-muted">Novos usuários do Comer Fora · últ. 30 dias</p>
            <p className="text-3xl font-bold text-ink">{int(d.newUsers30d)}</p>
            <p className="text-xs text-ink-muted">1º check-in da vida aqui, vindo de uma peça do kit.</p>
          </div>
          <Link href="/parceiro/salao/validar" className="flex min-h-11 items-center justify-center rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text hover:bg-red-text/5">
            Validar código
          </Link>
          <PlanCard plan={d.plan} />
        </div>
      </div>

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
                ["7d", "Últ. 7 dias"],
                ["30d", "Últ. 30 dias"],
                ["hoje", "Hoje"],
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
            <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
              Peça
              <select value={variant} onChange={(e) => setVariant(e.target.value)} className="min-h-11 rounded-xs border border-border bg-white px-2 text-sm text-ink sm:min-h-8">
                <option value="">Todas</option>
                {funnel.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <FunnelBars steps={funnel.steps} />
        <p className="text-sm text-ink-muted">
          + {int(funnel.side.invitesReactivation)} convites por reativação · {int(funnel.side.firstVisitValidated)} códigos de 1ª visita validados
        </p>
      </section>

      <Cards d={d} />
      {isTest && !d.restaurant.simulated && (
        <p className="text-xs text-ink-muted">Os números aparecem conforme os clientes fazem check-in. Para ver o painel cheio, use &quot;Simular 30 dias&quot;.</p>
      )}
    </div>
  );
}

const STATE_TEXT: Record<Incremental["state"], string> = {
  positivo: "Os convidados voltaram mais que o grupo de controle",
  negativo: "Os convidados voltaram menos que o grupo de controle. Reveja a oferta no plano da semana",
  inconclusivo: "Ainda não dá para afirmar",
  amostra_insuficiente: "Ainda não dá para afirmar",
};

function MetricHero({ d }: { d: DashboardView }) {
  const { inc, margin } = d.metric;
  const has = inc.state !== "amostra_insuficiente";
  return (
    <section aria-labelledby="metrica" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="metrica" className="text-base font-semibold text-ink">
          Visitas registradas a mais por cliente convidado (14 dias)
        </h2>
        {d.restaurant.simulated && (
          <Badge tone="neutral">
            Dados simulados · efeito programado: +0,20 visita ·{" "}
            <Link className="underline" href="/bastidores/como-funciona">
              Como funciona
            </Link>
          </Badge>
        )}
      </div>
      {has ? (
        <>
          <p className={inc.state === "inconclusivo" ? "text-xl font-semibold text-ink" : "text-3xl font-bold text-ink"}>
            {signed(inc.diff)} visita por cliente
            <span className="block text-base font-normal text-ink-muted">
              provavelmente entre {signed(inc.lo)} e {signed(inc.hi)}
              {d.metric.totalExtra !== null && inc.state === "positivo" ? ` · ≈ ${int(d.metric.totalExtra)} visitas a mais entre ${int(inc.nT)} convidados` : ""}
              {" "}(cada cliente acompanhado por 14 dias depois do sorteio)
            </span>
          </p>
          <p className="font-semibold text-ink" data-testid="metric-state" data-state={inc.state}>
            {STATE_TEXT[inc.state]}
          </p>
        </>
      ) : (
        <p className="font-semibold text-ink" data-testid="metric-state" data-state={inc.state}>
          Ainda não dá para afirmar: faltam {int(d.metric.missingHoldout)} clientes do grupo de controle com 14 dias completos. Enquanto isso, acompanhe os indicadores antecipados.
        </p>
      )}
      <p className="text-sm text-ink">
        {!d.metric.marginDeclared
          ? "Declare ticket e margem em Configurações para ver a margem."
          : margin && (inc.state === "positivo" || inc.state === "negativo")
            ? inc.state === "negativo"
              ? `≈ entre ${brl(Math.abs(margin.hi))} e ${brl(Math.abs(margin.lo))} de margem a menos (estimativa, com base nos valores que você declarou).`
              : `≈ entre ${brl(margin.lo)} e ${brl(margin.hi)} de margem a mais (estimativa, com base nos valores que você declarou).`
            : "A margem aparece quando houver resultado."}
      </p>
      <p className="text-sm text-ink-muted">Visitas registradas = check-ins. Comparamos por sorteio com um grupo de controle (1 em 10) que não recebe convite.</p>
      <details className="text-sm text-ink-muted">
        <summary className="inline-flex min-h-6 cursor-pointer items-center">Como medimos</summary>
        <ul className="mt-2 list-disc pl-5">
          <li>Positivo: o intervalo inteiro fica acima de zero.</li>
          <li>Negativo: o intervalo inteiro fica abaixo de zero.</li>
          <li>Ainda não dá para afirmar: o intervalo cruza o zero.</li>
          <li>Amostra insuficiente: menos de 30 clientes num dos grupos com 14 dias completos.</li>
          <li>Quem não faz check-in não aparece: medimos visitas registradas, não todas as visitas.</li>
        </ul>
      </details>
    </section>
  );
}

const PLAN_TEXT: Record<string, string> = { proposto: "Proposto · aguardando você", aprovado: "Aprovado nesta semana", vencido: "Vencido · gere o desta semana", gerando: "Gerando…" };

function PlanCard({ plan }: { plan: DashboardView["plan"] }) {
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border bg-white p-4">
      <p className="text-sm text-ink-muted">Plano da semana</p>
      <p className="font-semibold text-ink">{plan ? PLAN_TEXT[plan.status] ?? plan.status : "Nenhum plano ainda"}</p>
      <Link href="/parceiro/salao/plano" className="flex min-h-11 items-center justify-center rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text hover:bg-red-text/5">
        Revisar plano
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
        <p className="col-span-3 border-b border-divider pb-1">Do QR ao contato</p>
        <p className="col-span-3 border-b border-divider pb-1">Convite de volta (escala própria)</p>
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
  if (i.state === "amostra_insuficiente") return "Amostra insuficiente · ainda não dá para afirmar";
  if (kind === "migration") {
    if (i.state === "negativo") return `Convidados vieram ${signed(i.diff)} visita fora do horário vazio: parte do efeito é troca de horário`;
    if (i.state === "positivo") return `Convidados vieram ${signed(i.diff)} visita também fora do horário vazio`;
    return "Sem sinal de migração: fora do horário vazio, convidados e grupo de controle vieram igual";
  }
  return i.state === "positivo" ? `${signed(i.diff)} visita no horário vazio por convidado` : i.state === "negativo" ? `${signed(i.diff)} visita no horário vazio` : "Ainda não dá para afirmar";
}

function Cards({ d }: { d: DashboardView }) {
  const m = d.metric;
  const range = (i: Incremental) => (i.state === "amostra_insuficiente" ? "" : `entre ${signed(i.lo)} e ${signed(i.hi)}`);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="controle" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
        <h2 id="controle" className="text-base font-bold text-ink">
          Comparado ao grupo de controle
        </h2>
        <div>
          <p className="text-sm text-ink-muted">Visitas no horário vazio</p>
          <p className="font-semibold text-ink">{controlText(m.idle, "idle")}</p>
          <p className="text-xs text-ink-muted">{range(m.idle)}</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted">Proteção contra migração (fora do horário vazio)</p>
          <p className="font-semibold text-ink">{controlText(m.migration, "migration")}</p>
          <p className="text-xs text-ink-muted">{range(m.migration)}</p>
        </div>
      </section>
      <section aria-labelledby="antecipados" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
        <h2 id="antecipados" className="text-base font-bold text-ink">
          Indicadores antecipados <span className="text-sm font-normal text-ink-muted">· não causal</span>
        </h2>
        <div>
          <p className="text-sm text-ink-muted">Convites usados por semana de emissão</p>
          {d.cards.cohorts.length === 0 ? (
            <p className="text-sm text-ink">Nenhum convite emitido ainda.</p>
          ) : (
            <table className="mt-1 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th scope="col" className="font-normal">
                    Semana
                  </th>
                  <th scope="col" className="font-normal">
                    Emitidos
                  </th>
                  <th scope="col" className="font-normal">
                    Usados
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.cards.cohorts.map((c) => (
                  <tr key={c.weekKey}>
                    <td>{weekLabel(c.weekKey)}</td>
                    <td>{int(c.issued)}</td>
                    <td>
                      {pct(c.pct)}
                      {c.open ? <span className="text-xs text-ink-muted"> (em aberto)</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-muted">Custo por convite emitido</dt>
            <dd className="font-semibold text-ink">{d.cards.costPerInviteCents === null ? "—" : brl(d.cards.costPerInviteCents)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Custo por cliente identificado</dt>
            <dd className="font-semibold text-ink">{d.cards.costPerIdentifiedCents === null ? "—" : brl(d.cards.costPerIdentifiedCents)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Custo × margem das visitas</dt>
            <dd className="font-semibold text-ink">{d.cards.costOverMarginPct === null ? "Declare ticket e margem" : `${d.cards.costOverMarginPct}%`}</dd>
          </div>
        </dl>
        <p className="text-xs text-ink-muted">Estimativa, com base nos valores que você declarou. Últimos 30 dias.</p>
      </section>
    </div>
  );
}
