"use client";

import { Select } from "./Select";

export const HALF_HOURS = Array.from({ length: 49 }, (_, i) => i * 30);
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Dois seletores unidos de início/fim (portal/03), de 30 em 30 min. */
export function TimeRange({ start, end, onChange, label }: { start: number; end: number; onChange: (start: number, end: number) => void; label: string }) {
  const opt = (m: number) => ({ value: String(m), label: m === 1440 ? "24:00" : hhmm(m) });
  return (
    <fieldset className="flex items-end gap-2">
      <legend className="sr-only">{label}</legend>
      <Select label="Início" hideLabel value={String(start)} options={HALF_HOURS.slice(0, -1).map(opt)} onChange={(v) => onChange(Number(v), end)} className="w-28" />
      <span aria-hidden="true" className="pb-3">
        –
      </span>
      <Select label="Fim" hideLabel value={String(end)} options={HALF_HOURS.slice(1).map(opt)} onChange={(v) => onChange(start, Number(v))} className="w-28" />
    </fieldset>
  );
}
