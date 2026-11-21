"use client";

import {
  inviteIssues,
  reasonMessage,
} from "@/src/modules/ia/guardrails/messages";
import { confirmDialog } from "../components/ConfirmDialog";
import { Select } from "../components/Select";
import { ExplainOfferLink } from "@/src/ui/ia/ExplainOffer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PlanView } from "@/src/modules/planos/application/plan-view";
import { Badge } from "../components/Badge";
import { brl, int, weekLabel } from "./format";

const VERDICT: Record<string, { label: string; tone: "green" | "red" | "neutral" }> = {
  manter: { label: "Manter", tone: "green" },
  trocar: { label: "Trocar", tone: "neutral" },
  cedo_demais: { label: "Cedo demais", tone: "neutral" },
};
const ORIGIN: Record<string, string> = { ia: "Gerado pela IA", sem_ia: "Texto modelo (sem IA)", fixo: "Plano pronto do restaurante de exemplo (escrito antes, sem IA ao vivo)" };
const SEM_IA: Record<string, string> = { sem_chave: "IA desligada neste ambiente", timeout: "a IA demorou demais", unavailable: "a IA ficou indisponível", invalid: "a IA não respondeu no formato combinado", sem_candidatas: "faltam ofertas válidas no cardápio", limite: "limite diário de IA" };
const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WD_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const TURN: Record<string, string> = { almoco: "Almoço", tarde: "Tarde", noite: "Noite" };
const REASONS = [
  ["ofertas", "Ofertas não servem"],
  ["teto", "Teto alto demais"],
  ["manter", "Prefiro manter o atual"],
  ["outro", "Outro"],
] as const;

type Edit = { optionId: string; cap: number; text: string };

/** O dono edita `{horario}` (a faixa do próprio cartão), não o id; volta ao formato com id ao aprovar. */
const friendly = (t: string, slotId: string) => t.replaceAll(`{horario:${slotId}}`, "{horario}");
const stored = (t: string, slotId: string) => t.replaceAll("{horario}", `{horario:${slotId}}`);
const editsOf = (v: PlanView): Record<string, Edit> => Object.fromEntries(v.slots.map((s) => [s.slotId, { optionId: s.chosenId ?? s.options[0]?.id ?? "", cap: s.weeklyCap, text: friendly(s.inviteText, s.slotId) }]));

