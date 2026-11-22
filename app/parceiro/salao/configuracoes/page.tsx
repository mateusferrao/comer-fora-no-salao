import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/src/db/client";
import { getNotifyView, getSettingsView } from "@/src/modules/config/application/update-settings";
import { ConfigManager } from "@/src/ui/portal/ConfigManager";
import { AgentSection } from "@/src/ui/portal/AgentSection";
import { getFlags } from "@/src/modules/config/application/app-config";
import { listTokens } from "@/src/modules/mcp/tokens";
import { publicBaseUrl } from "@/src/web/qr";
import { requireOwner } from "@/src/web/portal-context";
import { appliedProposalTitle } from "@/src/modules/agente/application/metrics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações · Portal do Parceiro" };

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ aba?: string; v?: string }> }) {
  const { aba, v: applied0 } = await searchParams;
  const s = await requireOwner();
  const cur = s.current;
  if (!cur || cur.status !== "ativo") {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-bold text-ink">Configurações</h1>
        <p className="text-sm text-ink">As configurações ficam disponíveis depois de ativar o Comer Fora no salão.</p>
        <Link href="/parceiro/salao/ativar" className="self-start text-sm font-semibold text-red-text underline">
          Continuar a ativação
        </Link>
      </main>
    );
  }
  const v = (await getSettingsView(getDb(), cur.id))!;
  const flags = await getFlags(getDb());
  const mcp = flags.mcp;
  const notify = (await getNotifyView(getDb(), cur.id))!;
  const tokens = mcp ? await listTokens(getDb(), cur.id) : [];
  // S8 (revisão de produto 2): depois de "Aplicar" no assistente, a tela diz o que mudou.
  const applied = typeof applied0 === "string" ? await appliedProposalTitle(getDb(), cur.id, applied0) : null;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold text-ink">Configurações</h1>
        <p className="mt-1 text-sm text-ink-muted">Tudo o que a IA propôs é editável. Cada mudança vira uma nova versão; convites já entregues continuam com a oferta e o horário de quando foram entregues.</p>
      </header>
      {applied && (
        <p role="status" className="rounded-sm border border-red-text bg-nav-active px-4 py-3 text-sm font-semibold text-ink">
          ✓ Mudança aplicada pelo Assistente do salão: {applied}
        </p>
      )}
      <ConfigManager
        // S8: depois de "Aplicar" no assistente, a URL ganha `v` e o formulário remonta com os dados novos.
        key={typeof applied0 === "string" && /^[a-f0-9-]{1,40}$/.test(applied0) ? applied0 : "base"}
        v={v}
        isTest={cur.kind === "teste" && !cur.copiedFrom}
        restaurantId={cur.id}
        notify={notify}
        flags={{ agendador: flags.agendador, resumo_email: flags.resumo_email, plano_agente: flags.plano_agente, aprende: flags.aprende }}
        initialTab={typeof aba === "string" && /^[a-z]{2,20}$/.test(aba) ? aba : "agora"}
        integrations={mcp ? <AgentSection initial={tokens} endpoint={`${publicBaseUrl()}/api/mcp`} can={{ clientes: flags.mcp_clientes, edicao: flags.mcp_edicao }} /> : undefined}
      />
    </main>
  );
}
