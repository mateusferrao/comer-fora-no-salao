import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "../cn";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: ReactNode; action?: ReactNode; ref?: Ref<HTMLInputElement> };

/** Campo com rótulo, dica e erro ligados por aria (antecipado da S2 — dívida 14 da revisão da S0). */
export function Field({ label, error, hint, action, id, className, ...rest }: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-dica`;
  const errorId = `${inputId}-erro`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
        {action}
      </div>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-12 rounded-md border bg-white px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink",
          error ? "border-red-text" : "border-border",
        )}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-xs leading-4 text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium leading-4 text-red-text">
          {error}
        </p>
      )}
    </div>
  );
}
