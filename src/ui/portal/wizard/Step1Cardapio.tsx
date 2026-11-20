"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { api, markStep } from "./api";
import { PREP_MESSAGES, PrepError, prepareMenuFile } from "./images";

export type ExampleCard = { id: string; label: string; description: string; thumb: string };

/** Passo 1 (espec. 3.2): foto/PDF, um dos 3 exemplos ou "Importar do delivery (simulado)". A IA lê em segundo plano. */
export function Step1Cardapio({ examples }: { examples: ExampleCard[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  useEffect(() => markStep(1), []);

  const next = () => {
    router.push("/parceiro/salao/ativar/2");
    router.refresh();
  };

  async function startCached(source: "exemplo" | "importado", exampleId?: string) {
    setBusy(exampleId ?? source);
    setError(null);
    const r = await api("/api/parceiro/cardapio/extrair", "POST", { source, exampleId });
    if (r.ok) next();
    else {
      setError("Não conseguimos começar agora. Tente de novo.");
      setBusy(null);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy("arquivo");
    setError(null);
    try {
      const { pages, origem } = await prepareMenuFile(f);
      const form = new FormData();
      pages.forEach((p, i) => form.append("paginas", p, `pagina-${i + 1}.jpg`));
      form.append("origem", origem);
      const res = await fetch("/api/parceiro/cardapio/extrair", { method: "POST", body: form });
      if (res.ok) return next();
      setError(
        res.status === 429
          ? "Você atingiu o limite de leituras com IA de hoje. Use um exemplo ou digite o cardápio."
          : res.status === 413
            ? "O arquivo ficou grande demais. Tire uma foto menor ou exporte o PDF com menos páginas."
            : "Não conseguimos enviar o arquivo. Tente de novo ou use um exemplo.",
      );
    } catch (e) {
      setError(e instanceof PrepError ? PREP_MESSAGES[e.code] : "Não conseguimos abrir este arquivo. Tente outro ou use um exemplo.");
    } finally {
      if (input.current) input.current.value = "";
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-ink">Cardápio do salão</h2>
        <p className="mt-1 text-sm text-ink-muted">O cardápio do salão costuma ter itens e preços diferentes do delivery. A IA lê enquanto você conta sobre o seu salão.</p>
      </div>

      <section aria-labelledby="enviar" className="flex flex-col gap-3 rounded-sm border border-dashed border-ink-muted p-5">
        <h3 id="enviar" className="font-semibold text-ink">
          Enviar foto ou PDF
        </h3>
        <p className="text-sm text-ink-muted">JPG, PNG, WEBP ou PDF de até 5 páginas (até 8 MB). A imagem não é guardada.</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.heic,.heif"
          className="sr-only"
          id="arquivo-cardapio"
          aria-label="Arquivo do cardápio (foto ou PDF)"
          onChange={(e) => onFile(e.target.files?.[0])}
          disabled={!!busy}
        />
        <div>
          <Button variant="primary-portal" loading={busy === "arquivo"} onClick={() => input.current?.click()} aria-describedby="arquivo-dica">
            Escolher arquivo
          </Button>
          <span id="arquivo-dica" className="sr-only">
            Abre a seleção de arquivo do aparelho
          </span>
        </div>
        {busy === "arquivo" && (
          <p role="status" className="text-sm text-ink">
            Preparando as páginas…
          </p>
        )}
      </section>

      <section aria-labelledby="exemplos" className="flex flex-col gap-3">
        <h3 id="exemplos" className="font-semibold text-ink">
          Ou use um exemplo (fictício)
        </h3>
        <ul className="grid gap-3 sm:grid-cols-3">
          {examples.map((e) => (
            <li key={e.id} className="flex flex-col overflow-hidden rounded-sm border border-border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.thumb} alt={`Cardápio de exemplo: ${e.label}`} className="h-32 w-full object-cover object-top" />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="font-semibold text-ink">{e.label}</p>
                <p className="flex-1 text-sm text-ink-muted">{e.description}</p>
                <Button variant="outline-portal" loading={busy === e.id} disabled={!!busy && busy !== e.id} onClick={() => startCached("exemplo", e.id)}>
                  Usar este exemplo
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-ink">
        Prefere digitar?{" "}
        <Link href="/parceiro/salao/ativar/3" className="font-semibold text-red-text underline">
          Digitar o cardápio
        </Link>
      </p>

      <section aria-labelledby="importar" className="flex flex-col gap-2 rounded-sm border border-border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="importar" className="font-semibold text-ink">
            Importar do delivery
          </h3>
          <Badge tone="neutral">simulado</Badge>
        </div>
        <p className="text-sm text-ink-muted">Traz o cardápio que você já tem no delivery para começar.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline-portal" loading={busy === "importado"} disabled={!!busy && busy !== "importado"} onClick={() => startCached("importado")}>
            Importar do delivery (simulado)
          </Button>
          <button type="button" aria-expanded={why} onClick={() => setWhy((w) => !w)} className="min-h-11 text-sm font-semibold text-red-text underline">
            Por quê?
          </button>
        </div>
        {why && (
          <p className="text-sm text-ink">
            Não integramos com o iFood porque o case proíbe usar dados reais ou internos. Em produção, viria do cardápio de delivery do Portal.
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-text">
          {error}
        </p>
      )}
    </div>
  );
}
