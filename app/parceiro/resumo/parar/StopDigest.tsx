"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/src/ui/components/Button";

export function StopDigest({ token }: { token: string }) {
  const [state, setState] = useState<"" | "busy" | "ok" | "erro" | "rede">("");
  const go = async () => {
    setState("busy");
    const r = await fetch("/api/resumo/parar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: token }) }).catch(() => null);
    setState(r?.ok ? "ok" : r ? "erro" : "rede");
  };
  if (state === "ok")
    return (
      <p role="status" className="text-base text-ink">
        Pronto: você não recebe mais o resumo semanal deste restaurante.{" "}
        <Link className="text-red-text underline" href="/parceiro/salao/configuracoes?aba=avisos">
          Religar no Portal
        </Link>
      </p>
    );
  return (
    <div className="flex w-full flex-col gap-3">
      <Button variant="primary-portal" loading={state === "busy"} disabled={!token} onClick={() => void go()}>
        Parar o resumo semanal
      </Button>
      {state === "rede" && (
        <p role="alert" className="text-sm text-red-text">
          Não deu para parar agora. Confira a conexão e tente de novo.
        </p>
      )}
      {state === "erro" && (
        <p role="alert" className="text-sm text-red-text">
          Este link não vale mais. Desligue o resumo no Portal, em{" "}
          <Link className="font-semibold underline" href="/parceiro/salao/configuracoes?aba=avisos">
            Configurações › Avisos e automação
          </Link>
          .
        </p>
      )}
    </div>
  );
}
