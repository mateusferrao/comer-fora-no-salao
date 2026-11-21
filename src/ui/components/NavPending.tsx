"use client";

import { useLinkStatus } from "next/link";

/**
 * Estado pendente do item do menu (ajuste de 21/11): enquanto a tela nova carrega, o item tocado já aparece marcado
 * (fundo e barra vermelha, como o ativo) com um indicador discreto. Fica dentro do `Link` (useLinkStatus).
 */
export function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span
        aria-hidden="true"
        data-testid="nav-pendente"
        className="absolute inset-0 -z-10 rounded-sm bg-nav-active before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-r-sm before:bg-red-brand"
      />
      <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-red-brand border-t-transparent motion-safe:animate-spin" />
    </>
  );
}
