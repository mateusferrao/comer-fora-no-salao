"use client";

import { confirmDialog } from "../../components/ConfirmDialog";
import {
  INTENSITY_PHRASE,
  type Intensity,
} from "@/src/modules/beneficios/domain/slots";
import { ExplainOfferLink } from "@/src/ui/ia/ExplainOffer";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNumberField } from "../../components/use-number-field";
import { useRouter } from "next/navigation";
import { describeOffer, unitCost, type Offer } from "@/src/modules/beneficios/domain/offers";
import type { PackageView } from "@/src/modules/onboarding/application/package";
import { inviteIssues } from "@/src/modules/ia/guardrails/messages";
import { renderReferences } from "@/src/modules/textos/domain/references";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { SidePanel } from "../../components/SidePanel";
import { OfferEditor, type OfferValue } from "../OfferEditor";
import { api, brl, markStep } from "./api";

type SlotState = { slotId: string; offer: OfferValue; weeklyCap: number; template: string; edited: string | null };
export type FinalState = { agora: OfferValue; recompensa: OfferValue; slots: SlotState[] };

const toValue = (o: Offer): OfferValue => ({ kind: o.kind, itemId: o.params.itemId, ...(o.params.pct !== undefined ? { pct: o.params.pct } : {}) });
const toOffer = (v: OfferValue): Offer => ({ kind: v.kind, params: { itemId: v.itemId, ...(v.kind === "desconto" ? { pct: v.pct ?? 15 } : {}) } });
const SEM_IA: Record<string, string> = {
  teto_diario: "O limite diário de IA foi atingido.",
  sem_chave: "A IA não está configurada neste ambiente.",
  timeout: "A IA demorou demais para responder.",
  invalid: "A resposta da IA não passou nas regras.",
  unavailable: "A IA está indisponível agora.",
  sem_candidatas: "Não há ofertas válidas para algum horário: escolha um item.",
};

export function initialFinal(v: PackageView): FinalState {
  const d = v.draftFinal as { agora: OfferValue; recompensa: OfferValue; slots: Array<{ slotId: string; offer: OfferValue; weeklyCap: number; inviteText: string }> } | null;
  return {
    agora: d?.agora ?? toValue(v.agora.offer),
    recompensa: d?.recompensa ?? toValue(v.recompensa.offer),
    slots: v.slots.map((s) => {
      const saved = d?.slots.find((x) => x.slotId === s.slotId);
      const chosen = s.options.find((o) => o.id === s.chosenId) ?? s.options[0];
      const offer = saved?.offer ?? (chosen ? toValue(chosen.offer) : { kind: "leve2pague1" as const, itemId: v.menu[0]?.id ?? "" });
      return { slotId: s.slotId, offer, weeklyCap: saved?.weeklyCap ?? s.weeklyCap, template: s.inviteText, edited: saved && saved.inviteText !== s.inviteText ? saved.inviteText : null };
    }),
  };
}

export function finalPayload(f: FinalState) {
  return {
    agora: f.agora,
    recompensa: f.recompensa,
    slots: f.slots.map((s) => ({ slotId: s.slotId, offer: s.offer, weeklyCap: s.weeklyCap, inviteText: s.edited ?? s.template })),
  };
}

export function useTexts(v: PackageView) {
  return useMemo(() => {
    const items = Object.fromEntries(v.menu.map((m) => [m.id, m.name]));
    const slots = Object.fromEntries(v.slots.map((s) => [s.slotId, s.label]));
    return { items, slots };
  }, [v]);
}

