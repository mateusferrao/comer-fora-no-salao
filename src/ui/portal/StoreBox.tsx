"use client";

import { Select } from "../components/Select";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateRestaurant } from "./CreateRestaurantButton";

/** Valor da opção "+ Nova loja" no seletor (D256): não é uma loja, cria uma e abre a ativação. */
const NEW_STORE = "__nova_loja__";

export type StoreOption = { id: string; name: string; label: string };
type Props = { name: string | null; open: boolean | null; stores: StoreOption[]; currentId: string | null };

/** Topo da barra lateral (portal/02 e 05): nome da loja, "Trocar loja" e caixa aberta/fechada. */
export function StoreBox({ name, open, stores, currentId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const newStore = useCreateRestaurant();
  async function change(id: string) {
    if (id === NEW_STORE) return void newStore.create();
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
      {stores.length > 0 && (
        <Select
          label="Trocar loja"
          labelClassName="text-xs font-medium text-ink-muted"
          value={currentId ?? ""}
          disabled={busy || newStore.loading}
          options={[...stores.map((s) => ({ value: s.id, label: s.name, hint: s.label })), { value: NEW_STORE, label: "+ Nova loja", hint: "Cadastrar outro restaurante" }]}
          onChange={(v) => change(v)}
        />
      )}
      {newStore.error && (
        <p role="alert" className="text-xs font-medium text-red-text">
          {newStore.error}
        </p>
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
