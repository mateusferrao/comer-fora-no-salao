"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../cn";

export type TabItem = { id: string; label: string; content: ReactNode };

type Props = {
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  label: string;
};

/** Abas sublinhadas (app/04): ativa #151515 com traço de 2 px; inativa #666; divisor 1 px #E0E0E0. */
export function Tabs({ items, value, onValueChange, label }: Props) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    const next =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    const item = items[next];
    if (!item) return;
    onValueChange(item.id);
    refs.current[next]?.focus();
  };

  return (
    <div>
      {/* Degradê na borda direita quando há mais abas do que cabem (S6.3a; revisão de produto I6). */}
      <div className="relative">
        <div
          role="tablist"
          aria-label={label}
          className="flex gap-6 overflow-x-auto overflow-y-hidden border-b border-divider pr-8 no-scrollbar"
        >
          {items.map((item, i) => {
            const selected = item.id === value;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                role="tab"
                type="button"
                id={`${base}-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`${base}-panel-${item.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onValueChange(item.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "-mb-px min-h-11 min-w-11 shrink-0 whitespace-nowrap border-b-2 px-0 text-base font-medium",
                  selected
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent"
        />
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={item.id !== value}
          tabIndex={0}
          className="pt-4"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
