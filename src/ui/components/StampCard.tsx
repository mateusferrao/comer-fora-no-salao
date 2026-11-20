import { cn } from "../cn";

/** Cartela de selos (app/09): 5 círculos numerados + presente; selos ganhos preenchidos em vermelho. */
export function StampCard({ stamps, required = 6, className }: { stamps: number; required?: number; className?: string }) {
  return (
    <ol aria-label={`Cartela: ${stamps} de ${required} selos`} className={cn("flex justify-between gap-2", className)}>
      {Array.from({ length: required }, (_, i) => {
        const filled = i < stamps;
        const isGift = i === required - 1;
        return (
          <li
            key={i}
            aria-label={isGift ? `Selo ${i + 1}: recompensa${filled ? ", ganho" : ""}` : `Selo ${i + 1}${filled ? ", ganho" : ""}`}
            className={cn(
              "flex aspect-square w-full max-w-12 items-center justify-center rounded-full border-2 text-sm font-medium",
              filled ? "border-red-brand bg-red-brand text-white" : "border-border text-ink",
            )}
          >
            {isGift ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor" opacity={filled ? 1 : 0.35}>
                <path d="M20 7h-2.18A3 3 0 0 0 12 4.76 3 3 0 0 0 6.18 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Zm-7-1a1 1 0 1 1 1 1h-1Zm-3 0a1 1 0 0 1 1 1h-1a1 1 0 0 1 0-2ZM11 19H7v-7h4Zm0-9H5V9h6Zm6 9h-4v-7h4Zm2-9h-6V9h6Z" />
              </svg>
            ) : (
              i + 1
            )}
          </li>
        );
      })}
    </ol>
  );
}
