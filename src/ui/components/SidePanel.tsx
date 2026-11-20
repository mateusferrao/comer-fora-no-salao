"use client";

import type { ReactNode } from "react";
import { useModalDialog } from "./useModalDialog";

/** Painel lateral (portal/02): metade da tela no computador, tela cheia no celular; Esc e X fecham. */
export function SidePanel({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const { ref, dialogProps } = useModalDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      aria-labelledby="painel-titulo"
      {...dialogProps}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none flex-col bg-white p-0 shadow-highest backdrop:bg-black/50 open:flex sm:w-[min(560px,90vw)]"
    >
      <div className="flex items-center justify-between border-b border-divider px-5 py-3">
        <h2 id="painel-titulo" className="text-lg font-bold text-ink">
          {title}
        </h2>
        <button type="button" aria-label="Fechar" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-sm text-red-text hover:bg-surface-muted">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-3 border-t border-divider px-5 py-3">{footer}</div>}
    </dialog>
  );
}
