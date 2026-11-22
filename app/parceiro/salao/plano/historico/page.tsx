import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/src/db/client";
import { getPlanView } from "@/src/modules/planos/application/plan-view";
import { requireOwner } from "@/src/web/portal-context";
import { weekLabel } from "@/src/ui/painel/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Histórico de planos · Comer Fora no salão · Portal do Parceiro" };

const STATUS: Record<string, string> = { aprovado: "Aprovado", descartado: "Descartado" };

export default async function HistoricoPage() {
  const s = await requireOwner();
  const view = s.current ? await getPlanView(getDb(), s.current.id, new Date()) : null;
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Histórico de planos</h1>
        <Link className="text-sm text-red-text underline" href="/parceiro/salao/plano">
          ← Voltar para o plano da semana
        </Link>
      </header>
      {!view || view.history.length === 0 ? (
        <p className="text-sm text-ink">Nenhum plano aprovado ou descartado ainda.</p>
      ) : (
        <div
          className="overflow-x-auto no-scrollbar rounded-sm border border-border bg-white p-4"
          tabIndex={0}
          role="region"
          aria-label="Histórico de planos (rolável)"
        >
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th scope="col" className="py-2 font-normal">Semana</th>
                <th scope="col" className="font-normal">Situação</th>
                <th scope="col" className="font-normal">Aprovado via</th>
                <th scope="col" className="font-normal">Reativação</th>
              </tr>
            </thead>
            <tbody>
              {view.history.map((h) => (
                <tr key={h.id} className="border-t border-divider">
                  <td className="py-2">{weekLabel(h.weekKey)}</td>
                  <td>{STATUS[h.status] ?? h.status}</td>
                  <td>{h.status === "aprovado" ? (h.via === "agente" ? "agente (MCP)" : h.via === "email" ? "e-mail" : h.via === "copiloto" ? "assistente" : "Portal") : "—"}</td>
                  <td>{h.status === "aprovado" ? `${h.sent} clientes` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
