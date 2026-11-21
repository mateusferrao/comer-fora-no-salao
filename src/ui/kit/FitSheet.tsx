"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Folha de impressão (tamanho real em mm) encaixada na largura da tela (ajuste de 21/11): no celular, a folha de 21 cm
 * vazava dos 2 lados e o QR ficava cortado. Na tela, reduz por escala; na impressão, volta ao tamanho real
 * (`[data-fit-sheet]` em globals.css).
 */
export function FitSheet({ children, gutter = 32 }: { children: ReactNode; gutter?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ s: number; w: number; h: number } | null>(null);
  useEffect(() => {
    const o = outer.current;
    const el = inner.current;
    if (!o || !el) return;
    // O observador dispara ao começar a observar: a 1ª medida sai dele (sem setState direto no efeito).
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const avail = (o.parentElement?.clientWidth ?? window.innerWidth) - gutter;
      setBox({ s: Math.min(1, avail / w), w, h });
    });
    ro.observe(el);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [gutter]);
  const scaled = box && box.s < 1;
  return (
    <div ref={outer} data-fit-sheet className="max-w-full overflow-hidden" style={box ? { width: box.w * box.s, height: box.h * box.s } : undefined}>
      <div ref={inner} className="w-max" style={scaled ? { transform: `scale(${box.s})`, transformOrigin: "top left" } : undefined}>
        {children}
      </div>
    </div>
  );
}
