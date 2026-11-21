"use client";

import { useId } from "react";

export const HALF_HOURS = Array.from({ length: 49 }, (_, i) => i * 30);
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Dois seletores unidos de início/fim (portal/03), de 30 em 30 min. */
export function TimeRange({ start, end, onChange, label }: { start: number; end: number; onChange: (start: number, end: number) => void; label: string }) {
  const id = useId();
  const cls = "min-h-11 rounded-sm border border-border bg-white px-2 text-sm text-ink";
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <label htmlFor={`${id}-i`} className="sr-only">
        Início
      </label>
      <select id={`${id}-i`} className={cls} value={start} onChange={(e) => onChange(Number(e.target.value), end)}>
        {HALF_HOURS.slice(0, -1).map((m) => (
          <option key={m} value={m}>
            {hhmm(m)}
          </option>
        ))}
      </select>
      <span aria-hidden="true">–</span>
      <label htmlFor={`${id}-f`} className="sr-only">
        Fim
      </label>
      <select id={`${id}-f`} className={cls} value={end} onChange={(e) => onChange(start, Number(e.target.value))}>
        {HALF_HOURS.slice(1).map((m) => (
          <option key={m} value={m}>
            {m === 1440 ? "24:00" : hhmm(m)}
          </option>
        ))}
      </select>
    </fieldset>
  );
}
