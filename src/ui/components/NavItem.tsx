import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "../cn";

type Props = { href: string; active?: boolean; children: ReactNode; badge?: ReactNode; icon?: ReactNode };

/** Item da barra lateral do Portal (portal/02 e 05): ativo com fundo rosado, barra vermelha e `aria-current`. */
export function NavItem({ href, active = false, children, badge, icon }: Props) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink",
        active ? "bg-nav-active font-semibold text-red-text before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-r-sm before:bg-red-brand" : "text-ink hover:bg-surface-muted",
      )}
    >
      {icon && (
        <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center">
          {icon}
        </span>
      )}
      <span className="flex-1">{children}</span>
      {badge}
    </Link>
  );
}
