import type { ReactNode } from "react";
import { cn } from "../cn";

export type BadgeTone = "neutral" | "red" | "green" | "outline-red";

// Verde só com texto escuro (branco sobre #52AA6E dá 2,86:1).
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-ink",
  red: "bg-red-button text-white",
  green: "bg-green text-ink",
  // portal/05: selo "Novo" em pílula contornada (dívida 13 da revisão da S0)
  "outline-red": "rounded-full border border-red-text bg-white text-red-text",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-xs px-2 py-0.5 text-xs font-semibold leading-4", TONES[tone])}>
      {children}
    </span>
  );
}
