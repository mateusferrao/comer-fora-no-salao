"use client";

import { useRef, useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/ui/components/Button";
import { Field } from "@/src/ui/components/Field";
import { Logo } from "@/src/ui/components/Logo";

type Step = "email" | "codigo";
const RESEND_S = 60;

/** Login do dono (D118): portal/01 (e-mail → Avançar) + passo do código de 6 dígitos ([C]). */
export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [hint, setHint] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function askCode(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim()) {
      setError("Preencha os campos destacados para prosseguir.");
      emailRef.current?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parceiro/entrar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const j = (await res.json().catch(() => ({}))) as { dica?: string; erro?: string; retryAfterSec?: number };
      if (res.ok && j.dica) {
        setHint(j.dica);
        setStep("codigo");
        setCode("");
        setWait(RESEND_S);
        setTimeout(() => codeRef.current?.focus(), 0);
      } else if (j.erro === "email_invalido") setError("Use um e-mail válido.");
      else if (j.erro === "limite") setError(`Muitas tentativas. Tente de novo em ${Math.max(1, Math.ceil((j.retryAfterSec ?? 60) / 60))} min.`);
      else setError("Não conseguimos enviar o código agora. Tente de novo em instantes. Se você recebeu um link de acesso junto com o case, pode usá-lo.");
    } catch {
      setError("Não conseguimos enviar o código agora. Tente de novo em instantes. Se você recebeu um link de acesso junto com o case, pode usá-lo.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Digite os 6 números do código.");
      codeRef.current?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parceiro/entrar/codigo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, codigo: code.trim() }) });
      const j = (await res.json().catch(() => ({}))) as { erro?: string; restantes?: number; retryAfterSec?: number };
      if (res.ok) {
        router.replace("/parceiro/salao");
        router.refresh();
        return;
      }
      if (j.erro === "incorreto") setError(j.restantes ? `Código incorreto. Restam ${j.restantes} ${j.restantes === 1 ? "tentativa" : "tentativas"}.` : "Código incorreto. Peça outro código.");
      else if (j.erro === "expirado" || j.erro === "sem_codigo") setError("Código expirado. Peça outro.");
      else if (j.erro === "bloqueado") setError("Muitas tentativas com este código. Peça outro.");
      else if (j.erro === "limite") setError(`Muitas tentativas. Tente de novo em ${Math.max(1, Math.ceil((j.retryAfterSec ?? 60) / 60))} min.`);
      else setError("Não conseguimos conferir o código. Tente de novo.");
      codeRef.current?.focus();
    } catch {
      setError("Não conseguimos conferir o código. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[428px] rounded-sm bg-white px-6 py-8 shadow-low sm:px-8">
      <div className="flex justify-center">
        <Logo height={40} />
      </div>
      <h1 className="mt-6 text-center text-2xl font-bold text-ink">Portal do Parceiro</h1>
      <p className="mt-1 text-center text-sm text-ink-muted">Gerencie sua loja de forma fácil e rápida</p>

      {step === "email" ? (
        <form className="mt-6 flex flex-col gap-4" onSubmit={askCode} noValidate>
          <Field
            ref={emailRef}
            label="E-mail"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nome@email.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button type="submit" variant="primary-portal" loading={loading} className="w-full">
            Avançar
          </Button>
        </form>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={verify} noValidate>
          <p className="text-sm text-ink" aria-live="polite">
            Digite o código de 6 dígitos que enviamos para <strong>{hint}</strong>.
          </p>
          <Field
            ref={codeRef}
            label="Código"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            error={error}
            hint="O código vale por 10 minutos. Confira também a caixa de spam."
          />
          <Button type="submit" variant="primary-portal" loading={loading} className="w-full">
            Entrar
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              className="min-h-11 font-semibold text-red-text underline disabled:text-ink-muted disabled:no-underline"
              disabled={wait > 0 || loading}
              onClick={() => askCode()}
            >
              {wait > 0 ? `Reenviar código em ${wait} s` : "Reenviar código"}
            </button>
            <button
              type="button"
              className="min-h-11 font-semibold text-red-text underline"
              onClick={() => {
                setStep("email");
                setError(null);
                setTimeout(() => emailRef.current?.focus(), 0);
              }}
            >
              Usar outro e-mail
            </button>
          </div>
          <span className="sr-only" aria-live="polite">
            {wait === 0 ? "Você já pode pedir um novo código." : ""}
          </span>
        </form>
      )}

      <p className="mt-6 text-xs leading-5 text-ink-muted">
        Protótipo de case: usamos seu e-mail só para enviar o código. Guardamos apenas um código irreversível dele (HMAC). Contas sem acesso por 7 dias são apagadas.
      </p>
    </div>
  );
}
