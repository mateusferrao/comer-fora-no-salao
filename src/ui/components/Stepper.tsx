import Link from "next/link";
import { cn } from "../cn";

/** Passos do assistente (`aria-current="step"` no atual). */
export function Stepper({ steps, current, hrefFor }: { steps: string[]; current: number; hrefFor?: (n: number) => string }) {
  return (
    <ol aria-label="Passos da ativação" className="flex flex-wrap gap-x-4 gap-y-2 text-sm max-sm:gap-x-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "feito" : n === current ? "atual" : "falta";
        return (
          <li key={label} aria-current={state === "atual" ? "step" : undefined} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-full text-xs font-bold",
                state === "atual" ? "bg-red-button text-white" : state === "feito" ? "bg-ink text-white" : "border border-border bg-white text-ink-muted",
              )}
            >
              {state === "feito" ? "✓" : n}
            </span>
            {state === "feito" && hrefFor ? (
              <Link href={hrefFor(n)} className="text-ink-muted underline underline-offset-2 hover:text-ink max-sm:sr-only">
                <span className="sr-only">Concluído (voltar): </span>
                {label}
              </Link>
            ) : (
              // No celular só o passo atual mostra o nome (os outros ficam para leitor de tela): 1 linha em vez de 3.
              <span className={cn(state === "atual" ? "font-semibold text-ink" : "text-ink-muted max-sm:sr-only")}>
                <span className="sr-only">{state === "feito" ? "Concluído: " : state === "atual" ? "Passo atual: " : "Próximo: "}</span>
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
