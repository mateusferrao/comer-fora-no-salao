"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "../components/Badge";

/**
 * Roteiro do restaurante de teste (planejamento S3 §4.2, revisão P-B1) + "Simular 30 dias" / "Limpar".
 * A simulação é declarada ("simulado") e mede o que foi programado (espec. 3.8).
 */
export function TestGuide({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "simular" | "limpar">("");
  const [msg, setMsg] = useState("");
  const act = async (acao: "simular" | "limpar") => {
    if (busy) return;
    if (acao === "limpar" && !window.confirm("Apagar os dados simulados deste restaurante? Os check-ins reais continuam.")) return;
    setBusy(acao);
    setMsg("");
    try {
      const r = await fetch(`/api/parceiro/simular/${acao}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg(acao === "simular" ? "Pronto: 30 dias simulados. O painel já mostra os números." : "Simulação apagada.");
        router.refresh();
      } else setMsg(j.erro === "ja_simulado" ? "Este restaurante já tem uma simulação. Limpe antes de simular de novo." : j.erro === "limite" ? "Muitas simulações hoje. Tente mais tarde." : "Não deu certo agora. Tente de novo.");
    } finally {
      setBusy("");
    }
  };
  return (
    <section aria-labelledby="roteiro" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-5">
      <h2 id="roteiro" className="text-lg font-bold text-ink">
        Teste o ciclo completo
      </h2>
      <ol className="list-decimal pl-5 text-sm text-ink">
        <li>
          Abra o QR do kit ou{" "}
          <a className="text-red-text underline" href={`/r/${slug}`} target="_blank" rel="noreferrer">
            a página do restaurante como cliente
          </a>
          .
        </li>
        <li>Faça check-in. Se o convite não aparecer, a tela diz por quê (grupo de controle ou teto).</li>
        <li>Valide o código em &quot;Validar código&quot;.</li>
        <li>No convite, toque em &quot;Para testar: antecipar 1 dia&quot; e faça check-in de novo: aparece o código do convite.</li>
        <li>Simule 30 dias para ver o painel e o plano da semana com dados.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => act("simular")} aria-busy={busy === "simular" || undefined} className="min-h-11 rounded-xs bg-red-button px-5 text-sm font-semibold text-white hover:brightness-95">
          {busy === "simular" ? "Simulando…" : "Simular 30 dias"}
        </button>
        <button type="button" onClick={() => act("limpar")} aria-busy={busy === "limpar" || undefined} className="min-h-11 rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text">
          Limpar simulação
        </button>
        <Badge tone="neutral">simulado</Badge>
      </div>
      {msg && (
        <p role="status" className="text-sm text-ink">
          {msg}
        </p>
      )}
    </section>
  );
}
