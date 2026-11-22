"use client";

import { confirmDialog } from "../components/ConfirmDialog";
import { useState } from "react";
import { Button } from "../components/Button";

const when = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * "Link do garçom" (S6.2 — D190): link + QR mostrados UMA vez (o banco guarda só o hash); criar de novo revoga o
 * anterior; "Desligar link" corta na hora. Sem PIN.
 */
export function WaiterLinkCard({ activeSince }: { activeSince: string | null }) {
  const [since, setSince] = useState(activeSince);
  const [shown, setShown] = useState<{ url: string; qr: string } | null>(null);
  const [busy, setBusy] = useState<"" | "criar" | "revogar">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const act = async (acao: "criar" | "revogar") => {
    if (
      acao === "criar" &&
      since &&
      !(await confirmDialog({
        title: "Criar um link novo?",
        body: "O link atual é desligado: todos os celulares da equipe precisam ler o QR novo.",
        confirmLabel: "Criar link novo",
      }))
    )
      return;
    if (
      acao === "revogar" &&
      !(await confirmDialog({
        title: "Desligar o link do garçom?",
        body: "Quem usa o link atual perde o acesso na hora.",
        confirmLabel: "Desligar link",
      }))
    )
      return;
    setBusy(acao);
    setMsg(null);
    const r = await fetch("/api/parceiro/garcom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { url?: string; qr?: string; createdAt?: string } | null;
    setBusy("");
    if (!r?.ok) return setMsg({ ok: false, text: "Não deu certo agora. Tente de novo." });
    if (acao === "revogar") {
      setSince(null);
      setShown(null);
      return setMsg({ ok: true, text: "Link desligado. Ninguém mais valida códigos por ele." });
    }
    setSince(j!.createdAt!);
    setShown({ url: j!.url!, qr: j!.qr! });
    setCopied(false);
  };
  // Revisão S4–S6 (produto 8): o QR aparece uma vez — dá para imprimir para a equipe ou mandar pelo WhatsApp.
  const printQr = () => {
    if (!shown) return;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    const doc = w.document;
    doc.title = "Link do garçom";
    const h = doc.createElement("h1");
    h.textContent = "Link do garçom · aponte a câmera para validar códigos";
    h.style.font = "600 18px system-ui, sans-serif";
    const img = doc.createElement("img");
    img.src = shown.qr;
    img.alt = "QR do link do garçom";
    img.style.width = "8cm";
    doc.body.append(h, img);
    img.onload = () => w.print();
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
          <div className="flex flex-wrap gap-3">
            <Button variant="outline-portal" onClick={printQr}>
              Imprimir QR para a equipe
            </Button>
            <a
              className="inline-flex min-h-11 items-center rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text hover:bg-red-text/5"
              href={`https://wa.me/?text=${encodeURIComponent(`Link do garçom para validar códigos: ${shown.url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Enviar pelo WhatsApp
            </a>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary-portal" loading={busy === "criar"} disabled={!!busy} onClick={() => void act("criar")}>
          {since ? "Criar link novo" : "Criar link"}
        </Button>
        {since && (
          <Button variant="outline-portal" loading={busy === "revogar"} disabled={!!busy} onClick={() => void act("revogar")}>
            Desligar link
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
