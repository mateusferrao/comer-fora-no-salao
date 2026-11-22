"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CheckinView, CodeView } from "@/src/modules/salao/application/views";
import { CodeDisplay } from "@/src/ui/components/CodeDisplay";
import { StampCard } from "@/src/ui/components/StampCard";
import { InviteCard } from "./InviteCard";
import { codeTitle, TXT } from "./textos";

const CODE_LABEL: Record<CodeView["type"], string> = { primeira_visita: "Benefício da 1ª visita", convite: "Seu convite", recompensa: "Cartela completa" };

/** Título e linha de apoio (S9: sem exclamação; o que fazer com o código vem primeiro). */
export function resultHeading(view: Pick<CheckinView, "outcome" | "codes" | "stamps" | "required">): { title: string; sub: string } {
  if (view.outcome === "ja_fez_checkin_hoje") return { title: "Você já fez check-in hoje", sub: "Volte outro dia para ganhar mais um selo." };
  const show = view.codes.length > 1 ? "Mostre os códigos abaixo ao garçom." : view.codes.length === 1 ? "Mostre o código abaixo ao garçom." : null;
  const stamp = view.stamps >= view.required ? "Sua cartela está completa." : "Você ganhou 1 selo.";
  return { title: "Check-in feito", sub: [show, stamp].filter(Boolean).join(" ") };
}

/** Resultado do check-in: "agora" + código + selo; depois, o 2º card do convite (só convite real). */
export function CheckinResult({ view, slug, token, copyV2 = false }: { view: CheckinView; slug: string; token?: string; copyV2?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [showInvite, setShowInvite] = useState(false);
  useEffect(() => {
    heading.current?.focus();
    const t = setTimeout(() => setShowInvite(true), 600);
    return () => clearTimeout(t);
  }, []);
  const t = resultHeading(view);
  const back = `/r/${slug}${token ? `?p=${encodeURIComponent(token)}` : ""}`;
  return (
    <div aria-live="polite" className="flex flex-col gap-4">
      <div className="rounded-xl bg-white p-5 text-ink">
        <h1 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
          {t.title}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{t.sub}</p>
        <StampCard stamps={view.stamps} required={view.required} className="mt-4" />
        <p className="mt-2 text-xs text-ink-muted">
          {view.stamps} de {view.required} selos
        </p>
        {view.firstVisitAlreadyUsed && view.outcome !== "ja_fez_checkin_hoje" && <p className="mt-3 text-sm text-ink-muted">{TXT.primeiraVisitaUsada}</p>}
      </div>

      {view.codes.length > 0 && view.outcome === "ja_fez_checkin_hoje" && <p className="text-sm font-medium text-white">Seus códigos de hoje</p>}
      {view.codes.map((c) => (
        <section key={c.code} aria-label={`${c.type === "convite" ? "Convite de hoje" : CODE_LABEL[c.type]} · ${c.title}`} className="rounded-xl bg-white p-5 text-ink">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{CODE_LABEL[c.type]}</p>
          <p className="mt-1 text-lg font-semibold">{codeTitle(c)}</p>
          <CodeDisplay code={c.code} className="mt-3" />
          <p className="mt-3 text-center text-base font-medium">{TXT.mostreCodigo}</p>
          <p className="mt-1 text-center text-sm text-ink-muted">{TXT.valeHoje}</p>
        </section>
      ))}

      {view.invite && showInvite && <InviteCard invite={view.invite} animate agenda={copyV2} />}

      <div className="mt-2 flex flex-col gap-3">
        <Link href="/app/jornada" className="flex min-h-12 items-center justify-center rounded-full bg-white text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          Ver Sua jornada
        </Link>
        <Link href={back} className="flex min-h-11 items-center justify-center text-base font-medium text-white underline">
          Voltar ao restaurante
        </Link>
      </div>
    </div>
  );
}
