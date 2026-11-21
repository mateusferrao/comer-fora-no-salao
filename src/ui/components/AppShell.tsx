import type { ReactNode } from "react";
import { cn } from "../cn";
import { PhoneFrame } from "./PhoneFrame";

type Props = {
  children: ReactNode;
  className?: string;
  /** Ocupa a altura da tela (padrão). `false` para exibir a casca dentro de outra página (galeria). */
  fullHeight?: boolean;
  /** Fundo da coluna (ex.: tela escura do check-in até o fim da página). */
  columnClassName?: string;
};

/**
 * Casca do App: largura total no celular; a partir de 768 px, dentro de uma moldura de iPhone centralizada (D238 —
 * imersivo para quem avalia no computador). Fora da moldura, cinza neutro.
 */
export function AppShell({ children, className, fullHeight = true, columnClassName }: Props) {
  return (
    <div className={cn("flex justify-center bg-page md:items-start md:py-6", fullHeight && "min-h-dvh", className)}>
      <PhoneFrame responsive height={fullHeight ? "tall" : "auto"} className="max-w-[420px] md:max-w-none">
        <div className={cn("min-h-full w-full bg-surface", columnClassName)}>{children}</div>
      </PhoneFrame>
    </div>
  );
}
