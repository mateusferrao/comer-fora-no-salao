import type { ReactNode } from "react";
import { cn } from "../cn";

/**
 * Barra de ação fixa no rodapé ao rolar (D253), no celular e no computador: só em telas com UMA ação que fecha a tela
 * (passos da ativação, aprovar o plano, salvar avisos). A mensagem de erro da ação vai dentro da barra, para não ficar
 * escondida atrás dela. Pressupõe o `main` do Portal com `px-4 sm:px-8` (a barra ocupa a largura do conteúdo).
 */
export function StickyActions({ children, message, className, justify = "end" }: { children: ReactNode; message?: ReactNode; className?: string; justify?: "end" | "between" }) {
  return (
    <div
      data-acoes-fixas
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-2 flex flex-col gap-2 border-t border-divider bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:-mx-8 sm:px-8",
        className,
      )}
    >
      {message}
      <div className={cn("flex flex-wrap items-center gap-3", justify === "between" ? "justify-between" : "justify-end")}>{children}</div>
    </div>
  );
}
