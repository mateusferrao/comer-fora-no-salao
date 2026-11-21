"use client";

import Link from "next/link";

/** Por que mais de uma por folha (ajuste de 21/11: "não entendi a lógica de ser 3"). */
const WHY: Partial<Record<keyof typeof SIZE, string>> = {
  porta_conta: "Cada folha A4 rende 3 porta-contas iguais de 21 × 9,9 cm (⅓ de A4, o tamanho do encarte de porta-conta). Recorte nas linhas tracejadas.",
  garcom: "Cada folha A4 rende 4 cartões iguais, um para cada garçom. Recorte nas linhas tracejadas.",
};
const SIZE = { display: "meia A4 (A5)", cartaz: "A4", garcom: "A4 com 4 cartões para recortar", porta_conta: "A4 com 3 porta-contas de 21 × 9,9 cm para recortar" };

const TITLE = { display: "display de mesa", cartaz: "cartaz", garcom: "cartões do garçom", porta_conta: "porta-contas" };

export function PrintToolbar({ kind }: { kind: "display" | "cartaz" | "garcom" | "porta_conta" }) {
  return (
    <div className="mx-4 flex w-[calc(100%-2rem)] max-w-3xl flex-wrap items-center justify-between gap-3 rounded-sm bg-white px-4 py-2 print:hidden">
      <h1 className="sr-only">Imprimir {TITLE[kind]}</h1>
      <Link href="/parceiro/salao/kit" className="min-h-11 content-center text-sm font-semibold text-red-text underline">
        Voltar ao kit
      </Link>
      <p className="text-sm text-ink-muted">Tamanho: {SIZE[kind]}. Para PDF, escolha &quot;Salvar como PDF&quot; na impressão.</p>
      {WHY[kind] && <p className="w-full text-sm text-ink">{WHY[kind]}</p>}
      <button type="button" onClick={() => window.print()} className="min-h-11 rounded-xs bg-red-button px-5 text-sm font-semibold text-white">
        Imprimir
      </button>
    </div>
  );
}
