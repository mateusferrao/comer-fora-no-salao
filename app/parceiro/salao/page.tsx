import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/src/db/client";
import { getDashboard } from "@/src/modules/analytics/application/dashboard";
import { getOperations } from "@/src/modules/analytics/application/operations";
import { getFlags } from "@/src/modules/config/application/app-config";
import { Operations } from "@/src/ui/painel/Operations";
import { copyState } from "@/src/modules/contas/application/copy-vitrine";
import { CreateRestaurantButton } from "@/src/ui/portal/CreateRestaurantButton";
import { DemoStatus } from "@/src/ui/portal/DemoStatus";
import { Dashboard } from "@/src/ui/painel/Dashboard";
import { firstSteps } from "@/src/modules/onboarding/application/first-steps";
import { FirstSteps } from "@/src/ui/portal/FirstSteps";
import { ensureVitrineCopy } from "@/src/web/account-bootstrap";
import { requireOwner } from "@/src/web/portal-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Visão geral · Comer Fora no salão · Portal do Parceiro" };

/** Visão geral (planejamento S3 §4.2): métrica contra o grupo de controle, plano, funil e indicadores. */
export default async function VisaoGeralPage() {
  const s = await requireOwner();
  const cur = s.current;
  const hasTest = s.restaurants.some((r) => r.kind === "teste");
  const copy = copyState(s.restaurants.find((r) => r.copiedFrom), new Date());
  // Conta sem a cópia do restaurante de exemplo (ex.: criada antes da S2 ou cópia apagada): prepara em segundo plano.
  if (copy === "nenhuma") ensureVitrineCopy(s.owner.id);
  const active = cur && (cur.status === "ativo" || cur.copiedFrom);
  const flags = active && cur ? await getFlags(getDb()) : null;
  const dash = active && cur ? await getDashboard(getDb(), cur.id, new Date(), { painelValor: !!flags?.painel_valor }) : null;
  const isTest = cur?.kind === "teste";
  const ops = dash && cur && (flags?.ab || flags?.insight_operacao) ? await getOperations(getDb(), cur.id, new Date()) : null;
  const steps = dash && cur && isTest ? await firstSteps(getDb(), cur.id) : null;
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Visão geral</h1>
        <p className="text-sm text-ink-muted">
          {cur ? `${cur.name} · ` : ""}Seu salão cheio divulga seu horário vazio.
        </p>
        {cur?.copiedFrom && (
          <p className="text-sm text-ink-muted">
            <span className="mr-2 inline-block rounded-xs bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink">Restaurante de exemplo · histórico gerado</span>
            Tudo aqui é editável e só você vê.{" "}
            <Link className="text-red-text underline" href="/bastidores/como-funciona">
              Como funciona
            </Link>
          </p>
        )}
        {cur && (cur.status === "ativo" || cur.copiedFrom) && (
          <p className="text-sm">
            <a className="text-red-text underline" href={`/r/${cur.slug}`} target="_blank" rel="noreferrer">
              Ver minha página
            </a>{" "}
            <span className="text-ink-muted">(como o cliente vê; abre em nova aba)</span>
          </p>
        )}
      </header>

      {copy !== "pronta" && <DemoStatus state={copy} />}

      {cur && isTest && cur.status !== "ativo" && (
        <section className="flex flex-col gap-3 rounded-sm border border-border bg-white p-5">
          <h2 className="text-lg font-bold text-ink">Continue a ativação</h2>
          <p className="text-sm text-ink-muted">Cardápio, horários vazios e pacote proposto: falta pouco para o painel aparecer.</p>
          <Link className="flex min-h-11 max-w-xs items-center justify-center rounded-xs bg-red-button px-5 text-sm font-semibold text-white" href="/parceiro/salao/ativar">
            Continuar ativação
          </Link>
        </section>
      )}

      {steps && cur && <FirstSteps steps={steps} slug={cur.slug} />}
      {dash && <Dashboard key={`${cur?.id}:${dash.restaurant.simulated}`} initial={dash} />}
      {ops && flags && <Operations view={ops} showAb={flags.ab} showAlerts={flags.insight_operacao} />}

      <section aria-labelledby="crie" className="flex flex-col gap-3 rounded-sm border border-red-text/40 bg-nav-active p-5">
        <h2 id="crie" className="text-lg font-bold text-ink">
          {hasTest ? "Cadastre outro restaurante" : "Cadastre o seu restaurante"}
        </h2>
        <p className="text-sm text-ink">
          Envie a foto do cardápio, diga quais horários ficam vazios e receba um pacote pronto: benefício na hora, convite de volta para o horário vazio e kit para imprimir.
        </p>
        <div className="max-w-xs">
          <CreateRestaurantButton label={hasTest ? "Cadastrar outro restaurante" : "Cadastrar meu restaurante"} />
        </div>
      </section>
    </main>
  );
}
