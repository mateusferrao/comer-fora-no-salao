"use client";

import { useState } from "react";
import { Switch } from "@/src/ui/components/Switch";

export type PrefsItem = { restaurantId: string; restaurant: string; email: boolean; convites: boolean; lembretes: boolean; app: boolean };
type Patch = Partial<Pick<PrefsItem, "email" | "convites" | "lembretes" | "app">>;

/**
 * "Gerenciar notificações" (S6.1 — D198; app/14): por restaurante, "E-mail" (chave-mestra) com "Convites" e
 * "Lembretes" abaixo e "Convites de volta no app". Grava a cada toque (POST). `token`: veio do link do e-mail.
 */
export function NotificationPrefs({ items: initial, token }: { items: PrefsItem[]; token?: string }) {
  const [items, setItems] = useState(initial);
  const [msg, setMsg] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const save = async (it: PrefsItem, patch: Patch) => {
    const prev = items;
    setItems(items.map((x) => (x.restaurantId === it.restaurantId ? { ...x, ...patch } : x)));
    const r = await fetch("/api/cliente/preferencias", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(token ? { t: token, patch } : { restaurantId: it.restaurantId, patch }),
    }).catch(() => null);
    if (r?.ok) setMsg({ id: it.restaurantId, text: "Preferências salvas" });
    else {
      setItems(prev);
      setMsg({ id: it.restaurantId, text: "Não foi possível salvar. Tente de novo.", error: true });
    }
  };
  if (!items.length) return <p className="text-sm text-ink-muted">Você ainda não fez check-in em nenhum restaurante.</p>;
  return (
    <div className="flex flex-col gap-4 text-left" data-testid="preferencias">
      {items.map((it) => (
        <section key={it.restaurantId} aria-label={`Notificações de ${it.restaurant}`} className="flex flex-col rounded-xl border border-border bg-white px-4 py-2">
          <h3 className="pt-2 text-base font-semibold text-ink">{it.restaurant}</h3>
          <Switch label="E-mail" checked={it.email} onChange={(v) => void save(it, { email: v })} />
          <div className="pl-4">
            <Switch label="Convites" hint="Inclui o convite para voltar" checked={it.email && it.convites} disabled={!it.email} onChange={(v) => void save(it, { convites: v })} />
            <Switch label="Lembretes" hint="No dia em que o convite vale" checked={it.email && it.lembretes} disabled={!it.email} onChange={(v) => void save(it, { lembretes: v })} />
          </div>
          <Switch label="Convites de volta no app" hint="Sem e-mail e sem esta opção, você não recebe convites para voltar" checked={it.app} onChange={(v) => void save(it, { app: v })} />
          {msg?.id === it.restaurantId && (
            <p role={msg.error ? "alert" : "status"} className={msg.error ? "pb-2 text-sm text-red-text" : "pb-2 text-sm text-ink-muted"}>
              {msg.text}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
