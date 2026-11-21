"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type StoreOption = { id: string; name: string; label: string };
type Props = { name: string | null; open: boolean | null; stores: StoreOption[]; currentId: string | null };

/** Topo da barra lateral (portal/02 e 05): nome da loja, "Trocar loja" e caixa aberta/fechada. */
export function StoreBox({ name, open, stores, currentId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function change(id: string) {
    if (!id || id === currentId) return;
    setBusy(true);
    try {
      await fetch("/api/parceiro/loja", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restaurantId: id }) });
      router.push("/parceiro/salao");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-base font-bold leading-5 text-ink">{name ?? "Nenhuma loja ainda"}</p>
      {stores.length > 1 && (
        <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
          Trocar loja
          <select
            className="min-h-11 rounded-sm border border-border bg-white px-2 text-sm text-ink"
            value={currentId ?? ""}
            disabled={busy}
            onChange={(e) => change(e.target.value)}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {open !== null && (
        <div className="flex items-center gap-2 rounded-sm bg-surface-muted px-3 py-2">
          <span aria-hidden="true" className={open ? "size-2 rounded-full bg-green" : "size-2 rounded-full bg-ink-muted"} />
          <span className="text-xs leading-4 text-ink">
            <strong className="block">{open ? "Loja aberta" : "Loja fechada"}</strong>
            {!open && "Fora do horário programado"}
          </span>
        </div>
      )}
    </div>
  );
}