/** Passo 4 (espec. 3.2): sistema propõe, dono aprova ou ajusta. Custos e tetos são do código; a IA escolhe e explica. */
export function Step4Pacote({ explicaIa = false }: { explicaIa?: boolean } = {}) {
  const router = useRouter();
  const [v, setV] = useState<PackageView | null>(null);
  const [f, setF] = useState<FinalState | null>(null);
  const [state, setState] = useState<"carregando" | "gerando" | "pronto" | "erro">("carregando");
  const [panel, setPanel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => markStep(4), []);

  async function generate() {
    setState("gerando");
    setError(null);
    const r = await api<PackageView & { erro?: string }>("/api/parceiro/pacote", "POST");
    if (r.ok && r.data.slots) {
      setV(r.data);
      setF(initialFinal({ ...r.data, draftFinal: null }));
      setState("pronto");
    } else if (r.status === 409 && r.data.erro === "gerando") {
      setTimeout(load, 2000);
    } else {
      setState(v ? "pronto" : "erro");
      setError(r.status === 429 ? "Você já gerou o pacote muitas vezes hoje. Ajuste a proposta atual." : "Não conseguimos montar o pacote agora. Tente de novo.");
    }
  }

  async function load() {
    const r = await api<PackageView | { status: string }>("/api/parceiro/pacote");
    if (r.ok && "slots" in r.data) {
      setV(r.data);
      setF(initialFinal(r.data));
      setState("pronto");
    } else if (r.ok && "status" in r.data && r.data.status === "gerando") {
      setState("gerando");
      setTimeout(load, 2000);
    } else void generate();
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao entrar no passo
  }, []);

  // Rascunho salvo sozinho (revisão da S2): atualizar a página ou voltar não perde os ajustes.
  const saved = useRef<string | null>(null);
  useEffect(() => {
    if (!f || state !== "pronto") return;
    const body = JSON.stringify(finalPayload(f));
    if (saved.current === null) {
      saved.current = body;
      return;
    }
    if (body === saved.current) return;
    const t = setTimeout(async () => {
      const r = await api("/api/parceiro/pacote", "PUT", JSON.parse(body));
      if (r.ok) saved.current = body;
    }, 800);
    return () => clearTimeout(t);
  }, [f, state]);

  async function regenerate() {
    const changed =
      f &&
      v &&
      JSON.stringify(finalPayload(f)) !==
        JSON.stringify(finalPayload(initialFinal({ ...v, draftFinal: null })));
    if (
      changed &&
      !(await confirmDialog({
        title: "Gerar a proposta de novo?",
        body: "A proposta atual e os seus ajustes são substituídos por uma nova.",
        confirmLabel: "Gerar de novo",
      }))
    )
      return;
    saved.current = null;
    void generate();
  }

  if (state === "carregando" || state === "gerando" || !v || !f) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <h2 className="text-xl font-bold text-ink">Pacote proposto</h2>
        {state === "erro" ? (
          <div className="flex flex-col gap-3">
            <p role="alert" className="text-sm font-medium text-red-text">
              {error}
            </p>
            <div>
              <Button variant="primary-portal" onClick={generate}>
                Tentar de novo
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p role="status" className="text-sm text-ink">
              Montando seu pacote: o código calcula as ofertas possíveis, o teto e o custo; a IA escolhe a que combina com cada horário e explica por quê.
            </p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-sm bg-surface-muted" />
            ))}
          </>
        )}
      </div>
    );
  }
  return <PackageEditor explicaIa={explicaIa} v={v} f={f} setF={setF} panel={panel} setPanel={setPanel} busy={busy} error={error} onRegenerate={regenerate} onNext={async () => {
    setBusy(true);
    const r = await api("/api/parceiro/pacote", "PUT", finalPayload(f));
    setBusy(false);
    if (r.ok) {
      router.push("/parceiro/salao/ativar/5");
      router.refresh();
    } else setError("Não conseguimos salvar seus ajustes. Tente de novo.");
  }} />;
}

