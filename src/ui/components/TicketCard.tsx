import type { ReactNode } from "react";
import { cn } from "../cn";

/**
 * Card "ticket" do Comer Fora (app/04, app/08): imagem à esquerda, recortes semicirculares na borda,
 * título, subtítulo e chips. Recortes desenhados com o fundo da área (surface-muted).
 */
export function TicketCard({ image, title, subtitle, chips, className, notchColor = "bg-surface-muted" }: {
  image: ReactNode;
  title: string;
  subtitle?: string;
  chips?: ReactNode;
  className?: string;
  notchColor?: string;
}) {
  return (
    <div className={cn("relative flex min-h-[104px] items-center gap-4 rounded-xl bg-white p-2.5 pr-4", className)}>
      <div className="relative size-[84px] shrink-0 overflow-hidden rounded-lg">{image}</div>
      <span aria-hidden="true" className={cn("absolute left-[102px] top-0 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full", notchColor)} />
      <span aria-hidden="true" className={cn("absolute bottom-0 left-[102px] size-4 -translate-x-1/2 translate-y-1/2 rounded-full", notchColor)} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-base font-semibold leading-5 text-ink">{title}</p>
        {subtitle && <p className="text-xs leading-4 text-ink-muted">{subtitle}</p>}
        {chips && <div className="flex flex-wrap gap-1.5">{chips}</div>}
      </div>
    </div>
  );
}
