import type { ReactNode } from "react";
import { cn } from "../cn";

type Props = {
  children: ReactNode;
  className?: string;
  /** Ocupa a altura da tela (padrão). `false` para exibir a casca dentro de outra página (galeria). */
  fullHeight?: boolean;
  /** Fundo da coluna (ex.: tela escura do check-in até o fim da página). */
  columnClassName?: string;
};

/** Casca do App: coluna de 420 px no computador, largura total no celular; fora da coluna, cinza neutro. */
export function AppShell({ children, className, fullHeight = true, columnClassName }: Props) {
  return (
    <div className={cn("flex justify-center bg-page", fullHeight && "min-h-dvh", className)}>
      <div className={cn("w-full max-w-[420px] bg-surface", columnClassName)}>{children}</div>
    </div>
  );
}