function PackageEditor(p: {
  explicaIa: boolean;
  v: PackageView;
  f: FinalState;
  setF: (f: FinalState) => void;
  panel: string | null;
  setPanel: (id: string | null) => void;
  busy: boolean;
  error: string | null;
  onRegenerate: () => void;
  onNext: () => void;
}) {
  const { v, f, setF } = p;
  const ctx = useTexts(v);
  const margin = v.marginPct ?? undefined;
  const agoraCost = unitCost(toOffer(f.agora), v.menu, margin);
  const setSlot = (id: string, patch: Partial<SlotState>) => setF({ ...f, slots: f.slots.map((s) => (s.slotId === id ? { ...s, ...patch } : s)) });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Pacote proposto</h2>
          <p className="mt-1 text-sm text-ink-muted">O sistema propõe, você aprova ou ajusta. Números e custos são calculados pelas regras; a IA escolhe a oferta de cada horário e explica.</p>
        </div>
        {v.generatedBy === "sem_ia" ? <Badge tone="neutral">Sugestão automática (sem IA)</Badge> : <Badge tone="outline-red">Escolhido pela IA</Badge>}
      </div>
      {v.generatedBy === "sem_ia" && v.semIa && <p className="rounded-sm bg-surface-muted px-3 py-2 text-sm text-ink">{SEM_IA[v.semIa] ?? "A IA não respondeu."} Usamos a opção de maior nota e um texto modelo.</p>}

      <section aria-labelledby="agora" className="flex flex-col gap-3 rounded-sm border border-border p-4">
        <h3 id="agora" className="font-semibold text-ink">
          Benefício de 1ª visita (o &quot;agora&quot;)
        </h3>
        <p className="text-sm text-ink">
          <strong>{describeOffer(toOffer(f.agora), v.menu, "agora").gain}</strong> para quem faz check-in pela primeira vez, em qualquer horário. Custo{" "}
          {agoraCost.isMax ? "máximo" : "estimado"} ≈ {brl(agoraCost.cents)} por cliente identificado.
        </p>
        <OfferEditor label="Benefício de 1ª visita" value={f.agora} menu={v.menu} onChange={(agora) => setF({ ...f, agora })} />
      </section>

      <section aria-labelledby="recompensa" className="flex flex-col gap-3 rounded-sm border border-border p-4">
        <h3 id="recompensa" className="font-semibold text-ink">
          Recompensa da cartela (6 selos)
        </h3>
        <p className="text-sm text-ink">
          <strong>{describeOffer(toOffer(f.recompensa), v.menu, "recompensa").gain}</strong> no 6º check-in.
        </p>
        <OfferEditor label="Recompensa da cartela" value={f.recompensa} menu={v.menu} onChange={(recompensa) => setF({ ...f, recompensa })} />
      </section>

      {v.slots.map((s) => {
        const st = f.slots.find((x) => x.slotId === s.slotId)!;
        const offer = toOffer(st.offer);
        const gain = describeOffer(offer, v.menu, "convite").gain;
        const cost = unitCost(offer, v.menu, margin);
        const rendered =
          st.edited ??
          renderReferences(
            st.template.replace(/\{horario\}/g, `{horario:${s.slotId}}`),
            { ...ctx, oferta: gain },
          );
        const chosenOption = s.options.find(
          (o) =>
            o.offer.kind === st.offer.kind &&
            o.offer.params.itemId === st.offer.itemId,
        );
        // Ajuste de 21/11: validação na hora, no campo, inclusive o texto apagado (antes só falhava ao ativar).
        const issues =
          st.edited !== null
            ? inviteIssues(st.edited, { ...ctx, oferta: gain })
            : null;
        const invalid = !!issues?.errors.length;
        return (
          <section key={s.slotId} aria-labelledby={`faixa-${s.slotId}`} className="flex flex-col gap-3 rounded-sm border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={`faixa-${s.slotId}`} className="font-semibold text-ink">
                Convite de volta · {s.label}
              </h3>
              <Badge tone="neutral">
                {INTENSITY_PHRASE[s.intensity as Intensity] ?? s.intensity}
              </Badge>
            </div>
            <p className="text-base text-ink">
              Oferta: <strong>{gain}</strong>
              {!chosenOption && <span className="text-sm text-ink-muted"> (escolha sua)</span>}
            </p>
            {s.justificativa && chosenOption?.id === s.chosenId && (
              <div className="rounded-sm bg-surface-muted p-3 text-sm text-ink">
                <p className="font-semibold">Por que esta</p>
                <p className="mt-1">{s.justificativa}</p>
              </div>
            )}
            {/* S5.3 (flag explica_ia): opções do código, escolha da IA, fatos, regras e "Como a IA decidiu". */}
            {p.explicaIa && <ExplainOfferLink planId={v.planId} slotId={s.slotId} />}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline-portal" onClick={() => p.setPanel(s.slotId)}>
                Ver outras opções
              </Button>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Texto do convite (o cliente vê no 2º card)
              <textarea
                id={`texto-${s.slotId}`}
                className={`min-h-20 rounded-md border p-3 text-base ${invalid ? "border-red-text" : "border-border"}`}
                maxLength={160}
                value={rendered}
                onChange={(e) => setSlot(s.slotId, { edited: e.target.value })}
                aria-invalid={invalid || undefined}
                aria-describedby={`aviso-${s.slotId}`}
              />
            </label>
            <div
              id={`aviso-${s.slotId}`}
              className="flex flex-col gap-1 text-xs text-ink-muted"
            >
              <p
                className={
                  rendered.length > 150 ? "font-medium text-ink" : undefined
                }
              >
                {rendered.length}/160 caracteres
              </p>
              {issues?.errors.map((m) => (
                <p key={m} className="font-medium text-red-text">
                  {m}
                </p>
              ))}
              {issues?.warnings.map((m) => (
                <p key={m} className="text-ink">
                  Atenção: {m}
                </p>
              ))}
              {st.edited !== null && (
                <button type="button" className="min-h-11 self-start font-semibold text-red-text underline" onClick={() => setSlot(s.slotId, { edited: null })}>
                  Voltar ao texto sugerido
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                Teto de convites por semana
                <CapInput value={st.weeklyCap} onValue={(n) => setSlot(s.slotId, { weeklyCap: n })} />
              </label>
              <p className="pb-2 text-sm text-ink">
                até {st.weeklyCap} convites/semana ≈ {Math.max(1, Math.round(st.weeklyCap / 4))} {Math.max(1, Math.round(st.weeklyCap / 4)) === 1 ? "mesa" : "mesas"} · custo {cost.isMax ? "máximo" : "estimado"} ≈{" "}
                {brl(cost.cents * st.weeklyCap)}/semana
              </p>
            </div>
            <SidePanel
              open={p.panel === s.slotId}
              onClose={() => p.setPanel(null)}
              title={`Opções para ${s.label}`}
              footer={
                <Button variant="primary-portal" onClick={() => p.setPanel(null)}>
                  Concluir
                </Button>
              }
            >
              <p className="text-sm text-ink-muted">Ofertas válidas calculadas pelo código (item do cardápio, custo dentro do teto, tipo permitido).</p>
              <ul className="mt-3 flex flex-col gap-2">
                {s.options.map((o) => {
                  const on = st.offer.kind === o.offer.kind && st.offer.itemId === o.offer.params.itemId;
                  return (
                    <li key={o.id}>
                      <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-sm border p-3 ${on ? "border-red-text" : "border-border"}`}>
                        <input type="radio" name={`op-${s.slotId}`} checked={on} onChange={() => setSlot(s.slotId, { offer: toValue(o.offer) })} className="mt-1 accent-[#e71c2b]" />
                        <span className="text-sm">
                          <strong className="block text-ink">
                            {o.gain}
                            {o.id === s.chosenId && v.generatedBy === "ia" ? " · escolha da IA" : ""}
                          </strong>
                          <span className="text-ink-muted">
                            {o.title} · custo {o.isMax ? "máximo" : "estimado"} ≈ {brl(o.unitCostCents)} por convite usado
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-col gap-2 border-t border-divider pt-4">
                <p className="text-sm font-semibold text-ink">Ou escolha outro item</p>
                <OfferEditor label={`Oferta do convite em ${s.label}`} value={st.offer} menu={v.menu} onChange={(offer) => setSlot(s.slotId, { offer })} />
              </div>
            </SidePanel>
          </section>
        );
      })}

      {p.error && (
        <p role="alert" className="text-sm font-medium text-red-text">
          {p.error}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="outline-portal" onClick={p.onRegenerate}>
          Gerar de novo
        </Button>
        <Button
          variant="primary-portal"
          loading={p.busy}
          onClick={() => {
            // Texto inválido não segue para o passo 5: foco no campo, com o motivo já escrito embaixo dele.
            const bad = f.slots.find(
              (st) =>
                st.edited !== null &&
                inviteIssues(st.edited, {
                  ...ctx,
                  oferta: describeOffer(toOffer(st.offer), v.menu, "convite")
                    .gain,
                }).errors.length,
            );
            if (bad) {
              document.getElementById(`texto-${bad.slotId}`)?.focus();
              return;
            }
            p.onNext();
          }}
        >
          Revisar e ativar
        </Button>
      </div>
    </div>
  );
}

function CapInput({ value, onValue }: { value: number; onValue: (n: number) => void }) {
  const field = useNumberField(value, 1, 999, onValue);
  return <input type="text" inputMode="numeric" className="min-h-11 w-32 rounded-sm border border-border px-2" {...field} />;
}
