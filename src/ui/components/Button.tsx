"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { cn } from "../cn";

export type ButtonVariant = "primary-app" | "secondary-app" | "outline-app" | "primary-portal" | "outline-portal";

const VARIANTS: Record<ButtonVariant, string> = {
  // app/04: 48 px de altura, raio 12, preto #151515
  "primary-app": "min-h-12 rounded-md bg-ink px-6 text-base font-medium text-white hover:bg-black",
  // app/04 "Avaliar": cinza #F5F5F5 com contorno #EBEBEB
  "secondary-app": "min-h-12 rounded-md border border-border bg-surface-muted px-6 text-base font-medium text-ink hover:bg-[#ececec]",
  // app/11 "Fechar" dentro do sheet: branco com contorno #EBEBEB
  "outline-app": "min-h-12 rounded-md border border-border bg-white px-6 text-base font-medium text-ink hover:bg-surface-muted",
  // portal/01 "Avançar": vermelho com texto branco (D80), raio 4; altura mínima 44 (acessibilidade)
  "primary-portal": "min-h-11 rounded-xs bg-red-button px-5 text-sm font-semibold text-white hover:brightness-95",
  "outline-portal": "min-h-11 rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text hover:bg-red-text/5",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean };

/**
 * Botão base. Carregando ≠ desabilitado: no carregando o botão continua focável (`aria-disabled`),
 * ignora cliques e mantém a cor cheia; só `disabled` fica esmaecido.
 */
export function Button({ variant = "primary-app", loading = false, disabled, className, children, type = "button", onClick, ...rest }: Props) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      className={cn(
        "inline-flex min-w-11 items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        loading && "cursor-progress",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 motion-safe:animate-spin">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
      <span aria-live="polite" className="sr-only">
        {loading ? "Carregando" : ""}
      </span>
    </button>
  );
}
