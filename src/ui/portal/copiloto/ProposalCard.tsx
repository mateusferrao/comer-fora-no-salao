"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/src/ui/components/Button";
import { confirmDialog } from "@/src/ui/components/ConfirmDialog";

export type CardPreview = {
  titulo: string;
  linhas: Array<{ campo: string; antes: string; depois: string }>;
  alcance?: string;
  impacto?: string;
  avisos: string[];
  aba: string;
};
export type Card = { id: string; status: "pendente"; preview: CardPreview } | { id: null; status: "recusada"; motivo: string };
/** Estado do cartão depois da decisão do dono, guardado na conversa (revisão S8: voltar/atualizar não reabre "Aplicar"). */
export type CardEstado = "aplicada" | "descartada" | "erro";
type Status = "pendente" | "aplicando" | CardEstado;

const ABA_LABEL: Record<string, string> = { agora: "Benefício agora", cartela: "Cartela", convites: "Horários vazios e convites", cardapio: "Cardápio", restaurante: "Restaurante", ia: "IA do restaurante", avisos: "Avisos e automação", plano: "Plano da semana" };
export const abaHref = (aba: string, v?: string) => (aba === "plano" ? "/parceiro/salao/plano" : `/parceiro/salao/configuracoes?aba=${aba}${v ? `&v=${v.slice(0, 8)}` : ""}`);
const doneMsg = (aba: string) => (aba === "plano" ? "Plano aprovado. Veja em Plano da semana." : `Aplicado. Veja em Configurações › ${ABA_LABEL[aba] ?? "Configurações"}.`);

/**
 * Cartão de proposta (S8 — D261): antes → depois, alcance e custo escritos pelo código; nada muda sem "Aplicar".
 * Botões com nome próprio (revisão de produto I5). Cartão com mais de 30 min aparece vencido (a proposta expira).
 */
export function ProposalCard({
  card,
  estado,
  stale,
  dirty,
  onApplied,
  onEstado,
  onNavigate,
}: {
  card: Card;
  estado?: CardEstado;
  stale?: boolean;
  dirty: () => boolean;
  onApplied: (aba: string, id: string) => void;
  onEstado: (id: string, e: CardEstado) => void;
  onNavigate: () => void;
}) {
  const [status, setStatus] = useState<Status>(estado ?? "pendente");
  const [msg, setMsg] = useState<string | null>(estado === "aplicada" && card.status === "pendente" ? doneMsg(card.preview.aba) : estado === "descartada" ? "Descartada." : null);

  if (card.status === "recusada") {
    return (
      <div className="rounded-md border border-divider bg-surface-muted p-3 text-sm text-ink" role="note">
        <p className="font-semibold">Não dá para fazer assim</p>
        <p className="mt-1">{card.motivo}</p>
      </div>
    );
  }
  const p = card.preview;
  const decide = async (acao: "aplicar" | "descartar") => {
    if (acao === "aplicar" && dirty()) {
      const ok = await confirmDialog({ title: "Você tem edições não salvas", body: "Aplicar a proposta atualiza a tela e descarta o que não foi salvo.", confirmLabel: "Aplicar mesmo assim" });
      if (!ok) return;
    }
    setStatus("aplicando");
    try {
      const res = await fetch("/api/parceiro/copiloto/proposta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: card.id, acao }), cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; motivo?: string; status?: string };
      if (data.ok && acao === "descartar") {
        setStatus("descartada");
        setMsg("Descartada.");
        onEstado(card.id, "descartada");
      } else if (data.ok) {
        setStatus("aplicada");
        setMsg(doneMsg(p.aba));
        onEstado(card.id, "aplicada");
        onApplied(p.aba, card.id);
      } else {
        setStatus("erro");
        setMsg(data.motivo ?? (res.status === 429 ? "Muitas mudanças seguidas. Tente de novo mais tarde." : "Não deu para aplicar. Tente pelo formulário."));
        if (data.status !== "em_andamento") onEstado(card.id, "erro");
      }
    } catch {
      setStatus("erro");
      setMsg("Sem conexão com o servidor.");
    }
  };
  // O título já traz o horário: o alcance só aparece quando diz algo a mais (revisão de produto, baixo).
  const showAlcance = p.alcance && !p.titulo.includes(p.alcance.replace(/^Vale para /, ""));
  const open = status === "pendente" || status === "aplicando";

  return (
    <article className="rounded-md border border-divider bg-surface p-3 text-sm text-ink shadow-low" aria-label={`Proposta: ${p.titulo}`}>
      <h3 className="font-semibold">{p.titulo}</h3>
      {showAlcance && <p className="mt-1 text-ink-muted">{p.alcance}</p>}
      <table className="mt-2 w-full border-collapse text-left">
        <thead>
          <tr className="text-xs text-ink-muted">
            <th scope="col" className="py-1 pr-2 font-normal">O que muda</th>
            <th scope="col" className="py-1 pr-2 font-normal">Antes</th>
            <th scope="col" className="py-1 font-normal">Depois</th>
          </tr>
        </thead>
        <tbody>
          {p.linhas.map((l) => (
            <tr key={l.campo} className="border-t border-divider align-top">
              <th scope="row" className="py-1 pr-2 font-normal">{l.campo}</th>
              <td className="py-1 pr-2 whitespace-nowrap text-ink-muted">{l.antes}</td>
              <td className="py-1 font-semibold whitespace-nowrap">{l.depois}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.impacto && <p className="mt-2">{p.impacto}</p>}
      {p.avisos.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-ink-muted">
          {p.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {open && stale ? (
        <p role="note" className="mt-2 text-ink-muted">
          Proposta vencida (vale 30 minutos). Peça de novo para ver a versão atual.
        </p>
      ) : open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary-portal" loading={status === "aplicando"} onClick={() => void decide("aplicar")} aria-label={`Aplicar: ${p.titulo}`}>
            Aplicar
          </Button>
          <Link href={abaHref(p.aba)} onClick={onNavigate} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-red-text underline">
            Editar no formulário
          </Link>
          <button type="button" onClick={() => void decide("descartar")} className="min-h-11 px-2 text-sm text-ink-muted underline" aria-label={`Descartar: ${p.titulo}`}>
            Descartar
          </button>
        </div>
      ) : null}
      {msg && (
        <p role="status" className={`mt-2 ${status === "erro" ? "text-red-text" : "text-ink"}`}>
          {status === "aplicada" ? "✓ " : ""}
          {msg}
          {status === "aplicada" && (
            <>
              {" "}
              <Link href={abaHref(p.aba, card.id)} onClick={onNavigate} className="font-semibold text-red-text underline">
                Abrir
              </Link>
            </>
          )}
        </p>
      )}
    </article>
  );
}
