"use client";

import { useState } from "react";
import { Button } from "../../components/Button";
import { formatDays, formatHours, INTENSITY_LABEL, type Intensity } from "@/src/modules/beneficios/domain/slots";
import type { SalonFill } from "@/src/modules/ia/tasks/salon";
import { api } from "./api";

const BRL = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

/**
 * "Descreva seu salão em uma frase" (S8 — D265): a IA lê, o código confere os números contra o texto e mostra o que vai
 * preencher. "Preencher o formulário" só muda os campos abaixo (nada é gravado); o dono revisa e clica "Continuar".
 */
export function SalonSentence({ onFill }: { onFill: (f: SalonFill) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fill, setFill] = useState<SalonFill | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function read() {
    setBusy(true);
    setMsg(null);
    setFill(null);
    const r = await api<{ ok: boolean; fill?: SalonFill; motivo?: string; erro?: string }>("/api/parceiro/copiloto/salao", "POST", { texto: text });
    setBusy(false);
    if (r.status === 429) return setMsg("Muitas leituras hoje. Preencha os campos abaixo.");
    if (r.ok && r.data.ok && r.data.fill) return setFill(r.data.fill);
    setMsg(r.data.motivo === "nada_entendido" ? "Não encontrei dados do salão nessa frase. Tente citar dias, horários e mesas, ou preencha abaixo." : "Não consegui ler agora. Preencha os campos abaixo.");
  }

  const lines: string[] = [];
  if (fill) {
    if (fill.name) lines.push(`Nome: ${fill.name}`);
    if (fill.tables) lines.push(`Mesas: ${fill.tables}`);
    if (fill.weeklyCustomers !== null) lines.push(`Clientes por semana: ${fill.weeklyCustomers}`);
    fill.opening?.forEach((b) => lines.push(`Funciona: ${formatDays(b.days)} · ${formatHours(b.startMin, b.endMin)}`));
    fill.slots?.forEach((s) => lines.push(`Horário vazio: ${formatDays(s.days)} · ${formatHours(s.startMin, s.endMin)}${s.intensity ? ` · ${INTENSITY_LABEL[s.intensity as Intensity].toLowerCase()}` : ""}${s.extraTables ? ` · ${s.extraTables} mesas a mais` : ""}`));
    if (fill.ticketCents !== null) lines.push(`Ticket médio: ${BRL(fill.ticketCents)}`);
    if (fill.marginPct !== null) lines.push(`Margem: ${fill.marginPct}%`);
  }

  return (
    <section className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4" aria-labelledby="salao-frase-titulo">
      <div>
        <h3 id="salao-frase-titulo" className="font-semibold text-ink">
          Descrever em uma frase (opcional)
        </h3>
        <p className="mt-1 text-sm text-ink-muted">A IA preenche os campos abaixo para você revisar. Números que você não disser ficam em branco.</p>
      </div>
      <label className="sr-only" htmlFor="salao-frase">
        Descrição do salão
      </label>
      <textarea
        id="salao-frase"
        value={text}
        maxLength={600}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ex.: 12 mesas, abro de terça a domingo das 11h às 23h; terça e quarta à tarde, das 15h às 18h, fica muito vazio e quero 4 mesas a mais."
        className="min-h-11 rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink"
      />
      <Button variant="outline-portal" className="self-start" loading={busy} disabled={text.trim().length < 10} onClick={() => void read()}>
        Ler a frase
      </Button>
      {msg && (
        <p role="status" className="text-sm text-ink">
          {msg}
        </p>
      )}
      {fill && (
        <div className="flex flex-col gap-2 rounded-sm border border-border bg-surface p-3 text-sm text-ink" role="status">
          <p className="font-semibold">Vou preencher:</p>
          <ul className="list-disc pl-5">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {fill.naoInformado.length > 0 && <p className="text-ink-muted">Não informado (complete abaixo, se quiser): {fill.naoInformado.join(", ")}.</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary-portal" onClick={() => (onFill(fill), setFill(null), setMsg("Pronto. Revise os campos abaixo e clique em Continuar."))}>
              Preencher o formulário
            </Button>
            <button type="button" className="min-h-11 px-2 text-sm text-ink-muted underline" onClick={() => setFill(null)}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
