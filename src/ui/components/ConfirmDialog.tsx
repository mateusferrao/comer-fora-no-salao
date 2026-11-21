"use client";

import { useId, useRef, useSyncExternalStore } from "react";
import { useModalDialog } from "./useModalDialog";

export type ConfirmOptions = {
  title: string;
  /** Uma ou duas frases: o que acontece se confirmar. */
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

// Fila de um item só: há um `ConfirmHost` no layout raiz e quem chama espera a resposta como no `window.confirm`.
let current: Pending | null = null;
// Último conteúdo mostrado: o modal não fica vazio durante o fechamento.
let last: ConfirmOptions | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Confirmação do design system (ajuste de 21/11, no lugar do `window.confirm` nativo): modal centralizado com título,
 * explicação e 2 botões. Devolve `true` só se a pessoa confirmar; Esc, clique fora e "Cancelar" devolvem `false`.
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { ...opts, resolve };
    last = opts;
    emit();
  });
}

function settle(ok: boolean) {
  const p = current;
  current = null;
  emit();
  p?.resolve(ok);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function ConfirmHost() {
  const pending = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { ref, dialogProps } = useModalDialog(
    !!pending,
    () => settle(false),
    true,
    titleRef,
  );
  const titleId = useId();
  const bodyId = useId();
  const o = pending ?? last;
  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={o?.body ? bodyId : undefined}
      {...dialogProps}
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-lg bg-white p-0 text-ink shadow-highest backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-2 px-6 pt-6 pb-2">
        <h2
          ref={titleRef}
          id={titleId}
          tabIndex={-1}
          className="text-lg font-bold text-ink outline-none"
        >
          {o?.title}
        </h2>
        {o?.body && (
          <p id={bodyId} className="text-sm text-ink-muted">
            {o.body}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 px-6 pt-3 pb-6 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => settle(false)}
          className="min-h-11 rounded-xs border border-border bg-white px-5 text-sm font-semibold text-ink hover:bg-surface-muted"
        >
          {o?.cancelLabel ?? "Cancelar"}
        </button>
        <button
          type="button"
          onClick={() => settle(true)}
          className="min-h-11 rounded-xs bg-red-button px-5 text-sm font-semibold text-white hover:brightness-95"
        >
          {o?.confirmLabel ?? "Continuar"}
        </button>
      </div>
    </dialog>
  );
}
