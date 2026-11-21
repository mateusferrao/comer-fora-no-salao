"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RestaurantPageView } from "@/src/modules/salao/application/queries";
import { AppShell } from "@/src/ui/components/AppShell";
import { BottomSheet } from "@/src/ui/components/BottomSheet";
import { CategoryImage } from "@/src/ui/components/CategoryImage";
import { Chip } from "@/src/ui/components/Chip";
import { Tabs } from "@/src/ui/components/Tabs";
import { TicketCard } from "@/src/ui/components/TicketCard";
import { RulesSheet } from "@/src/ui/cliente/RulesSheet";
import { offerSubtitle, TXT } from "@/src/ui/cliente/textos";
import { useDistance } from "@/src/ui/cliente/useDistance";

function Hero({ src }: { src: string | null }) {
  const [ok, setOk] = useState(Boolean(src));
  return (
    <div className="relative h-56 w-full bg-gradient-to-br from-[#3b2a22] to-[#7a4b33]">
      {src && ok && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden="true" onError={() => setOk(false)} className="absolute inset-0 size-full object-cover" />
      )}
    </div>
  );
}

function StampIllustration() {
  return (
    <div aria-hidden="true" className="grid size-full grid-cols-3 place-items-center gap-1 bg-red-brand p-3">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="size-5 rounded-full border-2 border-white/80" />
      ))}
    </div>
  );
}

