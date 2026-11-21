"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Estado da cópia do restaurante de exemplo da conta (D119): "Preparando…" (atualiza sozinho) ou "Tentar de novo". */
export function DemoStatus({ state }: { state: "criando" | "falhou" | "nenhuma" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (state === "falhou") return;
    const t = setTimeout(() => router.refresh(), 2500);
    return () => clearTimeout(t);
  }, [state, router]);
  if (state === "falhou")
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-sm border border-red-text bg-white p-4 text-sm text-ink">
        Não conseguimos preparar o restaurante de exemplo.
        <button
          type="button"
          disabled={busy}
          className="min-h-11 font-semibold text-red-text underline"
          onClick={async () => {
            setBusy(true);
            await fetch("/api/parceiro/demo", { method: "POST" });
            setTimeout(() => router.refresh(), 1500);
          }}
        >
          Tentar de novo
        </button>
      </div>
    );
  return (
    <p role="status" className="flex items-center gap-2 rounded-sm bg-surface-muted p-4 text-sm text-ink">
      <span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      Preparando o restaurante de exemplo (60 dias de histórico)…
    </p>
  );
}
