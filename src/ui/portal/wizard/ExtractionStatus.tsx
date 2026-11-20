"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "./api";

export type ExtractionState = { status: "lendo" | "pronto" | "falhou" | "nao_cardapio"; count?: number; parcial?: boolean; cache?: boolean; simulado?: boolean };

/** Estado da leitura do cardápio em segundo plano ("lendo seu cardápio… · 23 itens encontrados"). */
export function useExtraction(id: string | null, initial: ExtractionState | null) {
  const [st, setSt] = useState<ExtractionState | null>(initial);
  useEffect(() => {
    if (!id || (st && st.status !== "lendo")) return;
    const t = setTimeout(async () => {
      const r = await api<{ status: ExtractionState["status"]; result: { itens?: unknown[]; parcial?: boolean; cache?: boolean; simulado?: boolean } | null }>(`/api/parceiro/cardapio/${id}`).catch(() => null);
      // Erro passageiro: novo objeto de estado para a consulta continuar (revisão da S2).
      if (!r?.ok) return setSt((s) => (s ? { ...s } : { status: "lendo" }));
      setSt({ status: r.data.status, count: r.data.result?.itens?.length, parcial: r.data.result?.parcial, cache: r.data.result?.cache, simulado: r.data.result?.simulado });
    }, 1500);
    return () => clearTimeout(t);
  }, [id, st]);
  return st;
}

export function ExtractionStatus({ state }: { state: ExtractionState | null }) {
  if (!state) return null;
  const text =
    state.status === "lendo"
      ? "Lendo seu cardápio…"
      : state.status === "pronto"
        ? `${state.count ?? 0} itens encontrados${state.cache ? " · processado anteriormente" : ""}${state.simulado ? " · importação simulada" : ""}${state.parcial ? " · leitura parcial: confira" : ""}`
        : state.status === "nao_cardapio"
          ? "Isso não parece um cardápio."
          : "Não conseguimos ler o cardápio agora.";
  const failed = state.status === "nao_cardapio" || state.status === "falhou";
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-sm bg-surface-muted px-3 py-2 text-sm text-ink">
      {state.status === "lendo" && <span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-ink border-t-transparent" />}
      <span>
        {text}
        {failed && (
          <>
            {" "}
            <Link href="/parceiro/salao/ativar/3" className="font-semibold text-red-text underline">
              Digitar os itens
            </Link>{" "}
            ou{" "}
            <Link href="/parceiro/salao/ativar/1" className="font-semibold text-red-text underline">
              usar um exemplo
            </Link>
            .
          </>
        )}
      </span>
    </p>
  );
}
