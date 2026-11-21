"use client";

import { useState } from "react";
import { Button } from "../components/Button";

const when = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * "Link do garçom" (S6.2 — D190): link + QR mostrados UMA vez (o banco guarda só o hash); criar de novo revoga o
 * anterior; "Revogar" corta na hora. Sem PIN.
 */
export function WaiterLinkCard({ activeSince }: { activeSince: string | null }) {
  const [since, setSince] = useState(activeSince);
  const [shown, setShown] = useState<{ url: string; qr: string } | null>(null);
  const [busy, setBusy] = useState<"" | "criar" | "revogar">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const act = async (acao: "criar" | "revogar") => {
    if (acao === "criar" && since && !window.confirm("Criar um link novo desliga o link atual. Continuar?")) return;
    if (acao === "revogar" && !window.confirm("Revogar o link do garçom? Quem usa o link atual perde o acesso na hora.")) return;
    setBusy(acao);
    setMsg(null);
    const r = await fetch("/api/parceiro/garcom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { url?: string; qr?: string; createdAt?: string } | null;
    setBusy("");
    if (!r?.ok) return setMsg({ ok: false, text: "Não deu certo agora. Tente de novo." });
    if (acao === "revogar") {
      setSince(null);
      setShown(null);
      return setMsg({ ok: true, text: "Link revogado. Ninguém mais valida códigos por ele." });
    }
    setSince(j!.createdAt!);
    setShown({ url: j!.url!, qr: j!.qr! });
    setCopied(false);
  };
  return (
    <section aria-labelledby="link-garcom" data-testid="link-garcom" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4">
      <h2 id="link-garcom" className="text-base font-semibold text-ink">
        Link do garçom
      </h2>
      <p className="text-sm text-ink">Abre só esta tela de validar, sem o resto do Portal e sem login. Todos os celulares da equipe podem ler o mesmo QR.</p>
      <p className="text-sm text-ink-muted" data-testid="link-garcom-estado">
        {since ? `Link ativo desde ${when(since)}.` : "Nenhum link ativo."}
      </p>
      {shown && (
        <div className="flex flex-col gap-2 rounded-sm border border-border bg-surface-muted p-3">
          <p className="text-sm font-semibold text-ink">Guarde agora: o link aparece só esta vez.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URI (SVG), gerado no servidor */}
          <img src={shown.qr} alt="QR do link do garçom" className="size-40 self-start bg-white" />
          <p className="break-all text-sm text-ink" data-testid="link-garcom-url">
            {shown.url}
          </p>
          <Button
            variant="outline-portal"
            className="self-start"
            onClick={() => void navigator.clipboard?.writeText(shown.url).then(() => setCopied(true), () => setCopied(false))}
          >
            {copied ? "Link copiado" : "Copiar link"}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary-portal" loading={busy === "criar"} disabled={!!busy} onClick={() => void act("criar")}>
          {since ? "Criar link novo" : "Criar link"}
        </Button>
        {since && (
          <Button variant="outline-portal" loading={busy === "revogar"} disabled={!!busy} onClick={() => void act("revogar")}>
            Revogar
          </Button>
        )}
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-ink" : "font-medium text-red-text"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
