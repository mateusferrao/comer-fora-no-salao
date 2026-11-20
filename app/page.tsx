import Link from "next/link";
import { VITRINE_SLUG } from "@/src/db/seed/vitrine";
import { Logo } from "@/src/ui/components/Logo";
import { Roteiro } from "@/src/ui/Roteiro";

/** Entrada (espec. 3.1, D38): produto primeiro, 1 botão principal + 1 secundário e o roteiro curto (S3). */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-xl flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <Logo height={28} />
      <h1 className="text-2xl font-bold leading-8 text-ink">Seu salão cheio divulga seu horário vazio</h1>
      <p className="text-base leading-6 text-ink-muted">
        Comer Fora no Salão: o cliente que já está na mesa ganha algo agora e um convite para voltar no horário vazio. O dono vê o retorno medido contra um grupo de controle.
      </p>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link
          href="/parceiro/entrar"
          className="flex min-h-12 items-center justify-center rounded-md bg-red-button px-6 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Sou dono: abrir Portal (demo)
        </Link>
        <Link
          href={`/r/${VITRINE_SLUG}`}
          className="flex min-h-12 items-center justify-center rounded-md border border-border bg-surface-muted px-6 text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Sou cliente: ver restaurante
        </Link>
      </div>
      <Roteiro className="w-full" />
    </main>
  );
}
