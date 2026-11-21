"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../components/Button";

/** Ação principal do Início: "Cadastrar meu restaurante" (S4: sem "teste"). */
export function CreateRestaurantButton({ label = "Cadastrar meu restaurante" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parceiro/restaurantes", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { erro?: string };
      if (res.ok) {
        router.push("/parceiro/salao/ativar");
        router.refresh();
        return;
      }
      setError(
        j.erro === "limite_conta"
          ? "Sua conta já tem 3 restaurantes cadastrados. Exclua um em Configurações para cadastrar outro."
          : res.status === 429
            ? "Muitos restaurantes criados hoje a partir desta rede. Tente amanhã."
            : "Não conseguimos criar agora. Tente de novo.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary-portal" loading={loading} onClick={create}>
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-text">
          {error}
        </p>
      )}
    </div>
  );
}
