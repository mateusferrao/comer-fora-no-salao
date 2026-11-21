"use client";

import { useState } from "react";
import { Button } from "@/src/ui/components/Button";

type Ok = { ok: true; already: boolean; sent: { real: number; emails?: number }; semEmail?: boolean };
const ERRORS: Record<string, string> = {
  usado: "Este link já foi usado. Veja o plano no Portal.",
  substituido: "Este plano foi substituído por um mais novo. Abra no Portal.",
  nao_proposto: "Este plano não está mais esperando aprovação.",
  revisor: "O revisor automático pediu ajustes nos textos. Ajuste no Portal antes de aprovar.",
  desligado: "Aprovação por e-mail desligada nas suas configurações. Aprove no Portal.",
  oferta: "Uma das ofertas não vale mais (o cardápio mudou). Ajuste no Portal.",
  texto: "Um dos textos não passou nas regras. Ajuste no Portal.",
};

/** POST com o token: aprova o plano como está (`via: email`). */
export function ApproveDigest({ token }: { token: string }) {
  const [state, setState] = useState<"" | "busy">("");
  const [done, setDone] = useState<Ok | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setState("busy");
    setErr(null);
    const r = await fetch("/api/resumo/aprovar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: token }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as (Ok & { erro?: string }) | null;
    setState("");
    if (r?.ok && j?.ok) setDone(j);
    else setErr(ERRORS[j?.erro ?? ""] ?? "Não foi possível aprovar agora. Tente de novo ou aprove no Portal.");
  };
  if (done)
    return (
      <p role="status" data-testid="aprovado-email" className="rounded-sm border border-border bg-white p-4 text-base text-ink">
        Plano aprovado.{" "}
        {done.sent.real > 0 ? `Convite entregue a ${done.sent.real} clientes em Sua jornada${done.sent.emails ? ` · ${done.sent.emails} também por e-mail` : ""}.` : "A regra do convite na mesa já vale."}
        {done.semEmail && <span className="block text-sm text-ink-muted">Textos com link ou contato não vão por e-mail.</span>}
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary-portal" loading={state === "busy"} onClick={() => void go()}>
        Aprovar plano
      </Button>
      {err && (
        <p role="alert" className="text-sm text-red-text">
          {err}
        </p>
      )}
    </div>
  );
}
