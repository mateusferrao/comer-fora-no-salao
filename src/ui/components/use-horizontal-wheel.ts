"use client";

import { useEffect, type RefObject } from "react";

/**
 * Fileiras que rolam só para o lado (abas, sugestões do assistente): no computador, a roda do mouse é vertical e não
 * as movia (D332). Aqui a roda vertical vira rolagem lateral enquanto a fileira tiver para onde ir; na ponta, a página
 * rola normalmente. Rolagem lateral nativa (trackpad, Shift + roda) e toque seguem como estão.
 */
export function useHorizontalWheel(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientWidth : e.deltaY;
      const next = Math.max(0, Math.min(max, el.scrollLeft + step));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref, active]);
}
