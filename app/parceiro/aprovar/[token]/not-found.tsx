import Link from "next/link";
import { Logo } from "@/src/ui/components/Logo";

/**
 * Link de "Revisar e aprovar" inválido ou vencido (S9, auditoria do Portal 1.7): continua 404 único (D195, sem dizer
 * qual dos dois), mas aponta o caminho que resolve: o plano da semana no Portal.
 */
export default function ApproveLinkNotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo height={40} />
      <h1 className="text-xl font-semibold leading-7 text-ink">Este link de aprovação não vale mais</h1>
      <p className="text-sm leading-5 text-ink-muted">O link do resumo semanal vale por 7 dias. Você pode revisar e aprovar o plano da semana no Portal.</p>
      <Link href="/parceiro/salao/plano" className="mt-2 inline-flex min-h-12 items-center justify-center rounded-md bg-ink px-6 text-base font-medium text-white hover:bg-black">
        Abrir o plano no Portal
      </Link>
    </main>
  );
}
