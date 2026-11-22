"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type RefObject, type SyntheticEvent } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * `<dialog>` modal controlado: `showModal()` (fundo inerte), Tab circula dentro, Esc fecha,
 * clique no fundo fecha (se `dismissible`) e o foco volta para quem abriu.
 */
export function useModalDialog(open: boolean, onClose: () => void, dismissible = true, initialFocus?: RefObject<HTMLElement | null>, opts: { modal?: boolean } = {}) {
  // D258: `modal: false` abre com `show()` (não vai para a camada superior): o painel fica preso dentro da moldura
  // do celular. Esc e o foco preso continuam pelo teclado; o fundo escurecido é de quem chama.
  const modal = opts.modal ?? true;
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      if (modal) dialog.showModal();
      else dialog.show();
      // Foco inicial no título (não no 1º campo): no celular, o teclado não sobe sozinho e o leitor de tela lê o título.
      initialFocus?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnTo.current?.focus();
      returnTo.current = null;
    }
  }, [open, initialFocus, modal]);

  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault(); // o estado é controlado: quem fecha é o pai
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (!modal && e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0] as HTMLElement;
    const last = items[items.length - 1] as HTMLElement;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !e.currentTarget.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !e.currentTarget.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (!dismissible || e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) onClose();
  };

  return { ref, dialogProps: { onCancel, onKeyDown, onClick } };
}
