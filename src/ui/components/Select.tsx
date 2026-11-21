"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../cn";
import { BottomSheet } from "./BottomSheet";

export type SelectOption = { value: string; label: string; hint?: string; disabled?: boolean };

type Props = {
  label: string;
  /** Rótulo só para leitor de tela (tabelas, faixas de horário). */
  hideLabel?: boolean;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** `md` = 44 px (Portal); `lg` = 48 px (como o `Field`). */
  size?: "sm" | "md" | "lg";
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
  placeholder?: string;
};

const MOBILE = "(max-width: 639px)";
const SIZE = { sm: "min-h-9 text-sm", md: "min-h-11 text-sm", lg: "min-h-12 text-base" };

/**
 * Seletor do design system (ajuste de 21/11, no lugar do `<select>` nativo): gatilho com a cara dos campos e lista com
 * ✓ e descrição em 2ª linha. No computador abre como lista suspensa (posição fixa: não é cortada por tabelas
 * roláveis); no celular, no `BottomSheet` do app. Padrão ARIA listbox: setas, Home/End, Enter/Espaço, Esc, Tab e busca
 * por letra; o nome acessível do gatilho é "rótulo + valor".
 */
export function Select({ label, hideLabel, value, options, onChange, disabled, size = "md", className, labelClassName, triggerClassName, placeholder = "Escolha" }: Props) {
  const id = useId();
  const labelId = `${id}-rotulo`;
  const buttonId = `${id}-botao`;
  const listId = `${id}-lista`;
  const optId = (i: number) => `${id}-op-${i}`;
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const typed = useRef({ text: "", at: 0 });
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const enabledFrom = useCallback(
    (start: number, step: 1 | -1) => {
      for (let i = start; i >= 0 && i < options.length; i += step) if (!options[i]!.disabled) return i;
      return -1;
    },
    [options],
  );

  // Posição fixa colada ao gatilho; refeita ao rolar ou redimensionar (a lista acompanha o campo).
  const place = useCallback(() => {
    if (!trigger.current) return;
    const r = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 240 && above > below;
    setPos({ left: r.left, width: r.width, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }), maxH: Math.max(160, Math.min(320, up ? above : below)) });
  }, []);
  const openList = () => {
    if (disabled) return;
    const mobile = window.matchMedia(MOBILE).matches;
    setSheet(mobile);
    setActive(selectedIndex >= 0 ? selectedIndex : enabledFrom(0, 1));
    if (!mobile) place();
    setOpen(true);
  };
  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  };
  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
  };

  // Lista aberta: foco nela; clique fora fecha; rolagem e redimensionamento reposicionam.
  useLayoutEffect(() => {
    if (open && !sheet) list.current?.focus();
  }, [open, sheet]);
  useEffect(() => {
    if (!open || sheet) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) place();
    };
    const onResize = () => place();
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, sheet, place]);
  useEffect(() => {
    if (open && active >= 0) document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optId depende só do id estável
  }, [open, active]);

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const k = e.key;
    if (k === "ArrowDown") {
      e.preventDefault();
      const n = enabledFrom(active + 1, 1);
      if (n >= 0) setActive(n);
    } else if (k === "ArrowUp") {
      e.preventDefault();
      const n = enabledFrom(active - 1, -1);
      if (n >= 0) setActive(n);
    } else if (k === "Home") {
      e.preventDefault();
      setActive(enabledFrom(0, 1));
    } else if (k === "End") {
      e.preventDefault();
      setActive(enabledFrom(options.length - 1, -1));
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      choose(active);
    } else if (k === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (k === "Tab") {
      close(false);
    } else if (k.length === 1 && /\S/.test(k)) {
      const now = e.timeStamp;
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + k.toLocaleLowerCase("pt-BR"), at: now };
      const q = typed.current.text;
      const order = [...options.keys()].slice(active + 1).concat([...options.keys()].slice(0, active + 1));
      const hit = order.find((i) => !options[i]!.disabled && options[i]!.label.toLocaleLowerCase("pt-BR").startsWith(q));
      if (hit !== undefined) setActive(hit);
    }
  };

  const listbox = (
    <ul
      ref={list}
      id={listId}
      role="listbox"
      aria-labelledby={labelId}
      tabIndex={sheet ? 0 : -1}
      aria-activedescendant={active >= 0 ? optId(active) : undefined}
      onKeyDown={onListKey}
      className={cn("flex flex-col overflow-y-auto outline-none", sheet ? "gap-1" : "py-1")}
      style={!sheet && pos ? { maxHeight: pos.maxH } : undefined}
    >
      {options.map((o, i) => {
        const isSel = o.value === value;
        return (
          <li
            key={o.value}
            id={optId(i)}
            role="option"
            data-value={o.value}
            aria-selected={isSel}
            aria-disabled={o.disabled || undefined}
            onPointerMove={() => !o.disabled && setActive(i)}
            onClick={() => choose(i)}
            className={cn(
              "flex cursor-pointer items-start gap-2 px-3 text-left text-ink",
              sheet ? "min-h-12 rounded-md py-3 text-base" : "min-h-10 py-2 text-sm",
              i === active && "bg-surface-muted",
              o.disabled && "cursor-not-allowed text-ink-muted",
            )}
          >
            <span aria-hidden="true" className={cn("w-4 shrink-0 font-bold text-red-text", !isSel && "invisible")}>
              ✓
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={cn(isSel && "font-semibold")}>{o.label}</span>
              {o.hint && <span className="text-xs leading-4 text-ink-muted">{o.hint}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span id={labelId} className={hideLabel ? "sr-only" : (labelClassName ?? "text-sm font-medium text-ink")}>
        {label}
      </span>
      <button
        ref={trigger}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${buttonId}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-sm border border-border bg-white px-3 text-left text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted",
          SIZE[size],
          open && "border-ink",
          triggerClassName,
        )}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-ink-muted")}>{selected?.label ?? placeholder}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && !sheet && pos && (
        <div
          className="fixed z-[70] overflow-hidden rounded-sm border border-border bg-white shadow-high"
          style={{ left: pos.left, minWidth: pos.width, maxWidth: `min(28rem, calc(100vw - ${pos.left}px - 8px))`, top: pos.top, bottom: pos.bottom }}
        >
          {listbox}
        </div>
      )}
      {sheet && (
        <BottomSheet open={open} onClose={() => close()} title={label}>
          {listbox}
        </BottomSheet>
      )}
    </div>
  );
}
