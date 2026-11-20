import type { Metadata } from "next";
import { getDb } from "@/src/db/client";
import { getPlanView } from "@/src/modules/planos/application/plan-view";
import { getOperations } from "@/src/modules/analytics/application/operations";
import { getFlags } from "@/src/modules/config/application/app-config";
import { Operations } from "@/src/ui/painel/Operations";
import { PlanManager } from "@/src/ui/painel/PlanManager";
import { requireOwner } from "@/src/web/portal-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plano da semana · Comer Fora no salão · Portal do Parceiro" };

/** Plano da semana (espec. 3.7; planejamento S3 §4.3): o código decide números e veredito; a IA escolhe e explica. */
export default async function PlanoPage() {
  const s = await requireOwner();
  const cur = s.current;
  const view = cur && (cur.status === "ativo" || cur.copiedFrom) ? await getPlanView(getDb(), cur.id, new Date()) : null;
  // Insight 4 (flag): os alertas de operação entram no topo do plano (espec. 3.7.1.4).
  const ops = view && cur && (await getFlags(getDb())).insight_operacao ? await getOperations(getDb(), cur.id, new Date()) : null;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Plano da semana</h1>
        <p className="text-sm text-ink-muted">O código calcula os números e decide o que é válido; a IA escolhe a oferta de cada horário vazio e explica. Você aprova.</p>
      </header>
      {ops && <Operations view={ops} showAb={false} showAlerts />}
      {view ? <PlanManager initial={view} /> : <p className="text-sm text-ink">Ative o restaurante para receber o plano da semana.</p>}
    </main>
  );
}
