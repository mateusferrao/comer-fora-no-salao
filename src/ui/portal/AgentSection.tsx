"use client";

import { confirmDialog } from "../components/ConfirmDialog";
import { useState } from "react";
import { Button } from "../components/Button";

type Tok = { id: string; hint: string; createdAt: string; active: boolean };

/** Configurações › Agente (MCP; flag): token do dono para um agente ler e aprovar o plano (D219). */
export function AgentSection({ initial, endpoint }: { initial: Tok[]; endpoint: string }) {
  const [tokens, setTokens] = useState(initial);
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const active = tokens.find((t) => t.active);
  const call = async (acao: string) => {
    setBusy(acao);
    setMsg("");
    const r = await fetch("/api/parceiro/configuracoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao }) });
    const j = (await r.json().catch(() => ({}))) as { token?: string; hint?: string };
    setBusy("");
    return { ok: r.ok, j };
  };
  return (
    <section aria-labelledby="agente" className="flex flex-col gap-3 rounded-sm border border-border p-4">
      <h2 id="agente" className="font-semibold text-ink">
        Agente (MCP)
      </h2>
      <p className="text-sm text-ink-muted">
        Um agente de IA (ex.: o seu assistente) pode ler os números, gerar e aprovar o plano da semana deste restaurante com este token. Tudo o que ele aprovar fica registrado como &quot;via agente&quot;. Guarde o token como uma senha.
      </p>
      <p className="text-sm text-ink">
        Endereço do servidor: <code className="break-all rounded-xs bg-surface-muted px-1">{endpoint}</code>
      </p>
      {shown && (
        <div role="status" className="flex flex-col gap-1 rounded-sm border border-red-text/40 bg-nav-active p-3 text-sm text-ink" data-testid="token-agente">
          <p className="font-semibold">Copie agora: este token não aparece de novo.</p>
          <code className="break-all">{shown}</code>
        </div>
      )}
      <p className="text-sm text-ink">{active ? `Token ativo terminado em ${active.hint}.` : "Nenhum token ativo."}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary-portal"
          loading={busy === "agente_gerar"}
          onClick={async () => {
            if (
              active &&
              !(await confirmDialog({
                title: "Gerar um novo token?",
                body: "O token atual para de funcionar na hora.",
                confirmLabel: "Gerar novo token",
              }))
            )
              return;
            const r = await call("agente_gerar");
            if (r.ok && r.j.token) {
              setShown(r.j.token);
              setTokens([{ id: "novo", hint: r.j.hint ?? "", createdAt: new Date().toISOString(), active: true }, ...tokens.map((t) => ({ ...t, active: false }))]);
            } else setMsg("Não deu para gerar o token.");
          }}
        >
          {active ? "Gerar novo token" : "Gerar token"}
        </Button>
        {active && (
          <Button
            variant="outline-portal"
            loading={busy === "agente_revogar"}
            onClick={async () => {
              const r = await call("agente_revogar");
              if (r.ok) {
                setShown(null);
                setTokens(tokens.map((t) => ({ ...t, active: false })));
                setMsg("Token revogado.");
              } else setMsg("Não deu para revogar.");
            }}
          >
            Revogar
          </Button>
        )}
      </div>
      {msg && (
        <p role="status" className="text-sm text-ink">
          {msg}
        </p>
      )}
    </section>
  );
}
