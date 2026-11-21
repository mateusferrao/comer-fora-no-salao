"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/Button";
import { DaySelector } from "../../components/DaySelector";
import { Field } from "../../components/Field";
import { TimeRange } from "../../components/TimeRange";
import { api, markStep } from "./api";
import { ExtractionStatus, useExtraction, type ExtractionState } from "./ExtractionStatus";

export type SalonForm = {
  name: string;
  tables: number;
  weeklyCustomers: number | null;
  opening: Array<{ days: number[]; startMin: number; endMin: number }>;
  slots: Array<{ id?: string; days: number[]; startMin: number; endMin: number; intensity: "muito" | "um_pouco"; extraTables: number }>;
  ticketCents: number | null;
  marginPct: number | null;
};

const SLOT_ERRORS: Record<string, string> = {
  dias_vazios: "Escolha pelo menos um dia.",
  horario_invalido: "O fim precisa ser depois do início.",
  fora_do_funcionamento: "Esse horário precisa estar dentro do horário de funcionamento em todos os dias escolhidos.",
};

const toReais = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));
const fromReais = (s: string) => {
  const v = Number(s.replace(/\./g, "").replace(",", "."));
  return s.trim() === "" || !Number.isFinite(v) ? null : Math.round(v * 100);
};

/** Passo 2 (espec. 3.2): salão, funcionamento e horários vazios (obrigatório), enquanto a IA lê. */
export function Step2Salao({ initial, extractionId, extraction, manual = false }: { initial: SalonForm; extractionId: string | null; extraction: ExtractionState | null; manual?: boolean }) {
  const router = useRouter();
  const [f, setF] = useState<SalonForm>(initial);
  const [ticket, setTicket] = useState(toReais(initial.ticketCents));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const ext = useExtraction(extractionId, extraction);
  useEffect(() => markStep(2), []);

  const set = <K extends keyof SalonForm>(k: K, v: SalonForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const setSlot = (i: number, patch: Partial<SalonForm["slots"][number]>) => set("slots", f.slots.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  async function submit() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = "Informe o nome do restaurante.";
    if (!(f.tables >= 1)) e.tables = "Informe quantas mesas o salão tem.";
    if (!f.opening.some((b) => b.days.length)) e.opening = "Escolha os dias de funcionamento.";
    if (!f.slots.length) e.slots = "Adicione pelo menos um horário vazio.";
    f.slots.forEach((s, i) => {
      if (!s.days.length) e[`slot${i}`] = "Escolha os dias em que este horário fica vazio.";
      else if (!(s.extraTables >= 1)) e[`slot${i}`] = "Informe quantas mesas a mais por semana.";
    });
    f.opening.forEach((b, i) => {
      if (!b.days.length && f.opening.length > 1) e.opening = `Escolha os dias do turno ${i + 1} ou remova-o.`;
    });
    const ticketCents = fromReais(ticket);
    if (ticket.trim() && ticketCents === null) e.ticket = "Use um valor como 85,00.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const r = await api<{ ok?: boolean; slotErrors?: string[][] }>("/api/parceiro/salao", "POST", { ...f, name: f.name.trim(), ticketCents });
    setBusy(false);
    if (r.ok) {
      router.push(manual ? "/parceiro/salao/ativar/3?manual=1" : "/parceiro/salao/ativar/3");
      router.refresh();
      return;
    }
    const se: Record<string, string> = {};
    r.data.slotErrors?.forEach((errs, i) => errs[0] && (se[`slot${i}`] = SLOT_ERRORS[errs[0]] ?? "Confira este horário."));
    setErrors(Object.keys(se).length ? se : { geral: "Confira os campos e tente de novo." });
  }

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <h2 className="text-xl font-bold text-ink">Seu salão</h2>
        <p className="mt-1 text-sm text-ink-muted">Enquanto a IA lê o cardápio, conte como é o seu salão e quais horários ficam vazios.</p>
      </div>
      <ExtractionStatus state={ext} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nome do restaurante" value={f.name} onChange={(e) => set("name", e.target.value)} error={errors.name} maxLength={60} />
        <Field label="Número de mesas" type="number" inputMode="numeric" min={1} value={f.tables || ""} onChange={(e) => set("tables", Number(e.target.value))} error={errors.tables} />
        <Field
          label="Clientes de salão por semana"
          type="number"
          inputMode="numeric"
          min={0}
          hint="Estimativa."
          value={f.weeklyCustomers ?? ""}
          onChange={(e) => set("weeklyCustomers", e.target.value === "" ? null : Number(e.target.value))}
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-sm border border-border p-4">
        <legend className="px-1 font-semibold text-ink">Horário de funcionamento</legend>
        {f.opening.map((b, i) => (
          <div key={i} className="flex flex-col gap-2 border-b border-divider pb-3 last:border-0 last:pb-0">
            <DaySelector label={`Dias do turno ${i + 1} de funcionamento`} value={b.days} onChange={(days) => set("opening", f.opening.map((x, k) => (k === i ? { ...x, days } : x)))} />
            <div className="flex flex-wrap items-center gap-3">
              <TimeRange label={`Horário do turno ${i + 1}`} start={b.startMin} end={b.endMin} onChange={(startMin, endMin) => set("opening", f.opening.map((x, k) => (k === i ? { ...x, startMin, endMin } : x)))} />
              {f.opening.length > 1 && (
                <button type="button" className="min-h-11 text-sm font-semibold text-red-text underline" onClick={() => set("opening", f.opening.filter((_, k) => k !== i))}>
                  Remover turno
                </button>
              )}
            </div>
          </div>
        ))}
        {errors.opening && <p className="text-sm font-medium text-red-text">{errors.opening}</p>}
        <button type="button" className="min-h-11 self-start text-sm font-semibold text-red-text underline" onClick={() => set("opening", [...f.opening, { days: [], startMin: 18 * 60, endMin: 23 * 60 }])}>
          + Adicionar turno
        </button>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-semibold text-ink">Horários vazios</legend>
        <p className="text-sm text-ink-muted">Faixas em que sobra mesa. O convite de volta vai trazer clientes para elas.</p>
        {f.slots.map((s, i) => (
          <div key={s.id ?? i} className="flex flex-col gap-3 rounded-sm border border-border p-4">
            <p className="text-sm font-semibold text-ink">Horário vazio {i + 1}</p>
            <DaySelector label={`Dias do horário vazio ${i + 1}`} value={s.days} onChange={(days) => setSlot(i, { days })} />
            <TimeRange label={`Horário do horário vazio ${i + 1}`} start={s.startMin} end={s.endMin} onChange={(startMin, endMin) => setSlot(i, { startMin, endMin })} />
            <div className="flex flex-wrap items-end gap-4">
              <fieldset className="flex flex-col gap-1">
                <legend className="text-sm font-medium text-ink">Quanto fica vazio?</legend>
                <div className="flex gap-2">
                  {(["muito", "um_pouco"] as const).map((v) => (
                    <label key={v} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-border px-3 text-sm has-[:checked]:border-red-text has-[:checked]:text-red-text">
                      <input type="radio" name={`intensidade-${i}`} checked={s.intensity === v} onChange={() => setSlot(i, { intensity: v })} className="accent-[#e71c2b]" />
                      {v === "muito" ? "Muito" : "Um pouco"}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field
                className="w-56"
                label="Mesas a mais por semana"
                type="number"
                inputMode="numeric"
                min={1}
                value={s.extraTables || ""}
                onChange={(e) => setSlot(i, { extraTables: Number(e.target.value) })}
              />
              {f.slots.length > 1 && (
                <button type="button" className="min-h-11 text-sm font-semibold text-red-text underline" onClick={() => set("slots", f.slots.filter((_, k) => k !== i))}>
                  Remover
                </button>
              )}
            </div>
            {errors[`slot${i}`] && <p className="text-sm font-medium text-red-text">{errors[`slot${i}`]}</p>}
          </div>
        ))}
        {errors.slots && <p className="text-sm font-medium text-red-text">{errors.slots}</p>}
        {f.slots.length < 4 && (
          <button
            type="button"
            className="min-h-11 self-start text-sm font-semibold text-red-text underline"
            onClick={() => set("slots", [...f.slots, { days: [], startMin: 15 * 60, endMin: 18 * 60, intensity: "um_pouco", extraTables: 3 }])}
          >
            + Adicionar horário vazio
          </button>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold text-ink">Retorno (opcional)</legend>
        <Field label="Ticket médio por pessoa (R$)" inputMode="decimal" value={ticket} onChange={(e) => setTicket(e.target.value)} error={errors.ticket} hint="Estimativa sua; usada só para calcular retorno." />
        <Field
          label="Margem aproximada (%)"
          type="number"
          inputMode="numeric"
          min={1}
          max={95}
          value={f.marginPct ?? ""}
          onChange={(e) => set("marginPct", e.target.value === "" ? null : Number(e.target.value))}
          hint="Estimativa sua; usada só para calcular retorno."
        />
      </fieldset>

      {errors.geral && (
        <p role="alert" className="text-sm font-medium text-red-text">
          {errors.geral}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="primary-portal" loading={busy}>
          Continuar
        </Button>
      </div>
    </form>
  );
}
