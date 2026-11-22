"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "../cn";

/**
 * D258: avisos (BottomSheet) dentro da tela do celular quando a moldura está visível. O contexto diz se ela está
 * visível e onde encaixar: `slot` (camada sobre a tela) e `screen` (conteúdo que fica inerte com o aviso aberto).
 */
type FrameCtx = { active: boolean; slot: HTMLDivElement | null; screen: HTMLDivElement | null };
const PhoneFrameContext = createContext<FrameCtx>({ active: false, slot: null, screen: null });
export const usePhoneFrame = () => useContext(PhoneFrameContext);

const MD = "(min-width: 768px)";
const subscribeMd = (cb: () => void) => {
  const m = window.matchMedia(MD);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/*
 * Classes literais nos 2 modos: o Tailwind só gera o que está escrito no código (montar "md:" em tempo de execução
 * não funciona).
 */
const FRAME = {
  sempre: "relative w-auto max-w-full shrink-0 rounded-[56px] bg-[#16181a] p-3 shadow-high ring-1 ring-black/20",
  responsiva: "w-full md:relative md:w-auto md:shrink-0 md:rounded-[56px] md:bg-[#16181a] md:p-3 md:shadow-high md:ring-1 md:ring-black/20",
};
const ISLAND = {
  sempre: "absolute left-1/2 top-[22px] z-30 block h-[26px] w-[104px] -translate-x-1/2 rounded-full bg-black",
  responsiva: "hidden md:absolute md:left-1/2 md:top-[22px] md:z-30 md:block md:h-[26px] md:w-[104px] md:-translate-x-1/2 md:rounded-full md:bg-black",
};
const SCREEN = {
  // Prévia no celular: a moldura inteira cabe na tela (corpo de 12 px de cada lado + margem do Portal).
  sempre: "relative flex w-[390px] max-w-[calc(100vw-5rem)] flex-col overflow-hidden rounded-[44px] bg-surface [transform:translateZ(0)]",
  responsiva: "relative w-full md:flex md:w-[390px] md:flex-col md:overflow-hidden md:rounded-[44px] md:bg-surface md:[transform:translateZ(0)]",
};
const TALL = { sempre: "h-[min(844px,calc(100dvh-7rem))]", responsiva: "md:h-[min(844px,calc(100dvh-7rem))]" };
const STATUS = {
  sempre: "flex h-12 shrink-0 items-center justify-between px-8 pt-1 text-[13px] font-semibold text-ink",
  responsiva: "hidden md:flex md:h-12 md:shrink-0 md:items-center md:justify-between md:px-8 md:pt-1 md:text-[13px] md:font-semibold md:text-ink",
};
const SCROLLER = {
  sempre: "min-h-0 w-full flex-1 overflow-y-auto overscroll-contain no-scrollbar",
  responsiva: "w-full md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:no-scrollbar",
};

/**
 * Moldura de iPhone (D238, pedido do candidato: "simular um iphone e tornar mais imersivo"). Corpo escuro com cantos
 * arredondados, ilha dinâmica e barra de status; a tela tem 390 px e rola por dentro (barra invisível).
 * `responsive`: só a partir de 768 px (no celular de verdade, o app ocupa a tela inteira); sem ele, moldura sempre
 * (prévias no Portal). A tela cria o bloco de contenção dos elementos `fixed` (ex.: botão do rodapé do app).
 */
export function PhoneFrame({ children, responsive = false, className, screenClassName, height = "tall" }: { children: ReactNode; responsive?: boolean; className?: string; screenClassName?: string; height?: "tall" | "auto" }) {
  const m = responsive ? "responsiva" : "sempre";
  const md = useSyncExternalStore(subscribeMd, () => window.matchMedia(MD).matches, () => false);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  const active = !responsive || md;
  return (
    <PhoneFrameContext.Provider value={{ active, slot, screen }}>
    <div data-moldura={m} className={cn(FRAME[m], className)}>
      <div aria-hidden="true" className={ISLAND[m]} />
      <div className={cn(SCREEN[m], height === "tall" && TALL[m], screenClassName)}>
        <div aria-hidden="true" className={STATUS[m]}>
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 18 12" className="h-3 w-[18px]" fill="currentColor">
              <rect x="0" y="8" width="3" height="4" rx="1" />
              <rect x="5" y="5" width="3" height="7" rx="1" />
              <rect x="10" y="2" width="3" height="10" rx="1" />
              <rect x="15" y="0" width="3" height="12" rx="1" />
            </svg>
            <svg viewBox="0 0 26 12" className="h-3 w-[26px]" fill="none" stroke="currentColor">
              <rect x="0.5" y="0.5" width="22" height="11" rx="3" />
              <rect x="2.5" y="2.5" width="16" height="7" rx="1.5" fill="currentColor" stroke="none" />
              <path d="M24.5 4v4" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <div ref={setScreen} className={SCROLLER[m]}>
          {children}
        </div>
        {/* Camada dos avisos dentro da tela do celular (D258); vazia, não captura toques. */}
        <div ref={setSlot} data-camada-celular className={cn("pointer-events-none absolute inset-0 z-50 overflow-hidden", active ? "" : "hidden")} />
      </div>
    </div>
    </PhoneFrameContext.Provider>
  );
}
