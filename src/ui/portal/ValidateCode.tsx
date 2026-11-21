"use client";

import { useRef, useState, type FormEvent } from "react";
import type { CodeLookup } from "@/src/modules/salao/application/validate-code";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";

const REFUSE: Record<string, string> = {
  INVALIDO: "Código não encontrado. Confira as letras e números com o cliente.",
  EXPIRADO: "Este código venceu: ele vale só no dia em que foi gerado.",
  OUTRO_RESTAURANTE: "Este código é de outro restaurante seu. Troque de loja para validar.",
};

/**
 * Tela do garçom (espec. 3.3): campo grande, reconhece o tipo, "Confirmar" uma vez só. Pensada para celular/tablet.
 * `endpoint`/`waiter` (S6.2 — D190): o link do garçom usa as rotas próprias e não fala em "trocar de loja".
 */
export function ValidateCode({ endpoint = "/api/parceiro/codigos", waiter = false }: { endpoint?: string; waiter?: boolean } = {}) {
  const [code, setCode] = useState("");
  const [res, setRes] = useState<CodeLookup | null>(null);
  const [busy, setBusy] = useState<"consultar" | "confirmar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string>("");
  const input = useRef<HTMLInputElement>(null);

  async function call(url: string, body: unknown): Promise<CodeLookup | null> {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.status === 401 && waiter) {
      setError("Este link do garçom não vale mais. Peça um novo ao responsável.");
      return null;
    }
    if (r.status === 429) {
      setError("Muitas consultas seguidas. Espere um minuto.");
      return null;
    }
    return (await r.json().catch(() => null)) as CodeLookup | null;
  }

  async function consult(e: FormEvent) {
    e.preventDefault();
    if (code.replace(/[\s-]/g, "").length < 6) {
      setError("O código tem 6 letras e números.");
      input.current?.focus();
      return;
    }
    setBusy("consultar");
    setError(null);
    key.current = crypto.randomUUID();
    const r = await call(`${endpoint}/consultar`, { codigo: code });
    setBusy(null);
    if (r) setRes(r);
  }

  async function confirm() {
    setBusy("confirmar");
    const r = await call(`${endpoint}/confirmar`, { codigo: code, chave: key.current });
    setBusy(null);
    if (r) setRes(r);
  }

  function reset() {
    setCode("");
    setRes(null);
    setError(null);
    setTimeout(() => input.current?.focus(), 0);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={consult} className="flex flex-col gap-3" noValidate>
        <label htmlFor="codigo" className="text-sm font-medium text-ink">
          Código do cliente
        </label>
        <input
          ref={input}
          id="codigo"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().slice(0, 9));
            setRes(null);
          }}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          maxLength={9}
          placeholder="Digite o código do cliente"
          aria-describedby={error ? "codigo-erro" : undefined}
          className="min-h-16 rounded-md border border-border bg-white px-4 text-center font-mono text-3xl tracking-[0.3em] text-ink uppercase placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:normal-case placeholder:text-ink-muted"
        />
        {error && (
          <p id="codigo-erro" className="text-sm font-medium text-red-text">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary-portal" loading={busy === "consultar"}>
          Consultar
        </Button>
      </form>

      <div aria-live="polite">
        {res && (res.status === "INVALIDO" || res.status === "EXPIRADO" || res.status === "OUTRO_RESTAURANTE") && (
          <p role="alert" className="rounded-sm border border-red-text bg-white p-4 text-sm font-medium text-red-text">
            {REFUSE[res.status]}
          </p>
        )}
        {res && (res.status === "OK" || res.status === "JA_USADO" || res.status === "VALIDADO") && (
          <section aria-label="Código encontrado" className="flex flex-col gap-3 rounded-md border border-border bg-white p-4 shadow-low">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="outline-red">{res.typeLabel}</Badge>
              <span className="font-mono text-sm tracking-widest text-ink-muted">{res.code}</span>
            </div>
            <p className="text-xl font-bold text-ink">{res.title}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-muted">Cliente</dt>
              <dd className="text-ink">{res.customer}</dd>
              {res.phone && (
                <>
                  <dt className="text-ink-muted">Telefone</dt>
                  <dd className="text-ink">{res.phone}</dd>
                </>
              )}
              {res.email && (
                <>
                  <dt className="text-ink-muted">E-mail</dt>
                  <dd className="break-all text-ink">{res.email}</dd>
                </>
              )}
              <dt className="text-ink-muted">Condições</dt>
              <dd className="text-ink">{res.conditions}</dd>
            </dl>
            {res.status === "OK" && (
              <Button variant="primary-portal" loading={busy === "confirmar"} onClick={confirm}>
                Confirmar
              </Button>
            )}
            {res.status === "VALIDADO" && (
              <p role="status" className="text-base font-semibold text-ink">
                Código validado ✓ às {res.validatedAt}
              </p>
            )}
            {res.status === "JA_USADO" && <p className="text-sm font-medium text-red-text">Este código já foi usado às {res.validatedAt}.</p>}
          </section>
        )}
      </div>
      {res && (
        <button type="button" onClick={reset} className="min-h-11 self-start text-sm font-semibold text-red-text underline">
          Validar outro código
        </button>
      )}
    </div>
  );
}
