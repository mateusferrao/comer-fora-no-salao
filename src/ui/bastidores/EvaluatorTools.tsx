"use client";

import { Select } from "../components/Select";
import { useState } from "react";
import { Button } from "../components/Button";

type R = { id: string; name: string; copy: boolean };

/** "Avançar 1 dia" e "Ver como cliente reativado" (D153; revisão de produto I8: avisa antes de trocar o cliente). */
export function EvaluatorTools({ restaurants, currentId }: { restaurants: R[]; currentId: string | null }) {
  const [rid, setRid] = useState(currentId ?? restaurants[0]?.id ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<"" | "avancar" | "reativado" | "ciclo">("");
  const post = (acao: string, body: unknown) => fetch(`/api/avaliador/${acao}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  const advance = async () => {
    setBusy("avancar");
    setMsg("");
    try {
      const r = await post("avancar", { restaurantId: rid });
      const j = (await r.json().catch(() => ({}))) as { advanced?: number; liberatedToday?: number; erro?: string };
      if (r.ok) setMsg(`Pronto: ${j.advanced} ${j.advanced === 1 ? "convite avançado" : "convites avançados"}${j.liberatedToday ? " (liberado hoje fora do horário)" : ""}. Faça check-in de novo na página do restaurante para receber o código do convite.`);
      else setMsg(j.erro === "nada_para_avancar" ? "Nenhum convite emitido hoje neste restaurante. Faça um check-in como cliente primeiro (1 em 10 cai no grupo de controle e não recebe convite)." : "Não deu certo agora.");
    } finally {
      setBusy("");
    }
  };

  const cycle = async () => {
    setBusy("ciclo");
    setMsg("");
    try {
      const r = await post("ciclo", { restaurantId: rid });
      const j = (await r.json().catch(() => ({}))) as { planos?: number; resumos?: { enviados: number }; lembretes?: number };
      if (r.ok)
        setMsg(
          `Ciclo rodado: ${j.planos ? "plano da semana gerado" : "plano já existia (proposto ou aprovado nos últimos dias)"} · ${j.resumos?.enviados ? "resumo enviado ao seu e-mail" : "sem resumo por e-mail (veja a prévia em Plano da semana)"} · ${j.lembretes ?? 0} ${j.lembretes === 1 ? "lembrete" : "lembretes"}.`,
        );
      else setMsg("Não deu certo agora.");
    } finally {
      setBusy("");
    }
  };

  const reactivated = async () => {
    if (!window.confirm("Você vai sair do seu login de cliente neste aparelho e entrar como um cliente do histórico gerado. Continuar?")) return;
    setBusy("reativado");
    setMsg("");
    try {
      const r = await post("reativado", {});
      // Recarga completa de propósito: o cookie do cliente trocou no servidor.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (r.ok) window.location.assign("/app/jornada");
      else setMsg("Nenhum cliente reativado ainda. Aprove o plano da semana do restaurante de exemplo primeiro.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="avancar" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
        <h2 id="avancar" className="text-lg font-bold text-ink">
          Avançar 1 dia
        </h2>
        <p className="text-sm text-ink">
          O código do convite nasce quando o cliente volta em outro dia, dentro do horário vazio. Isto recua 1 dia os convites emitidos hoje e, se agora estiver fora do horário,
          libera o convite só hoje.
        </p>
        <Select label="Restaurante" size="lg" value={rid} options={restaurants.map((r) => ({ value: r.id, label: r.copy ? `${r.name} (exemplo)` : r.name }))} onChange={setRid} />
        <Button variant="primary-portal" className="self-start" loading={busy === "avancar"} disabled={!rid || !!busy} onClick={() => void advance()}>
          Avançar 1 dia
        </Button>
      </section>
      <section aria-labelledby="ciclo" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
        <h2 id="ciclo" className="text-lg font-bold text-ink">
          Rodar o ciclo agora neste restaurante
        </h2>
        <p className="text-sm text-ink">
          Faz agora o que o agendador faria no dia e na hora escolhidos em Avisos e automação: gera o plano da semana (se não houver proposta nem aprovação recente), manda o
          resumo ao seu e-mail (se a conta tiver um) e os lembretes devidos. Só no restaurante escolhido acima.
        </p>
        <Button variant="outline-portal" className="self-start" loading={busy === "ciclo"} disabled={!rid || !!busy} onClick={() => void cycle()}>
          Rodar o ciclo agora
        </Button>
      </section>
      <section aria-labelledby="reativado" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
        <h2 id="reativado" className="text-lg font-bold text-ink">
          Ver como cliente reativado
        </h2>
        <p className="text-sm text-ink">Abre a Jornada de um cliente do histórico que recebeu o convite de reativação do plano da semana.</p>
        <Button variant="outline-portal" className="self-start" loading={busy === "reativado"} disabled={!!busy} onClick={() => void reactivated()}>
          Ver como cliente reativado
        </Button>
      </section>
      {msg && (
        <p role="status" className="text-sm text-ink">
          {msg}
        </p>
      )}
    </div>
  );
}
