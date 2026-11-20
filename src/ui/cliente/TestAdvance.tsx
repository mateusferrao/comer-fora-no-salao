"use client";

import { useState } from "react";

/**
 * Só em restaurante de teste (D140, D141): "Para testar: antecipar 1 dia". Recua a visita e o convite em 1 dia
 * (e, fora do horário, libera o convite só hoje) para o avaliador ver a volta com o código do convite.
 */
export function TestAdvance({ inviteId, canAdvance, liberatedToday }: { inviteId: string; canAdvance: boolean; liberatedToday: boolean }) {
  const [state, setState] = useState<"" | "busy" | "ok" | "erro">("");
  const [liberated, setLiberated] = useState(liberatedToday);
  const go = async () => {
    if (state === "busy") return;
    setState("busy");
    const r = await fetch("/api/cliente/convite/antecipar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inviteId }) }).catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as { testValidToday: boolean };
      setLiberated(j.testValidToday);
      setState("ok");
    } else setState("erro");
  };
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-dashed border-ink-muted p-3" data-testid="teste-antecipar">
      <p className="text-xs font-semibold text-ink-muted">
        <span className="mr-1 rounded-xs bg-surface-muted px-1.5 py-0.5 text-ink">teste</span>
        Só no restaurante de teste
      </p>
      {liberated && <p className="text-sm text-ink">Só no teste: liberado hoje, fora do horário.</p>}
      {state === "ok" ? (
        <p role="status" className="text-sm text-ink">
          Pronto (só no teste): o convite agora conta como de ontem. Faça check-in de novo para receber o código.
        </p>
      ) : null}
      {state === "ok" && typeof window !== "undefined" && /\/r\/[^/]+/.test(window.location.pathname) ? (
        <a href={window.location.pathname.replace(/^(\/r\/[^/]+).*$/, "$1/checkin")} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-red-text underline">
          Fazer check-in de novo
        </a>
      ) : state === "ok" ? null : state === "erro" ? (
        <p role="status" className="text-sm text-ink">
          Não se aplica a este convite.
        </p>
      ) : (
        canAdvance && (
          <button type="button" onClick={go} aria-busy={state === "busy" || undefined} className="min-h-11 self-start text-sm font-semibold text-red-text underline">
            Para testar: antecipar 1 dia
          </button>
        )
      )}
    </div>
  );
}
