import { cn } from "../cn";

import { CATEGORY_PHOTOS } from "../photos";

const TINT: Record<string, string> = {
  sobremesa: "bg-[#F6E7DA]",
  entrada: "bg-[#EEF3E2]",
  porcao: "bg-[#F7EBD3]",
  prato: "bg-[#F7E1DC]",
  bebida: "bg-[#E3EEF3]",
};


/** Foto da categoria do item (D107) ou, sem foto, um bloco ilustrado neutro. Decorativa. */
export function CategoryImage({ category, className, photos = CATEGORY_PHOTOS }: { category: string | null; className?: string; photos?: Record<string, string | undefined> }) {
  const src = category ? photos[category] : undefined;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" aria-hidden="true" className={cn("object-cover", className)} />;
  }
  return (
    <div aria-hidden="true" className={cn("flex items-center justify-center text-ink/40", TINT[category ?? ""] ?? "bg-surface-muted", className)}>
      {/* garfo e faca (traço simples, sem marca) */}
      <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M7 3v8m-2-8v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-1.7 1-3 3.2-3 6v4h3v8" />
      </svg>
    </div>
  );
}
