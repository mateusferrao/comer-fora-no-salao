"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/src/ui/components/Button";

export function Unsubscribe({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<"" | "busy" | "ok" | "erro" | "rede">("");
  const go = async () => {
    setState("busy");
    const r = await fetch("/api/cliente/descadastrar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: token }) }).catch(() => null);
    setState(!r ? "rede" : r.ok ? "ok" : "erro");
    // A lista acima volta do servidor com o "E-mail" desligado (revisão S4–S6, produto 2).
    if (r?.ok) router.refresh();
  };
  if (state === "ok")
    return (
      <p role="status" className="text-base text-ink">
        Pronto. Este restaurante não vai mais te mandar e-mails.{" "}
        <Link className="text-red-text underline" href="/app/jornada">
          Ver sua jornada
        </Link>
      </p>
    );
  return (
    <div className="flex w-full flex-col gap-3">
      <Button variant="outline-app" loading={state === "busy"} disabled={!token} onClick={() => void go()}>
        Parar todos os e-mails deste restaurante
      </Button>
      {(state === "erro" || state === "rede") && (
        <p role="alert" className="text-sm text-red-text">
          {state === "rede" ? "Não conseguimos salvar agora. Confira a internet e tente de novo." : "Este link não vale mais. Use a engrenagem em Sua jornada."}
        </p>
      )}
    </div>
  );
}
