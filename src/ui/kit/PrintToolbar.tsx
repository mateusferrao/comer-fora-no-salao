"use client";

import Link from "next/link";

const SIZE = { display: "meia A4 (A5)", cartaz: "A4", garcom: "A4 com 4 cartões para recortar" };

export function PrintToolbar({ kind }: { kind: "display" | "cartaz" | "garcom" }) {
  return (
    <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 print:hidden">
      <Link href="/parceiro/salao/kit" className="min-h-11 content-center text-sm font-semibold text-red-text underline">
        Voltar ao kit
      </Link>
      <p className="text-sm text-ink-muted">Tamanho: {SIZE[kind]}. Para PDF, escolha &quot;Salvar como PDF&quot; na impressão.</p>
      <button type="button" onClick={() => window.print()} className="min-h-11 rounded-xs bg-red-button px-5 text-sm font-semibold text-white">
        Imprimir
      </button>
    </div>
  );
}
