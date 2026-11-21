"use client";

import { useRouter } from "next/navigation";

/** Rodapé da barra lateral (portal/05): usuário logado + Sair. Só a dica mascarada do e-mail (D118). */
export function AccountFooter({ hint }: { hint: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/parceiro/sair", { method: "POST" });
    router.replace("/parceiro/entrar");
    router.refresh();
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{hint}</p>
        <p className="text-xs text-ink-muted">Usuário logado</p>
      </div>
      <button type="button" onClick={logout} className="min-h-11 rounded-sm px-3 text-sm font-semibold text-red-text hover:bg-surface-muted">
        Sair
      </button>
    </div>
  );
}
