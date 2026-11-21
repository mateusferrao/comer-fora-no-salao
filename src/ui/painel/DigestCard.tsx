"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "../components/Button";
import { SidePanel } from "../components/SidePanel";

type Preview = { subject: string; text: string; approveUrl: string | null; hasPlan: boolean; aprovarEmail: boolean; to: string | null; ownerVia: string | null };

/**
 * Cartão "Resumo por e-mail" no Plano da semana (S6.1 — D188): a prévia mostra o texto exato que o dono recebe, com
 * o link "Revisar e aprovar" funcionando (o avaliador sem e-mail exercita o fluxo inteiro). "Enviar agora": 3/dia.
 */
export function DigestCard({ to, when, on }: { to: string | null; when: string; on: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"" | "previa" | "enviar">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const call = async (acao: "previa" | "enviar") => {
    setBusy(acao);
    setMsg(null);
    const r = await fetch(`/api/parceiro/resumo/${acao}`, { method: "POST" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as (Preview & { erro?: string; to?: string }) | null;
    setBusy("");
    if (acao === "previa") {
      if (r?.ok && j) setPreview(j);
      else setMsg({ ok: false, text: r?.status === 429 ? "Muitas prévias seguidas. Tente em alguns minutos." : "Não conseguimos montar a prévia." });
      return;
    }
    setMsg(r?.ok ? { ok: true, text: `Enviado para ${j?.to ?? to}.` } : { ok: false, text: r?.status === 429 ? "Você já enviou 3 vezes hoje." : "Não conseguimos enviar agora." });
  };
  return (
    <section id="resumo" aria-labelledby="resumo-titulo" data-testid="resumo-email" className="flex flex-col gap-2 rounded-sm border border-border bg-white p-4">
      <h2 id="resumo-titulo" className="text-base font-semibold text-ink">
        Resumo por e-mail
      </h2>
      <p className="text-sm text-ink">
        {!on ? "Resumo semanal desligado. " : to ? `Toda ${when} para ${to}. ` : "Esta conta não tem e-mail guardado: veja abaixo o e-mail que o dono recebe. "}
        <Link href="/parceiro/salao/configuracoes?aba=avisos" className="font-semibold text-red-text underline">
          Avisos e automação
        </Link>
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline-portal" loading={busy === "previa"} onClick={() => void call("previa")}>
          Ver o e-mail desta semana
        </Button>
        {to && (
          <Button variant="outline-portal" loading={busy === "enviar"} onClick={() => void call("enviar")}>
            Enviar agora
          </Button>
        )}
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-ink" : "font-medium text-red-text"}`}>
          {msg.text}
        </p>
      )}
      <SidePanel open={!!preview} onClose={() => setPreview(null)} title="O e-mail desta semana">
        {preview && (
          <div className="flex flex-col gap-3" data-testid="resumo-previa">
            <p className="text-sm text-ink-muted">Assunto</p>
            <p className="font-semibold text-ink">{preview.subject}</p>
            <pre className="whitespace-pre-wrap break-words rounded-sm border border-border bg-surface-muted p-3 font-sans text-sm text-ink">{preview.text}</pre>
            {preview.approveUrl ? (
              <a href={preview.approveUrl} target="_blank" rel="noopener" className="min-h-11 self-start py-2 font-semibold text-red-text underline">
                Abrir “Revisar e aprovar” (o mesmo link do e-mail)
              </a>
            ) : (
              <p className="text-sm text-ink-muted">
                {!preview.hasPlan ? "Gere o plano da semana para ver o e-mail com “Revisar e aprovar”." : "A aprovação pelo e-mail está desligada em Avisos e automação."}
              </p>
            )}
          </div>
        )}
      </SidePanel>
    </section>
  );
}
