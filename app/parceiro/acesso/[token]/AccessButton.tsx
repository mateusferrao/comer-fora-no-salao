"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/ui/components/Button";

export function AccessButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function enter() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parceiro/acesso", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      if (res.ok) {
        router.replace("/parceiro/salao");
        router.refresh();
        return;
      }
      setError(res.status === 429 ? "O limite de acessos de hoje por este link foi atingido. Entre com seu e-mail." : "Este link de acesso não é válido. Entre com seu e-mail.");
    } catch {
      setError("Não conseguimos abrir sua conta agora. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mt-6 flex flex-col gap-3">
      <Button variant="primary-portal" loading={loading} onClick={enter} className="w-full">
        Entrar no Portal
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-text">
          {error}{" "}
          <a className="underline" href="/parceiro/entrar">
            Entrar com e-mail
          </a>
        </p>
      )}
    </div>
  );
}
