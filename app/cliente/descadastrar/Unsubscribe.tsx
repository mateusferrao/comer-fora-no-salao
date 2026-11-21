"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/src/ui/components/Button";

export function Unsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<"" | "busy" | "ok" | "erro">("");
  const go = async () => {
    setState("busy");
    const r = await fetch("/api/cliente/descadastrar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: token }) }).catch(() => null);
    setState(r?.ok ? "ok" : "erro");
  };
  if (state === "ok")
    return (
      <p role="status" className="text-base text-ink">
        Pronto: você não recebe mais e-mails deste restaurante.{" "}
        <Link className="text-red-text underline" href="/app/jornada">
          Ver sua jornada
        </Link>
      </p>
    );
  return (
    <div className="flex w-full flex-col gap-3">
      <Button variant="primary-app" loading={state === "busy"} disabled={!token} onClick={() => void go()}>
        Parar todos os e-mails deste restaurante
      </Button>
      {state === "erro" && (
        <p role="alert" className="text-sm text-red-text">
          Este link não vale mais. Use a engrenagem em Sua jornada.
        </p>
      )}
    </div>
  );
}
