"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/src/ui/components/Logo";
import { isCustomerPath, notFoundTarget } from "@/src/ui/cliente/not-found-target";

/** 404 (S9): nas telas do cliente, a saída é Sua jornada; a página inicial é a do dono e explica o grupo de controle. */
export default function NotFound() {
  const path = usePathname() ?? "/";
  const target = notFoundTarget(path);
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo height={40} />
      <h1 className="text-xl font-semibold leading-7">Página não encontrada</h1>
      <p className="text-sm leading-5 text-ink-muted">
        {isCustomerPath(path) ? "O endereço pode estar errado, ou o restaurante saiu do Comer Fora." : "O endereço pode estar errado ou a página ainda não existe neste protótipo."}
      </p>
      <Link
        href={target.href}
        className="mt-2 inline-flex min-h-12 items-center justify-center rounded-md bg-ink px-6 text-base font-medium text-white hover:bg-black"
      >
        {target.label}
      </Link>
    </main>
  );
}
