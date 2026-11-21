import { cn } from "../cn";

/** Código grande para o garçom ("Informe este código ao garçom"), lido letra a letra por leitores de tela. */
export function CodeDisplay({ code, className }: { code: string; className?: string }) {
  return (
    <p
      aria-label={`Código ${code.split("").join(" ")}`}
      className={cn("select-all rounded-md bg-surface-muted px-4 py-3 text-center font-mono text-3xl font-semibold tracking-[0.3em] text-ink", className)}
    >
      {code}
    </p>
  );
}
