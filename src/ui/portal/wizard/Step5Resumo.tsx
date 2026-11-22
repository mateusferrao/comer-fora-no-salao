"use client";

import { StickyActions } from "../../components/StickyActions";
import { useEffect, useState } from "react";
import Link from "next/link";
import { describeOffer, type Offer } from "@/src/modules/beneficios/domain/offers";
import type { PackageView } from "@/src/modules/onboarding/application/package";
import { renderReferences } from "@/src/modules/textos/domain/references";
import { InviteCard } from "../../cliente/InviteCard";
import { Button } from "../../components/Button";
import { PhoneFrame } from "../../components/PhoneFrame";
import {
  inviteIssues,
  reasonMessage,
} from "@/src/modules/ia/guardrails/messages";
import { api, markStep } from "./api";
import { finalPayload, initialFinal, useTexts } from "./Step4Pacote";

const toOffer = (v: { kind: Offer["kind"]; itemId: string; pct?: number }): Offer => ({ kind: v.kind, params: { itemId: v.itemId, ...(v.kind === "desconto" ? { pct: v.pct ?? 15 } : {}) } });

/** Passo 5 (espec. 3.2): prévia de como o cliente vê o "agora" e o convite → "Ativar Comer Fora no salão". */
export function Step5Resumo({ view, slug, todayPlus30 }: { view: PackageView; slug: string; todayPlus30: string }) {
  const f = initialFinal(view);
  const ctx = useTexts(view);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => markStep(5), []);

  // Ajuste de 21/11: o problema do texto aparece antes de ativar, com o horário e o que fazer (antes só no clique).
  const label = (slotId: string) =>
    view.slots.find((s) => s.slotId === slotId)?.label ?? "um horário";
  const problems = f.slots.flatMap((st) => {
    if (st.edited === null) return [];
    const gain = describeOffer(toOffer(st.offer), view.menu, "convite").gain;
    const e = inviteIssues(st.edited, { ...ctx, oferta: gain }).errors[0];
    return e ? [`Convite de ${label(st.slotId)}: ${e}`] : [];
  });

  async function activate() {
    if (problems.length)
      return setError(
        "Ajuste o texto do convite antes de ativar (veja acima).",
      );
    setBusy(true);
    setError(null);
    const r = await api<{
      ok?: boolean;
      erro?: string;
      detalhe?: { slotId?: string; motivos?: string[] };
    }>("/api/parceiro/ativar", "POST", finalPayload(f));
    setBusy(false);
    // Sem refresh aqui: a página do passo redirecionaria (restaurante já ativo) e a confirmação sumiria.
    if (r.ok) return setDone(true);
    const d = r.data.detalhe;
    if (r.data.erro === "texto" && d?.slotId)
      setError(
        `Convite de ${label(d.slotId)}: ${reasonMessage(d.motivos?.[0] ?? "", { maxLen: 160 })} Toque em “Voltar e ajustar”.`,
      );
    else if (r.data.erro === "oferta")
      setError(
        "Uma oferta usa um item que saiu do cardápio. Toque em “Voltar e ajustar” e escolha outro item.",
      );
    else
      setError(
        "Não conseguimos ativar agora. Verifique sua conexão e tente de novo em instantes.",
      );
  }

  const agora = describeOffer(toOffer(f.agora), view.menu, "agora");
  if (done) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <h2 className="text-xl font-bold text-ink">Comer Fora no salão ativo!</h2>
        <p className="text-sm text-ink">Seu kit de divulgação já está sendo preparado. Próximos passos:</p>
        <ol className="list-decimal pl-5 text-sm leading-6 text-ink">
          <li>Aprove e imprima o display e o cartaz.</li>
          <li>Coloque nas mesas e marque &quot;Está no salão&quot;.</li>
          <li>Veja como o cliente vê: leia o QR e faça o check-in.</li>
          <li>Valide o código no Portal, como o garçom faria.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <Link href="/parceiro/salao/kit" className="inline-flex min-h-11 items-center rounded-xs bg-red-button px-5 text-sm font-semibold text-white">
            Ver meu kit
          </Link>
          <a href={`/r/${slug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xs border border-red-text px-5 text-sm font-semibold text-red-text">
            Ver minha página
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">Resumo e ativar</h2>
        <p className="mt-1 text-sm text-ink-muted">É assim que o cliente vê, no app, depois do check-in.</p>
      </div>
      {problems.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-sm border border-red-text bg-nav-active p-3 text-sm text-ink"
        >
          {problems.map((m) => (
            <p key={m}>{m}</p>
          ))}
          <Link
            href="/parceiro/salao/ativar/4"
            className="min-h-11 self-start py-2 font-semibold text-red-text underline"
          >
            Ajustar o texto
          </Link>
        </div>
      )}
      {/* Ajuste de 21/11: prévia dentro da moldura de iPhone, como o cliente vê no app. */}
      <PhoneFrame height="auto" className="self-center">
        <div className="flex flex-col gap-4 bg-surface-muted p-4 pb-8">
          <section
            aria-label="Prévia do benefício de 1ª visita"
            className="rounded-xl bg-white p-4 shadow-medium"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Check-in feito!
            </p>
            <p className="mt-2 text-lg font-semibold text-ink">{agora.title}</p>
            <p className="text-sm text-ink-muted">
              {agora.subtitle} · {agora.itemName}
            </p>
            <p className="mt-3 text-sm text-ink">
              Informe este código ao garçom
            </p>
            <p
              aria-hidden="true"
              className="mt-1 font-mono text-2xl tracking-[0.3em] text-ink"
            >
              ••••••
            </p>
          </section>
          {view.slots.map((s) => {
            const st = f.slots.find((x) => x.slotId === s.slotId)!;
            const offer = toOffer(st.offer);
            const d = describeOffer(offer, view.menu, "convite");
            const message =
              st.edited ??
              renderReferences(st.template, { ...ctx, oferta: d.gain });
            return (
              <InviteCard
                key={s.slotId}
                regionLabel={`Prévia do convite · ${s.label}`}
                invite={{
                  state: "novo",
                  days: s.days,
                  startMin: s.startMin,
                  endMin: s.endMin,
                  untilDay: todayPlus30,
                  offer: { ...d, category: null },
                  message: message.trim() || null,
                }}
              />
            );
          })}
        </div>
      </PhoneFrame>
      <p className="text-xs text-ink-muted">
        O 2º card só aparece para quem foi sorteado para receber o convite (9 em
        cada 10 clientes); os outros formam o grupo de controle que mede o
        resultado.
      </p>
      <StickyActions
        justify="between"
        message={
          error && (
            <p role="alert" className="text-sm font-medium text-red-text">
              {error}
            </p>
          )
        }
      >
        <Link href="/parceiro/salao/ativar/4" className="inline-flex min-h-11 items-center rounded-xs border border-red-text px-5 text-sm font-semibold text-red-text">
          Voltar e ajustar
        </Link>
        <Button variant="primary-portal" loading={busy} onClick={activate}>
          Ativar Comer Fora no salão
        </Button>
      </StickyActions>
    </div>
  );
}
