import type { ReactNode } from "react";

/** Chip informativo (app/04 "Ter, Qua"): cinza claro, texto #666, não interativo na S0. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium leading-4 text-ink-muted">
      {children}
    </span>
  );
}
