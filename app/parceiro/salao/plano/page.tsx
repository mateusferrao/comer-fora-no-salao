import type { Metadata } from "next";
import { getDb } from "@/src/db/client";
import { getPlanView } from "@/src/modules/planos/application/plan-view";
import { getOperations } from "@/src/modules/analytics/application/operations";
import { getFlags } from "@/src/modules/config/application/app-config";
import { Operations } from "@/src/ui/painel/Operations";
import { PlanManager } from "@/src/ui/painel/PlanManager";
import { requireOwner } from "@/src/web/portal-context";
import { getNotifyView } from "@/src/modules/config/application/update-settings";
import { DigestCard } from "@/src/ui/painel/DigestCard";

const DAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plano da semana · Comer Fora no salão · Portal do Parceiro" };

/** Plano da semana (espec. 3.7; planejamento S3 §4.3): o código decide números e veredito; a IA escolhe e explica. */
export default async function PlanoPage() {
  const s = await requireOwner();
  const cur = s.current;
  const view = cur && (cur.status === "ativo" || cur.copiedFrom) ? await getPlanView(getDb(), cur.id, new Date()) : null;
  // Insight 4 (flag): os alertas de operação entram no topo do plano (espec. 3.7.1.4).
  const flags = await getFlags(getDb());
  const ops = view && cur && flags.insight_operacao ? await getOperations(getDb(), cur.id, new Date()) : null;
  // S6.1 (D188): resumo por e-mail, com prévia e "Enviar agora" (flag resumo_email).
  const notify = view && cur && flags.resumo_email ? await getNotifyView(getDb(), cur.id) : null;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Plano da semana</h1>
        <p className="text-sm text-ink-muted">O sistema calcula custos e limites, a IA sugere a oferta de cada horário vazio e explica por quê. Nada vale sem a sua aprovação.</p>
      </header>
      {ops && <Operations view={ops} showAb={false} showAlerts />}
      {/* Revisão S4–S6 (produto 1): o cartão do resumo logo abaixo do cabeçalho, não depois do plano inteiro. */}
      {notify && <DigestCard to={notify.to} on={notify.settings.resumo.on} when={`${DAYS[notify.settings.resumo.weekday]} às ${hhmm(notify.settings.resumo.minute)}`} />}
      {view ? <PlanManager initial={view} explicaIa={flags.explica_ia} /> : <p className="text-sm text-ink">Ative o restaurante para receber o plano da semana.</p>}
    </main>
  );
}
