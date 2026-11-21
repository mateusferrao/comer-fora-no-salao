"use client";

import { useId } from "react";
import { cn } from "../cn";

type Props = { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string };

/** Interruptor (app/14): trilho vermelho quando ligado; linha inteira com 48 px de alvo. */
export function Switch({ label, checked, onChange, disabled = false, hint }: Props) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex min-h-12 items-center justify-between gap-4">
      <span className="flex flex-col">
        <span id={id} className={cn("text-base", disabled ? "text-ink-muted" : "text-ink")}>
          {label}
        </span>
        {hint && (
          <span id={hintId} className="text-sm text-ink-muted">
            {hint}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex h-11 w-14 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn("relative inline-flex h-7 w-12 items-center rounded-full transition-colors", checked ? "bg-red-button" : "bg-divider")}>
          <span className={cn("inline-block size-6 rounded-full bg-white shadow-low transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
        </span>
      </button>
    </div>
  );
}
