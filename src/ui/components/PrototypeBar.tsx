"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const PROTOTYPE_BAR_TEXT = "Protótipo de case · não é produto oficial do iFood";

const link = "-my-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-xs underline underline-offset-2 hover:text-white focus-visible:outline-2 focus-visible:outline-white";

/**
 * Barra única e fixa (espec. 3.1, D92): texto sempre completo; a partir de 640 px em 1 linha (≤ 28 px), abaixo em até
 * 2 linhas (≤ 44 px). Só o link "Como funciona" (D156), com alvo de 24 px; no celular vira ícone com rótulo. Dentro de um iframe (modo apresentação), a barra some: ela fica na página de fora.
 */
export function PrototypeBar() {
  const path = usePathname() ?? "/";
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- só no navegador dá para saber se está num iframe
    setEmbedded(window.self !== window.top);
  }, []);
  if (embedded) return null;
  const showHow = !path.startsWith("/bastidores/como-funciona");
  // "Pular para o conteúdo" vem antes dos links da barra (1º foco), nas telas com o PortalShell (#conteudo).
  const skip = path.startsWith("/parceiro/salao") || path.startsWith("/bastidores/componentes");
  return (
    <aside aria-label="Aviso de protótipo" className="sticky top-0 z-50 bg-proto-bg px-3 py-0.5 text-center text-xs leading-4 text-proto-fg">
      {skip && (
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-12 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-sm focus:bg-ink focus:px-4 focus:text-sm focus:font-medium focus:text-white"
        >
          Pular para o conteúdo
        </a>
      )}
      <span data-testid="prototype-bar">{PROTOTYPE_BAR_TEXT}</span>
      {showHow && (
        <span className="ml-2 inline-flex items-center gap-2 align-middle text-white/85">
          <a href="/bastidores/como-funciona" className={link}>
            <span aria-hidden="true" className="sm:hidden">?</span>
            <span className="sr-only sm:not-sr-only">Como funciona</span>
          </a>
        </span>
      )}
    </aside>
  );
}
