import Link from "next/link";
import { VITRINE_SLUG } from "@/src/db/seed/vitrine";
import { Logo } from "@/src/ui/components/Logo";
import { getOwnerSession } from "@/src/web/owner-session";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { OwnerLanding } from "@/src/ui/landing/OwnerLanding";

export const dynamic = "force-dynamic";

/**
 * Entrada (espec. 3.1; S4 — D156, D176): produto primeiro, sem roteiro de teste (ele fica no link de avaliação e
 * nos Bastidores). "Veja o que seu cliente vê": dono logado vai à página da própria cópia (onde o check-in aparece
 * no painel dele); visitante vai à Cantina pública. Com `copy_v2` (S5.2), a landing de venda para o dono.
 */
export default async function Home() {
  const s = await getOwnerSession();
  const own = s?.restaurants.find((r) => r.copiedFrom) ?? null;
  const customerHref = `/r/${own?.slug ?? VITRINE_SLUG}`;
  if ((await getFlags(getDb())).copy_v2) return <OwnerLanding ctaHref={s ? "/parceiro/salao" : "/parceiro/entrar"} customerHref={customerHref} />;
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-xl flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <Logo height={28} />
      <h1 className="text-2xl font-bold leading-8 text-ink">Seu salão cheio divulga seu horário vazio</h1>
      <p className="text-base leading-6 text-ink-muted">
        Comer Fora no Salão: o cliente que já está na mesa ganha algo agora e um convite para voltar no horário vazio. O dono vê o retorno medido contra um grupo de controle.
      </p>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link
          href={s ? "/parceiro/salao" : "/parceiro/entrar"}
          className="flex min-h-12 items-center justify-center rounded-md bg-red-button px-6 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {s ? "Abrir o Portal do Parceiro" : "Entrar no Portal do Parceiro"}
        </Link>
        <Link
          href={customerHref}
          className="flex min-h-12 items-center justify-center rounded-md border border-border bg-surface-muted px-6 text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Veja o que seu cliente vê
        </Link>
      </div>
    </main>
  );
}
