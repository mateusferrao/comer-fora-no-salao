import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { digestPage, type DigestPageState } from "@/src/modules/planos/application/digest";
import { Logo } from "@/src/ui/components/Logo";
import { brl, int } from "@/src/ui/painel/format";
import { ApproveDigest } from "./ApproveDigest";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Revisar e aprovar o plano · Comer Fora", robots: { index: false, follow: false }, referrer: "no-referrer" };

const STATE_TEXT: Record<Exclude<DigestPageState, "ok">, string> = {
  usado: "Este link já foi usado. Veja o plano no Portal.",
  substituido: "Este plano foi substituído por um mais novo. Abra no Portal.",
  nao_proposto: "Este plano não está mais esperando aprovação. Veja o estado atual no Portal.",
  revisor: "O revisor automático pediu ajustes nos textos. Ajuste no Portal antes de aprovar.",
  desligado: "Aprovação por e-mail desligada nas suas configurações. Aprove no Portal.",
};
const PLAN_STATUS: Record<string, string> = { aprovado: "Aprovado", descartado: "Descartado", vencido: "Substituído", proposto: "Esperando aprovação", gerando: "Sendo gerado" };

/**
 * "Revisar e aprovar" do resumo semanal (S6.1 — D187, D195): o GET só mostra (robôs de e-mail não aprovam nada);
 * "Aprovar plano" é um POST com o token. Token inválido ou vencido → 404 único.
 */
export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await getFlags(getDb())).resumo_email) notFound();
  const v = await digestPage(getDb(), token.slice(0, 120), new Date());
  if (!v) notFound();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-3">
        <Logo height={28} />
        <span className="text-sm text-ink-muted">Comer Fora no Salão</span>
      </div>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Plano da semana · {v.restaurant}</h1>
        <p className="text-sm text-ink-muted">Estado: {PLAN_STATUS[v.planStatus] ?? v.planStatus}</p>
      </header>
      <section aria-label="Plano proposto" className="flex flex-col gap-3">
        {v.slots.map((s) => (
          <article key={s.phrase} className="flex flex-col gap-1 rounded-sm border border-border bg-white p-4">
            <h2 className="text-base font-semibold text-ink">{s.phrase}</h2>
            <p className="text-base text-ink">
              {s.gain} · teto {int(s.cap)} convites · custo máximo {brl(s.maxCostCents)}
            </p>
            {s.invite && <p className="text-sm text-ink">Convite: “{s.invite}”</p>}
            {s.justificativa && <p className="text-sm text-ink-muted">{s.justificativa}</p>}
          </article>
        ))}
        {v.reactivation.real > 0 && <p className="text-sm text-ink">Ao aprovar, {int(v.reactivation.real)} clientes que sumiram recebem um convite para voltar.</p>}
      </section>
      {v.state === "ok" ? (
        <ApproveDigest token={token} />
      ) : (
        <p role="status" className="rounded-sm border border-border bg-surface-muted p-4 text-base text-ink">
          {STATE_TEXT[v.state]}
          {v.state === "revisor" && v.reviewReasons.length > 0 && <span className="mt-1 block text-sm text-ink-muted">Motivo: {v.reviewReasons.join("; ")}</span>}
        </p>
      )}
      <Link href="/parceiro/salao/plano" className="min-h-11 self-start py-2 text-base font-semibold text-red-text underline">
        Ajustar no Portal
      </Link>
    </main>
  );
}
