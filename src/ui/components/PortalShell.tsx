"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Logo } from "./Logo";
import { useModalDialog } from "./useModalDialog";

type Props = { nav: ReactNode; children: ReactNode; top?: ReactNode; footer?: ReactNode; mobileTitle?: string; assistant?: ReactNode };

/**
 * Casca do Portal: sidebar fixa a partir de 1024 px; abaixo disso, gaveta com botão (44 px),
 * foco preso, Esc fecha e devolve o foco. Logo iFood no topo (portal/05).
 */
export function PortalShell({ nav, children, top, footer, mobileTitle, assistant }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { ref, dialogProps } = useModalDialog(open, close);

  // Escolher um item na gaveta fecha a gaveta.
  const onNavClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) close();
  };

  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[256px_1fr] lg:pr-[var(--copiloto-w,0px)]">
      {/* "Pular para o conteúdo" fica na barra de protótipo, antes dos links dela (1º foco da página). */}
      <aside className="hidden border-r border-divider lg:sticky lg:top-[var(--proto-h,24px)] lg:flex lg:h-[calc(100dvh-var(--proto-h,24px))] lg:flex-col">
        <div className="px-6 py-5">
          <Logo height={28} />
        </div>
        {top && <div className="px-4 pb-3">{top}</div>}
        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 pb-6">
          {nav}
        </nav>
        {/* S8: lugar do botão do assistente (sem flutuar sobre o conteúdo — revisão S8, E2E). */}
        {assistant && <div id="copiloto-slot-side" className="px-4 pb-3" />}
        {footer && <div className="border-t border-divider px-4 py-3">{footer}</div>}
      </aside>

      {/* Ajuste de 21/11: o cabeçalho acompanha a rolagem no celular, logo abaixo da barra de protótipo. */}
      <header className="sticky top-[var(--proto-h,24px)] z-40 flex items-center gap-3 border-b border-divider bg-surface px-2 py-2 lg:hidden">
        <button
          type="button"
          aria-label="Abrir menu"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="inline-flex size-11 items-center justify-center rounded-sm text-ink hover:bg-surface-muted"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Logo height={24} />
        {mobileTitle && <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{mobileTitle}</span>}
        {assistant && <div id="copiloto-slot-head" className="ml-auto shrink-0" />}
      </header>

      <dialog
        ref={ref}
        aria-label="Menu"
        {...dialogProps}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(320px,85vw)] bg-surface p-0 shadow-highest backdrop:bg-black/50 lg:hidden"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Logo height={24} />
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={close}
            className="inline-flex size-11 items-center justify-center rounded-sm text-ink hover:bg-surface-muted"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {top && <div className="px-4 pb-3">{top}</div>}
        <nav aria-label="Menu principal" className="px-3 pb-6" onClick={onNavClick}>
          {nav}
        </nav>
        {footer && <div className="border-t border-divider px-4 py-3">{footer}</div>}
      </dialog>

      <div id="conteudo" tabIndex={-1} className="min-w-0 scroll-mt-12 focus:outline-none">
        {children}
      </div>
      {/* S8: Assistente do salão (painel do computador empurra o conteúdo por --copiloto-w). */}
      {assistant}
    </div>
  );
}
