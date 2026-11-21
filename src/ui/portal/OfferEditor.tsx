"use client";

import { Select } from "../components/Select";
import { useId } from "react";
import { offerRegistry, OFFER_KINDS, MAX_DISCOUNT_PCT, type OfferKind } from "@/src/modules/beneficios/domain/offers";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";

export type OfferValue = { kind: OfferKind; itemId: string; pct?: number };
const LABEL: Record<OfferKind, string> = { doce_gratis: "Doce grátis", entrada_gratis: "Entrada grátis", cortesia: "Ganhe cortesia", leve2pague1: "Leve 2, pague 1", desconto: "Desconto" };

export function itemsFor(kind: OfferKind, menu: readonly MenuItem[]): MenuItem[] {
  const cats = offerRegistry[kind].categories;
  return menu.filter((i) => cats === "todas" || cats.includes(i.category));
}

/** Tipo + item do cardápio (+ % no desconto, teto de 50%): o código valida; nada é escrito pela IA. */
export function OfferEditor({ value, onChange, menu, label }: { value: OfferValue; onChange: (v: OfferValue) => void; menu: readonly MenuItem[]; label: string }) {
  const id = useId();
  const items = itemsFor(value.kind, menu);
  const cls = "min-h-11 rounded-sm border border-border bg-white px-2 text-sm text-ink";
  return (
    <fieldset className="flex flex-wrap items-end gap-3">
      <legend className="sr-only">{label}</legend>
      <Select
        label="Tipo"
        labelClassName="text-xs font-medium text-ink-muted"
        value={value.kind}
        options={OFFER_KINDS.filter((k) => itemsFor(k, menu).length).map((k) => ({ value: k, label: LABEL[k] }))}
        onChange={(v) => {
          const kind = v as OfferKind;
          const first = itemsFor(kind, menu)[0];
          onChange({ kind, itemId: itemsFor(kind, menu).some((i) => i.id === value.itemId) ? value.itemId : (first?.id ?? ""), ...(kind === "desconto" ? { pct: value.pct ?? 15 } : {}) });
        }}
      />
      <Select
        label="Item do cardápio"
        labelClassName="text-xs font-medium text-ink-muted"
        value={value.itemId}
        options={items.map((i) => ({ value: i.id, label: i.name }))}
        onChange={(v) => onChange({ ...value, itemId: v })}
      />
      {value.kind === "desconto" && (
        <label htmlFor={`${id}-p`} className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
          Desconto (%)
          <input
            id={`${id}-p`}
            type="number"
            min={1}
            max={MAX_DISCOUNT_PCT}
            className={`${cls} w-24`}
            value={value.pct ?? 15}
            onChange={(e) => onChange({ ...value, pct: Math.max(1, Math.min(MAX_DISCOUNT_PCT, Number(e.target.value) || 1)) })}
          />
        </label>
      )}
    </fieldset>
  );
}
