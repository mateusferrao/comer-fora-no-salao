"use client";

import { cn } from "../cn";

const LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];
const NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Dias da semana D S T Q Q S S (portal/02 e 03): selecionado = círculo vermelho; rótulo completo para leitor de tela. */
export function DaySelector({ value, onChange, label = "Dias da semana" }: { value: number[]; onChange: (days: number[]) => void; label?: string }) {
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {LETTERS.map((l, d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={NAMES[d]}
            onClick={() => toggle(d)}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-full text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              on ? "bg-red-button text-white" : "border border-border bg-white text-ink hover:bg-surface-muted",
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