export function RestaurantView({ page, token, copyV2 = false, recentCheckins = null }: { page: RestaurantPageView; token?: string; copyV2?: boolean; recentCheckins?: number | null }) {
  const [tab, setTab] = useState("beneficios");
  const [detail, setDetail] = useState(false);
  const [rules, setRules] = useState(false);
  const distance = useDistance(page.lat, page.lng);
  const checkinHref = `/r/${page.slug}/checkin${token ? `?p=${encodeURIComponent(token)}` : ""}`;

  // Leitura do QR por beacon, depois de abrir (nunca pelo GET, que robôs e prefetch também fazem — D49).
  useEffect(() => {
    const body = JSON.stringify(token ? { p: token } : {});
    const url = `/api/r/${page.slug}/leitura`;
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.(url, blob)) void fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  }, [page.slug, token]);

  const meta = [distance, page.cuisine, page.priceBand].filter(Boolean).join(" • ");

  const beneficios = (
    <div className="pb-4">
      <h2 className="text-xl font-semibold">Benefícios pra você</h2>
      <div className="-mx-5 mt-4 flex snap-x gap-3 overflow-x-auto rounded-xl bg-surface-muted px-5 py-3">
        {page.agora && (
          <button type="button" onClick={() => setDetail(true)} className="w-[85%] shrink-0 snap-start text-left focus-visible:outline-2 focus-visible:outline-ink">
            <TicketCard
              image={<CategoryImage category={page.agora.category} className="size-full" />}
              title={page.agora.title}
              subtitle={offerSubtitle(page.agora)}
              chips={
                <>
                  <Chip>Todos os dias</Chip>
                  <Chip>Dia e Noite</Chip>
                </>
              }
            />
          </button>
        )}
        <button type="button" onClick={() => setRules(true)} className="w-[85%] shrink-0 snap-start text-left focus-visible:outline-2 focus-visible:outline-ink">
          <TicketCard
            image={<StampIllustration />}
            title="Junte Selos e Ganhe"
            subtitle="Pra clientes frequentes"
            chips={
              <>
                <Chip>Todos os dias</Chip>
                <Chip>Dia e Noite</Chip>
              </>
            }
          />
        </button>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-md border border-border px-3 py-3 text-sm leading-5 text-ink">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-red-text" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8m16-5H4v5h16V7Zm-8 0v15M12 7S10.5 2 8 3.5 9 7 12 7Zm0 0s1.5-5 4-3.5S15 7 12 7Z" />
        </svg>
        {TXT.linhaConvite}
      </p>
      {page.description && (
        <>
          <h2 className="mt-8 text-xl font-semibold">Sobre o restaurante</h2>
          <p className="mt-3 text-base leading-6 text-ink-muted">{page.description}</p>
        </>
      )}
    </div>
  );

  const sobre = (
    <div className="pb-4">
      <h2 className="text-xl font-semibold">Localização</h2>
      <p className="mt-3 text-base leading-6 text-ink">{page.address ?? "Endereço não informado"}</p>
      <p className="mt-6 text-xs text-ink-muted">
        Fotos ilustrativas de banco livre (Wikimedia Commons, CC0 e CC BY).{" "}
        <a href="/bastidores/como-funciona" className="underline">
          Créditos das fotos
        </a>
      </p>
    </div>
  );

  return (
    <AppShell>
      {copyV2 && <ConversionBand page={page} recentCheckins={recentCheckins} />}
      <header className="relative">
        <Hero src={page.heroImage} />
        <Link
          href="/"
          aria-label="Voltar"
          className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-full bg-black/55 text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </Link>
      </header>
      <main className="relative -mt-6 rounded-t-xl bg-surface px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6">
        <h1 className="text-2xl font-semibold leading-8">{page.name}</h1>
        {meta && <p className="mt-2 text-base text-ink-muted">{meta}</p>}
        <p className="mt-1 text-base text-ink-muted">{page.openingLabel}</p>
        <div className="mt-6">
          <Tabs
            label="Seções do restaurante"
            value={tab}
            onValueChange={setTab}
            items={[
              { id: "beneficios", label: "Benefícios", content: beneficios },
              { id: "sobre", label: "Sobre", content: sobre },
            ]}
          />
        </div>
      </main>
      <footer className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[420px] rounded-t-xl bg-surface px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <Link href={checkinHref} className="flex min-h-12 w-full items-center justify-center rounded-md bg-ink text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          {copyV2 && page.agora ? "Fazer check-in e ativar o benefício" : "Check-in"}
        </Link>
      </footer>

      {page.agora && (
        <BottomSheet
          open={detail}
          onClose={() => setDetail(false)}
          title="Benefícios pra você"
          description="Faça o check-in para ativar o benefício e aproveitar"
          actions={
            <Link href={checkinHref} className="flex min-h-12 items-center justify-center rounded-md bg-ink text-base font-medium text-white">
              Check-in
            </Link>
          }
        >
          <div className="overflow-hidden rounded-xl border border-border bg-white text-left">
            <div className="relative">
              <CategoryImage category={page.agora.category} className="h-40 w-full" />
              <span className="absolute bottom-2 right-2 rounded-xs bg-black/60 px-1.5 py-0.5 text-[11px] text-white">Foto ilustrativa</span>
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold">{page.name}</p>
              <p className="mt-3 text-xl font-semibold">{page.agora.title}</p>
              <p className="mt-1 text-sm text-ink-muted">{offerSubtitle(page.agora)}</p>
              <div className="mt-2 flex gap-1.5">
                <Chip>Todos os dias</Chip>
                <Chip>Dia e Noite</Chip>
              </div>
              {page.recado && (
                <>
                  <p className="mt-4 text-sm font-semibold">Recado do {page.name}</p>
                  <p className="mt-1 text-sm text-ink-muted">{page.recado}</p>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setDetail(false);
              setRules(true);
            }}
            className="mt-4 min-h-11 w-full text-center text-sm font-medium text-ink underline"
          >
            Ver detalhes e regras
          </button>
        </BottomSheet>
      )}
      <RulesSheet open={rules} onClose={() => setRules(false)} restaurantName={page.name} />
    </AppShell>
  );
}

/**
 * Topo de conversão da página do QR (S5.2, D181): o benefício de agora (que todos recebem), os 3 passos e a prova
 * social real (N ≥ 5). Nada do convite aparece antes do check-in (holdout — espec. 3.5).
 */
function ConversionBand({ page, recentCheckins }: { page: RestaurantPageView; recentCheckins: number | null }) {
  return (
    <section aria-label="Benefício da sua visita" data-testid="faixa-conversao" className="bg-red-button px-5 pb-4 pt-4 text-white">
      {page.agora && (
        <p className="flex items-start gap-2 text-lg font-semibold leading-6">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="4" rx="1" />
            <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
          </svg>
          <span>
            {page.agora.title}: {page.agora.itemName}
            <span className="block text-sm font-normal">na sua 1ª visita</span>
          </span>
        </p>
      )}
      <ol className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm" aria-label="Como funciona">
        {["Faça check-in", "Receba o código", "Diga o código ao garçom"].map((t, i) => (
          <li key={t} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-red-text">
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ol>
      {recentCheckins !== null && <p className="mt-2 text-sm font-semibold">{recentCheckins.toLocaleString("pt-BR")} check-ins nos últimos 7 dias</p>}
    </section>
  );
}