export function PlanManager({ initial, explicaIa = false }: { initial: PlanView; explicaIa?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [edits, setEdits] = useState<Record<string, Edit>>(() => editsOf(initial));
  const [busy, setBusy] = useState<"" | "gerar" | "aprovar" | "descartar">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0] | "">("");
  const [reasonText, setReasonText] = useState("");

  // Enquanto gera (ou o revisor confere), consulta até ficar pronto.
  const reviewing = v.plan?.review?.status === "revisando";
  useEffect(() => {
    if (!v.generating && !reviewing) return;
    const t = setInterval(async () => {
      const r = await fetch("/api/parceiro/plano/ver", { cache: "no-store" }).catch(() => null);
      if (!r?.ok) return;
      const j = (await r.json()) as PlanView;
      if (!j.generating && j.plan?.review?.status !== "revisando") {
        setV(j);
        if (!reviewing) setEdits(editsOf(j));
      }
    }, 2_000);
    return () => clearInterval(t);
  }, [v.generating, reviewing]);

  const reload = async () => {
    const r = await fetch("/api/parceiro/plano/ver", { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as PlanView;
      setV(j);
      setEdits(editsOf(j));
    }
    router.refresh();
  };

  const generate = async () => {
    if (busy) return;
    if (
      v.plan?.status === "proposto" &&
      !(await confirmDialog({
        title: "Gerar o plano de novo?",
        body: "A proposta atual é substituída por uma nova.",
        confirmLabel: "Gerar de novo",
      }))
    )
      return;
    if (
      v.plan?.status === "aprovado" &&
      v.plan.currentWeek &&
      !(await confirmDialog({
        title: "Gerar um novo plano?",
        body: "Já há um plano aprovado nesta semana. O novo, se você aprovar, substitui a regra a partir de agora.",
        confirmLabel: "Gerar novo plano",
      }))
    )
      return;
    setBusy("gerar");
    setMsg(null);
    setV((x) => ({ ...x, generating: true }));
    const r = await fetch("/api/parceiro/plano/gerar", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) {
      setV((x) => ({ ...x, generating: false }));
      setMsg({ kind: "erro", text: j.erro === "limite" ? "Você gerou muitos planos hoje. Tente amanhã." : j.erro === "gerando" ? "Já estamos gerando um plano. Aguarde." : "Não deu para gerar agora. Tente de novo." });
      return;
    }
    await reload();
  };

  const approve = async () => {
    if (busy || !v.plan) return;
    setBusy("aprovar");
    setMsg(null);
    const final = {
      slots: v.slots.map((s) => {
        const e = edits[s.slotId]!;
        const o = s.options.find((x) => x.id === e.optionId)!;
        return { slotId: s.slotId, offer: o.offer, weeklyCap: e.cap, inviteText: stored(e.text, s.slotId) };
      }),
    };
    const r = await fetch("/api/parceiro/plano/aprovar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: v.plan.id, final }) });
    const j = await r.json().catch(() => ({}));
    const slotLabel = (id?: string) =>
      v.slots.find((x) => x.slotId === id)?.label ?? "um horário";
    setBusy("");
    if (!r.ok) {
      setMsg({
        kind: "erro",
        text:
          j.erro === "revisor"
            ? "O revisor ainda está conferindo ou pediu ajustes nos convites. Veja os motivos acima; se reescrever o convite, você assume o texto."
            : j.erro === "texto"
              ? `Convite de ${slotLabel(j.detalhe?.slotId)}: ${reasonMessage(j.detalhe?.motivos?.[0] ?? "", { maxLen: 160 })}`
              : j.erro === "oferta"
                ? `A oferta do convite de ${slotLabel(j.detalhe?.slotId)} usa um item que saiu do cardápio ou das ofertas. Escolha outra.`
                : "Não deu para aprovar agora. Atualize a página e tente de novo.",
      });
      return;
    }
    setMsg({ kind: "ok", text: `Plano aprovado · convite entregue a ${int(j.sent.real)} clientes em Sua jornada${j.sent.emails ? ` · ${int(j.sent.emails)} também por e-mail` : ""}${j.semEmail ? " · textos com link ou contato não vão por e-mail" : ""}` });
    await reload();
  };

  const discard = async () => {
    if (busy || !v.plan || !reason) return;
    setBusy("descartar");
    const r = await fetch("/api/parceiro/plano/descartar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: v.plan.id, reason, text: reasonText || undefined }) });
    setBusy("");
    setDiscarding(false);
    setMsg(r.ok ? { kind: "ok", text: "Plano descartado. Você pode gerar outro quando quiser." } : { kind: "erro", text: "Não deu para descartar." });
    await reload();
  };

  const p = v.plan;
  const editable = p?.status === "proposto";
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-white p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ink-muted">{p ? `Semana de ${weekLabel(p.weekKey)}` : "Nenhum plano ainda"}</p>
          <p className="font-semibold text-ink" data-testid="plan-status" data-status={v.generating ? "gerando" : (p?.status ?? "nenhum")}>
            {v.generating ? "A IA está escolhendo as ofertas…" : !p ? "Gere o primeiro plano da semana" : p.status === "aprovado" ? (p.stale ? "Vencido · gere o desta semana" : `Aprovado${p.approvedVia === "agente" ? " via agente" : p.approvedVia === "email" ? " pelo e-mail" : ""}`) : p.stale ? "Proposta da semana passada · gere uma nova" : "Proposto · revise e aprove"}
          </p>
          {p && !v.generating && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                <span data-testid="plan-origin" data-origin={p.generatedBy}>
                  {ORIGIN[p.generatedBy]}
                </span>
              </Badge>
              {p.generatedBy === "sem_ia" && p.semIa && <span className="text-xs text-ink-muted">Motivo: {SEM_IA[p.semIa] ?? p.semIa}</span>}
            </div>
          )}
          {/* S6.3b (D194): plano montado pelo agente — 1 linha visível com os passos legíveis. */}
          {p && p.agentSteps.length > 0 && (
            <details className="text-sm text-ink" data-testid="plano-agente">
              <summary className="flex min-h-11 cursor-pointer items-center font-medium">
                Montado por agente de IA · {p.agentSteps.length} {p.agentSteps.length === 1 ? "consulta" : "consultas"} · ver passos
              </summary>
              <ol className="ml-5 list-decimal">
                {p.agentSteps.map((st, i) => (
                  <li key={i}>
                    {st.label} · {(st.ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
        <button type="button" onClick={generate} aria-busy={busy === "gerar" || v.generating || undefined} className="min-h-11 rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text hover:bg-red-text/5">
          {v.generating ? "Gerando…" : "Gerar plano da semana"}
        </button>
      </section>

      {msg && (
        <p role="status" className={`rounded-sm p-3 text-sm ${msg.kind === "ok" ? "bg-surface-muted text-ink" : "border border-red-text text-red-text"}`}>
          {msg.text}
        </p>
      )}

      <Insights v={v} />

      <section aria-labelledby="aprendemos" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
        <h2 id="aprendemos" className="text-lg font-bold text-ink">
          O que aprendemos
        </h2>
        {v.learned.length === 0 ? (
          <p className="text-sm text-ink">Primeira semana: ainda não há o que comparar.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {v.learned.map((l) => (
              <li key={l.ofertaKey} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={VERDICT[l.verdict]?.tone ?? "neutral"}>{VERDICT[l.verdict]?.label ?? l.verdict}</Badge>
                  <span className="text-sm font-semibold text-ink">{l.title}</span>
                </div>
                <p className="text-sm text-ink">{l.texto}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-muted">O veredito é do código, por indicadores antecipados; não é causal.</p>
      </section>

      {p && (
        <section aria-labelledby="proposta" className="flex flex-col gap-4">
          <h2 id="proposta" className="text-lg font-bold text-ink">
            {editable ? "Proposta para esta semana" : "Regra desta semana"}
          </h2>
          {v.slots.map((s) => {
            const e = edits[s.slotId]!;
            const opt = s.options.find((o) => o.id === e.optionId);
            // Mesas ≈ teto × uso observado dos convites (a mesma conta do teto recalibrado); sem uso, 1 em 4.
            const ins = v.insights.offers.find((o) => o.slotId === s.slotId);
            const use = ins?.usage != null ? Math.min(1, Math.max(0.1, ins.usage)) : 0.25;
            const tables = Math.max(1, Math.round(e.cap * use));
            const changed = e.optionId !== s.chosenId;
            // Ajuste de 21/11: mesma regra da aprovação, na hora (só depois de o dono mexer no texto).
            const textIssue =
              editable && stored(e.text, s.slotId) !== s.inviteText
                ? inviteIssues(stored(e.text, s.slotId), {
                    items: Object.fromEntries(
                      v.menu.map((m) => [m.id, m.name]),
                    ),
                    slots: { [s.slotId]: s.label },
                    oferta: opt?.gain ?? "",
                  })
                : { errors: [] as string[], warnings: [] as string[] };
            return (
              <article key={s.slotId} className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4" aria-label={`Convite de volta · ${s.label}`}>
                <h3 className="font-semibold text-ink">Convite de volta · {s.label}</h3>
                <Select
                  label="Oferta"
                  labelClassName="text-sm text-ink"
                  disabled={!editable}
                  value={e.optionId}
                  options={s.options.map((o) => ({ value: o.id, label: o.gain, hint: `${o.title} · custo ${brl(o.unitCostCents)}${o.isTop ? " · melhor nota" : ""}` }))}
                  onChange={(v) => setEdits((x) => ({ ...x, [s.slotId]: { ...e, optionId: v } }))}
                />
                <div className="flex flex-wrap items-end gap-4">
                  <label className="flex flex-col gap-1 text-sm text-ink">
                    Teto semanal de convites
                    <input disabled={!editable} type="number" min={1} max={999} inputMode="numeric" value={e.cap} onChange={(ev) => setEdits((x) => ({ ...x, [s.slotId]: { ...e, cap: Math.max(1, Math.min(999, Number(ev.target.value) || 1)) } }))} className="min-h-11 w-28 rounded-xs border border-border px-2" />
                  </label>
                  <p className="text-sm text-ink-muted">
                    até {int(e.cap)} convites/semana ≈ {int(tables)} {tables === 1 ? "mesa" : "mesas"} ({ins?.usage != null ? `com o uso de ${Math.round(100 * ins.usage)}% dos convites` : "supondo 1 em 4 convites usado"}) · custo máximo {opt ? brl(opt.unitCostCents * e.cap) : "—"} · esperado ≈ {opt ? brl(Math.round(opt.unitCostCents * e.cap * use)) : "—"}
                  </p>
                  {ins && ins.recalibratedCap !== e.cap && <p className="text-xs text-ink-muted">Teto sugerido pelo uso real: {int(ins.recalibratedCap)}/semana.</p>}
                </div>
                <label className="flex flex-col gap-1 text-sm text-ink">
                  Texto do convite (aparece no 2º card do cliente)
                  <textarea
                    id={`texto-${s.slotId}`}
                    disabled={!editable}
                    maxLength={300}
                    rows={2}
                    value={e.text}
                    onChange={(ev) =>
                      setEdits((x) => ({
                        ...x,
                        [s.slotId]: { ...e, text: ev.target.value },
                      }))
                    }
                    aria-invalid={textIssue.errors.length > 0 || undefined}
                    aria-describedby={`aviso-${s.slotId}`}
                    className={`rounded-xs border p-2 ${textIssue.errors.length ? "border-red-text" : "border-border"}`}
                  />
                </label>
                <div
                  id={`aviso-${s.slotId}`}
                  className="flex flex-col gap-1 text-xs"
                >
                  {textIssue.errors.map((m) => (
                    <p key={m} className="font-medium text-red-text">
                      {m}
                    </p>
                  ))}
                  {textIssue.warnings.map((m) => (
                    <p key={m} className="text-ink">
                      Atenção: {m}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-ink-muted">
                  Use {"{horario}"} e {"{oferta}"}: o sistema escreve o dia, o
                  horário e a oferta.
                </p>
                {stored(e.text, s.slotId) === s.inviteText &&
                  s.inviteRendered && (
                    <p className="text-sm text-ink-muted">
                      Como o cliente lê: “{s.inviteRendered}”
                    </p>
                  )}
                {ins?.verdict === "trocar" && s.options.length === 1 && (
                  <p className="rounded-xs bg-surface-muted p-2 text-sm text-ink" data-testid="sem-alternativa">
                    Sem outra oferta válida no cardápio para este horário: mantida, apesar do veredito &quot;trocar&quot;. Para ter alternativas, ative ou inclua um item compatível em Configurações.
                  </p>
                )}
                {s.justificativa && (
                  <p className="text-sm text-ink">
                    <span className="font-semibold">{changed ? "Por quê (da opção sugerida, não da que você escolheu): " : "Por quê: "}</span>
                    {s.justificativa}
                  </p>
                )}
                {explicaIa && v.plan && <ExplainOfferLink planId={v.plan.id} slotId={s.slotId} />}
              </article>
            );
          })}
        </section>
      )}

      {p && editable && (
        <section aria-labelledby="reativacao" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="reativacao" className="text-lg font-bold text-ink">
              Reativação
            </h2>
          </div>
          <p className="text-sm text-ink" data-testid="reativacao-previa">
            Vai para {int(v.reactivation.audience)} clientes com opt-in (1 visita e sumiu: {int(v.reactivation.bySegment.sumiu)}; perto da recompensa: {int(v.reactivation.bySegment.perto)}).{" "}
            {v.reactivation.quota.map((q) => (q.use > 0 ? `Usa até ${int(q.use)} dos ${int(q.free)} convites livres desta semana em ${q.slotLabel}; sobram ${int(Math.max(0, q.left))} para quem fizer check-in na mesa.` : `${q.slotLabel}: não usa convites desta vez.`)).join(" ")} Para medir o efeito, 1 em cada 10 não recebe (grupo de controle).
          </p>
          {v.slots[0] && (
            <div className="max-w-sm rounded-md bg-surface-muted p-3 text-sm text-ink">
              <p className="text-xs text-ink-muted">Como o cliente recebe</p>
              <p>Oi, Ana! {v.slots[0].inviteRendered || "Volte e aproveite o convite."}</p>
            </div>
          )}
        </section>
      )}

      {p?.review && (
        <div className="flex flex-col gap-1 rounded-sm border border-border bg-white p-3 text-sm" data-testid="revisor-plano" role="status">
          <p className="font-semibold text-ink">
            {p.review.status === "revisando" ? "Revisor (outro provedor de IA): conferindo os textos…" : p.review.status === "ok" ? "Revisor: ok" : p.review.status === "atencao" ? "Revisor: atenção" : p.review.status === "bloquear" ? "Revisor: ajuste os convites antes de aprovar" : "Revisor: não revisado"}
          </p>
          {p.review.reasons.length > 0 && (
            <ul className="list-disc pl-5 text-ink">
              {p.review.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {p && editable && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={approve} disabled={v.generating || p.review?.status === "revisando"} aria-busy={busy === "aprovar" || undefined} aria-describedby={v.generating || p.review?.status === "revisando" ? "aprovar-espera" : undefined} className="min-h-11 rounded-xs bg-red-button px-6 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60">
            {busy === "aprovar" ? "Aprovando…" : "Aprovar plano"}
          </button>
          {(v.generating || p.review?.status === "revisando") && (
            <p id="aprovar-espera" className="self-center text-sm text-ink-muted">
              {v.generating ? "Espere o novo plano ficar pronto." : "Espere o revisor (alguns segundos)."}
            </p>
          )}
          <button type="button" onClick={() => setDiscarding((x) => !x)} className="min-h-11 rounded-xs border border-border bg-white px-5 text-sm font-semibold text-ink">
            Descartar
          </button>
        </div>
      )}
      {discarding && (
        <fieldset className="flex flex-col gap-2 rounded-sm border border-border bg-white p-4">
          <legend className="text-sm font-semibold text-ink">Por que descartar?</legend>
          {REASONS.map(([k, label]) => (
            <label key={k} className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input type="radio" name="motivo" value={k} checked={reason === k} onChange={() => setReason(k)} />
              {label}
            </label>
          ))}
          {reason === "outro" && <input aria-label="Motivo" maxLength={200} value={reasonText} onChange={(e) => setReasonText(e.target.value)} className="min-h-11 rounded-xs border border-border px-2" />}
          <button type="button" disabled={!reason} onClick={discard} className="min-h-11 max-w-xs rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text disabled:opacity-50">
            Confirmar descarte
          </button>
        </fieldset>
      )}

      <p className="text-sm">
        <Link className="inline-flex min-h-6 items-center text-red-text underline" href="/parceiro/salao/plano/historico">
          Histórico de planos
        </Link>
      </p>
    </div>
  );
}

function Insights({ v }: { v: PlanView }) {
  const cells = v.insights.heatmap.cells;
  const max = Math.max(1, ...cells.map((c) => c.count));
  return (
    <section aria-labelledby="dados" className="flex flex-col gap-4 rounded-sm border border-border bg-white p-4">
      <h2 id="dados" className="text-lg font-bold text-ink">
        O que os seus dados dizem
      </h2>
      <div
        className="relative overflow-x-auto no-scrollbar"
        tabIndex={0}
        role="region"
        aria-label="Mapa de check-ins por dia e turno (rolável)"
      >
        <table className="min-w-[520px] text-center text-sm">
          <caption className="pb-2 text-left text-sm text-ink-muted">Check-ins por dia e turno nos últimos 30 dias (mede quem leu o QR, não a lotação). Contorno: horário vazio que você declarou.</caption>
          <thead>
            <tr>
              <th scope="col" className="w-20">
                <span className="sr-only">Turno</span>
              </th>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <th key={d} scope="col" className="px-1 text-xs font-normal text-ink-muted">
                  <abbr title={WD_LONG[d]}>{WD[d]}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["almoco", "tarde", "noite"] as const).map((t) => (
              <tr key={t}>
                <th scope="row" className="pr-2 text-left text-xs font-normal text-ink-muted">
                  {TURN[t]}
                </th>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const c = cells.find((x) => x.weekday === d && x.turn === t)!;
                  const a = c.open ? 0.06 + (0.4 * c.count) / max : 0; // claro o bastante para o texto escuro passar AA
                  return (
                    <td key={d} className="p-0.5">
                      <div className={`flex h-9 items-center justify-center rounded-xs text-xs ${c.declared ? "outline-2 outline-ink" : ""} text-ink`} style={{ background: c.open ? `rgba(215, 46, 59, ${a.toFixed(2)})` : "var(--color-surface-muted)" }}>
                        {c.open ? c.count : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {v.insights.lowTurns.filter(Boolean).length > 0 && (
        <p className="text-sm text-ink">
          <span className="font-semibold">Atenção: </span>poucos check-ins em {v.insights.lowTurns.filter(Boolean).join(", ")}, que você não marcou como horário vazio.
        </p>
      )}
      {v.insights.offers.length > 0 && (
        <div
          className="relative overflow-x-auto no-scrollbar"
          tabIndex={0}
          role="region"
          aria-label="Resposta aos convites (rolável)"
        >
          <table className="w-full min-w-[520px] text-sm">
            <caption className="pb-2 text-left text-sm text-ink-muted">Resposta aos convites (convites reais; o efeito causal só no total do restaurante, na Visão geral)</caption>
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th scope="col" className="font-normal">Horário</th>
                <th scope="col" className="font-normal">Oferta</th>
                <th scope="col" className="font-normal">Emitidos (30 dias)</th>
                <th scope="col" className="font-normal">Usados em 1 semana</th>
                <th scope="col" className="font-normal">Teto sugerido</th>
              </tr>
            </thead>
            <tbody>
              {v.insights.offers.map((o) => (
                <tr key={o.key}>
                  <td>{o.slotLabel}</td>
                  <td>{o.title}</td>
                  <td>{int(o.issued30d)}</td>
                  <td>{o.issued7d ? `${Math.round((100 * o.used7d) / o.issued7d)}% de ${int(o.issued7d)}` : "—"}</td>
                  <td>{int(o.recalibratedCap)}/semana</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-ink">
        Clientes acionáveis: {int(v.insights.segments.sumiu.count)} com 1 visita e sumiram · {int(v.insights.segments.perto.count)} perto da recompensa ·{" "}
        <Link className="text-red-text underline" href="/parceiro/salao/clientes">
          ver Clientes
        </Link>
      </p>
    </section>
  );
}
