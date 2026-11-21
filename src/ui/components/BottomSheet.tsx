"use client";

import { useId, useRef, type ReactNode } from "react";
import { PROTOTYPE_BAR_TEXT } from "./PrototypeBar";
import { useModalDialog } from "./useModalDialog";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Texto de apoio curto, centralizado (como em app/11). */
  description?: ReactNode;
  /** Conteúdo livre (listas, regras, formulários), sem estilo imposto. */
  children?: ReactNode;
  actions?: ReactNode;
  /** `false` em confirmações: o toque no fundo não fecha (Esc continua fechando). */
  dismissible?: boolean;
};

/** Bottom sheet (app/11): alça 40×4, fundo #FAFAFA, raio ~56 px, até 420 px (coluna do app). */
export function BottomSheet({ open, onClose, title, description, children, actions, dismissible = true }: Props) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { ref, dialogProps } = useModalDialog(open, onClose, dismissible, titleRef);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      {...dialogProps}
      className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[90dvh] w-full max-w-[420px] overflow-y-auto overscroll-contain rounded-t-sheet bg-sheet px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-2.5 text-ink shadow-high backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      {/* A barra da página fica atrás do fundo do modal: repete o aviso no topo enquanto o sheet está aberto. */}
      <p data-testid="prototype-bar-sheet" className="fixed inset-x-0 top-0 z-10 bg-proto-bg px-4 py-1 text-center text-xs leading-4 text-proto-fg">
        {PROTOTYPE_BAR_TEXT}
      </p>
      <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-handle" />
      <h2 ref={titleRef} tabIndex={-1} id={titleId} className={`${children ? "mt-6" : "mt-12"} text-center text-lg font-semibold leading-6 outline-none`}>
        {title}
      </h2>
      {description && <div className="mt-3 text-center text-sm leading-5 text-ink-muted">{description}</div>}
      {children && <div className="mt-4">{children}</div>}
      {actions && (
        <div className="sticky bottom-0 -mx-5 mt-6 flex gap-3 bg-sheet px-5 pb-1 pt-3 [&>*]:min-w-max [&>*]:flex-1 [&>*]:basis-0 [&>*]:whitespace-nowrap [&>*]:px-4">{actions}</div>
      )}
    </dialog>
  );
}
