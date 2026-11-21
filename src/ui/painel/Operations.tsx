"use client";

import { confirmDialog } from "../components/ConfirmDialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OperationsView } from "@/src/modules/analytics/application/operations";
import type { AbRow } from "@/src/modules/analytics/domain/operations";

const PIECE = { display: "Display de mesa", cartaz: "Cartaz" } as const;
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");

function statusText(r: AbRow): string {
  if (!r.status) return "Falta uma das versões.";
  if (r.status.state === "faltam") return `Sem vencedora ainda · faltam ~${r.status.missing} leituras por versão`;
  if (r.status.state === "sem_diferenca") return "Sem diferença clara entre as versões";
  return `A versão ${r.status.winner} converte mais leituras em check-in`;
}

/** Alertas de operação (insight 4) e tabela do A/B — cada um só aparece com a flag ligada. */
export function Operations({ view, showAb, showAlerts }: { view: OperationsView; showAb: boolean; showAlerts: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      {showAlerts && view.alerts.length > 0 && (
        <section aria-labelledby="alertas" className="flex flex-col gap-2 rounded-sm border border-border bg-white p-5">
          <h2 id="alertas" className="text-lg font-bold text-ink">
            Alertas de operação
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
            {view.alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}
      {showAb && (
        <details className="rounded-sm border border-border bg-white p-5" data-testid="ab">
          <summary className="cursor-pointer text-lg font-bold text-ink">Versões das peças (A/B)</summary>
          <p className="mt-2 text-sm text-ink-muted">Decide só pela conversão leitura do QR → check-in entre as versões da mesma peça. Amostra mínima: ~356 leituras por versão.</p>
          {view.ab.map((r) => (
            <div key={r.kind} className="mt-4 flex flex-col gap-2">
              <table className="w-full text-left text-sm text-ink">
                <caption className="text-left font-semibold">{PIECE[r.kind]}</caption>
                <thead>
                  <tr className="text-ink-muted">
                    <th scope="col">Versão</th>
                    <th scope="col">Leituras</th>
                    <th scope="col">Check-ins</th>
                    <th scope="col">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {[r.a, r.b].map((v) =>
                    v ? (
                      <tr key={v.id}>
                        <th scope="row">{v.label}</th>
                        <td>{v.scans}</td>
                        <td>{v.checkins}</td>
                        <td>{pct(v.checkins, v.scans)}</td>
                      </tr>
                    ) : null,
                  )}
                </tbody>
              </table>
              <p className="text-sm text-ink">{statusText(r)}</p>
              {r.status?.state === "vencedora" && (
                <button
                  type="button"
                  disabled={!!busy}
                  className="min-h-11 self-start rounded-xs bg-red-button px-5 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={async () => {
                    if (
                      !(await confirmDialog({
                        title: `Promover a versão ${r.status?.state === "vencedora" ? r.status.winner : ""}?`,
                        body: "A outra versão ganha o texto da vencedora e um QR novo: reimprima o display e o cartaz. O QR atual continua funcionando.",
                        confirmLabel: "Promover",
                      }))
                    )
                      return;
                    setBusy(r.kind);
                    const res = await fetch("/api/parceiro/kit/campo", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ promover: r.kind }) });
                    setBusy(null);
                    setMsg(res.ok ? "Pronto: a versão vencedora foi promovida. Reimprima as peças no Kit." : "Não deu para promover agora.");
                    router.refresh();
                  }}
                >
                  Promover vencedora
                </button>
              )}
            </div>
          ))}
          {msg && (
            <p role="status" className="mt-3 text-sm text-ink">
              {msg}
            </p>
          )}
        </details>
      )}
    </>
  );
}
