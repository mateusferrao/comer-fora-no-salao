import type { InputHTMLAttributes } from "react";
import { cn } from "../cn";

const TONE = {
  // Portal: vermelho do botão principal (portal/01).
  portal: "checked:border-red-button checked:bg-red-button",
  // App do cliente: preto do botão principal (app/04).
  app: "checked:border-ink checked:bg-ink",
};

/**
 * Caixa de seleção do design system (D247, no lugar do checkbox nativo azul): 20 px, cantos de 4 px, contorno cinza
 * (3:1 sobre branco) e, marcada, cheia na cor principal com o tique branco. Continua sendo um `<input type="checkbox">`
 * (teclado, leitor de tela e formulários sem mudança); vai dentro de um `<label>` com o texto, que amplia o alvo.
 */
export function Checkbox({ tone = "portal", className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { tone?: keyof typeof TONE }) {
  return (
    <span className={cn("relative inline-flex size-5 shrink-0", className)}>
      <input
        type="checkbox"
        {...props}
        className={cn(
          "peer absolute inset-0 m-0 size-5 cursor-pointer appearance-none rounded-xs border-2 border-ink-muted bg-white transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          TONE[tone],
          "disabled:cursor-not-allowed disabled:border-divider disabled:bg-surface-muted disabled:checked:border-ink-muted/50 disabled:checked:bg-ink-muted/50",
        )}
      />
      <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute inset-0 m-auto size-3.5 text-white opacity-0 peer-checked:opacity-100" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 10 17.5 19 7" />
      </svg>
    </span>
  );
}
