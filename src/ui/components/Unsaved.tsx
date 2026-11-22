"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "./ConfirmDialog";

/*
 * Alterações não salvas (D253): telas que salvam por bloco (Configurações) não ganham um "salvar tudo" fixo — o risco
 * é a pessoa sair sem salvar. O bloco mostra o aviso ao lado do botão e, ao tocar num link do sistema com algo
 * pendente, a confirmação do design system pergunta antes (pedido do candidato: nada de alerta nativo). Fechar ou
 * recarregar a aba não tem como ter modal próprio (o navegador só permite o dele), então não há aviso nesse caso.
 */
let dirtyBlocks = 0;
let navigate: ((href: string) => void) | null = null;

async function onClick(e: MouseEvent) {
  if (dirtyBlocks === 0 || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
  e.preventDefault();
  e.stopPropagation();
  const ok = await confirmDialog({ title: "Sair sem salvar?", body: "Há alterações nesta tela que ainda não foram salvas. Se sair agora, elas se perdem.", confirmLabel: "Sair sem salvar", cancelLabel: "Continuar editando" });
  if (ok) {
    dirtyBlocks = 0;
    document.removeEventListener("click", onClick, true);
    (navigate ?? ((h: string) => window.location.assign(h)))(url.pathname + url.search + url.hash);
  }
}

export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    navigate = (href) => router.push(href);
    if (dirtyBlocks++ === 0) document.addEventListener("click", onClick, true);
    return () => {
      if (--dirtyBlocks <= 0) {
        dirtyBlocks = 0;
        document.removeEventListener("click", onClick, true);
      }
    };
  }, [dirty, router]);
}

export function UnsavedHint({ dirty }: { dirty: boolean }) {
  useUnsavedGuard(dirty);
  return dirty ? (
    <span className="text-sm font-medium text-red-text" data-testid="nao-salvo">
      Alterações não salvas
    </span>
  ) : null;
}
