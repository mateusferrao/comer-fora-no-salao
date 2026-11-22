"use client";

import { useState } from "react";
import { BottomSheet } from "../components/BottomSheet";
import { Button } from "../components/Button";
import { Field } from "../components/Field";

/**
 * "Entrar com e-mail" na Jornada (D257): para quem já é cliente ver e corrigir os próprios dados sem fazer check-in.
 * E-mail → código de 6 dígitos (o mesmo do check-in), sem aceite de restaurante e sem visita.
 */
export function JourneyLogin({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: unknown) {
    const r = await fetch(`/api/cliente/entrar${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = ((await r?.json().catch(() => ({}))) ?? {}) as { erro?: string; restantes?: number };
    return { r, j };
  }

  async function sendEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Digite um e-mail válido, como nome@exemplo.com.");
    setBusy(true);
    setError(null);
    const { r, j } = await post("", { email: email.trim() });
    setBusy(false);
    if (r?.ok) return setStep("codigo");
    setError(
      !r
        ? "Sem conexão. Verifique a internet e tente de novo."
        : r.status === 429
          ? "Muitos pedidos de código. Espere alguns minutos e tente de novo."
          : j.erro === "email_invalido"
            ? "Digite um e-mail válido, como nome@exemplo.com."
            : "Não conseguimos enviar o código agora. Tente de novo em instantes.",
    );
  }

  async function confirm() {
    if (!/^\d{6}$/.test(code.replace(/\D/g, ""))) return setError("O código tem 6 números.");
    setBusy(true);
    setError(null);
    const { r, j } = await post("/confirmar", { email: email.trim(), code: code.replace(/\D/g, "") });
    setBusy(false);
    if (r?.ok) return onDone();
    const msg: Record<string, string> = {
      sem_cadastro: "Este e-mail ainda não fez check-in. O cadastro começa no 1º check-in num restaurante.",
      incorreto: `Código incorreto · ${String(j.restantes ?? 0)} ${j.restantes === 1 ? "tentativa restante" : "tentativas restantes"}`,
      expirado: "O código venceu. Peça outro.",
      bloqueado: "Muitas tentativas com este código. Peça outro.",
      sem_codigo: "Este código não vale mais. Peça outro.",
    };
    setError(!r ? "Sem conexão. Verifique a internet e tente de novo." : r.status === 429 ? "Muitas tentativas. Espere alguns minutos." : (msg[j.erro ?? ""] ?? "Não deu para entrar agora. Tente de novo."));
  }

  const err = error && (
    <p role="alert" className="text-sm font-medium text-red-text">
      {error}
    </p>
  );
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={step === "email" ? "Entrar com e-mail" : "Digite o código de acesso"}
      description={step === "email" ? "Use o e-mail do seu cadastro. Enviamos um código de acesso de 6 números." : `Enviamos um código de acesso para ${email.trim()}.`}
      actions={
        <Button variant="primary-app" type="submit" form="form-jornada-login" loading={busy}>
          {step === "email" ? "Enviar código" : "Entrar"}
        </Button>
      }
    >
      <form
        id="form-jornada-login"
        noValidate
        className="flex flex-col gap-3 text-left"
        onSubmit={(ev) => {
          ev.preventDefault();
          void (step === "email" ? sendEmail() : confirm());
        }}
      >
        {step === "email" ? (
          <Field label="E-mail" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} maxLength={254} />
        ) : (
          <>
            <Field label="Código de acesso" name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(ev) => setCode(ev.target.value)} autoFocus />
            <button type="button" className="min-h-11 self-start text-sm font-semibold text-red-text underline" onClick={() => (setStep("email"), setCode(""), setError(null))}>
              Trocar e-mail ou pedir outro código
            </button>
          </>
        )}
        {err}
      </form>
    </BottomSheet>
  );
}
