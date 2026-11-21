"use client";

import { Checkbox } from "../components/Checkbox";
import { useEffect, useRef, useState } from "react";
import type { OfferView } from "@/src/modules/salao/application/views";
import { maskPhone } from "@/src/modules/salao/domain/phone";
import { BottomSheet } from "@/src/ui/components/BottomSheet";
import { Button } from "@/src/ui/components/Button";
import { Field } from "@/src/ui/components/Field";
import { Switch } from "@/src/ui/components/Switch";
import { TXT } from "./textos";

export type LoginStep = "email" | "codigo" | "perfil" | "consentir";

type Props = {
  open: boolean;
  slug: string;
  restaurantName: string;
  agora: OfferView | null;
  initialStep: LoginStep;
  firstName?: string | null;
  onClose: () => void;
  onDone: () => void;
};

const STORE_KEY = "cf_login";
const RESEND_SEC = 30;

/**
 * Login do cliente (S4 — D154, D161, D171, D173): e-mail + aceite → código → (só quem é novo) nome, telefone
 * opcional e interruptores; cliente já logado num restaurante novo só confirma o aceite (revisão S4 I1).
 * O passo e o e-mail ficam no sessionStorage (no iOS, trocar para o app de e-mail pode recarregar a aba).
 */
export function LoginSheet({ open, slug, restaurantName, agora, initialStep, firstName, onClose, onDone }: Props) {
  const [step, setStep] = useState<LoginStep>(initialStep);
  const [email, setEmail] = useState("");
  const [accept, setAccept] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [opts, setOpts] = useState({ optEmail: true, optApp: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- inicialização única ao abrir (retoma o passo salvo); sem cascata */
  useEffect(() => {
    if (!open) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null") as { slug: string; step: LoginStep; email: string } | null;
      if (saved?.slug === slug && saved.step === "codigo" && initialStep === "email") {
        setStep("codigo");
        setEmail(saved.email);
        return;
      }
    } catch {
      /* sessionStorage indisponível: segue do início */
    }
    setStep(initialStep);
  }, [open, slug, initialStep]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const remember = (s: LoginStep, e: string) => {
    try {
      if (s === "codigo") sessionStorage.setItem(STORE_KEY, JSON.stringify({ slug, step: s, email: e }));
      else sessionStorage.removeItem(STORE_KEY);
    } catch {
      /* ignora */
    }
  };

  const startResend = () => {
    setResendIn(RESEND_SEC);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setResendIn((s) => (s <= 1 ? (clearInterval(timer.current!), 0) : s - 1)), 1000);
  };

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`/api/r/${slug}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { res, j };
  };

  const afterLogin = (etapa: unknown) => {
    remember("perfil", "");
    if (etapa === "perfil" || etapa === "consentir") setStep(etapa);
    else onDone();
  };

  const sendEmail = async (resend = false) => {
    const e: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = "Informe um e-mail válido";
    if (!accept && !resend) e.accept = "Marque o aceite para continuar";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const { res, j } = await post("/entrar", { email: email.trim(), accept: true });
      if (res.status === 429) return setErrors({ geral: "Muitas tentativas. Espere alguns minutos e tente de novo." });
      if (res.status === 400) return setErrors({ email: "Informe um e-mail válido" });
      if (!res.ok) return setErrors({ geral: "Não conseguimos enviar o código agora. Tente de novo em instantes." });
      if (j.etapa === "perfil") return afterLogin("perfil");
      const confirmed = typeof j.email === "string" ? j.email : email.trim().toLowerCase();
      setEmail(confirmed);
      setCode("");
      setStep("codigo");
      remember("codigo", confirmed);
      startResend();
    } catch {
      setErrors({ geral: "Não conseguimos enviar o código agora. Tente de novo em instantes." });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) return setErrors({ code: "O código tem 6 números" });
    setErrors({});
    setBusy(true);
    try {
      const { res, j } = await post("/entrar/confirmar", { email, code: code.replace(/\s/g, "") });
      if (res.ok) return afterLogin(j.etapa);
      if (res.status === 429) return setErrors({ code: "Muitas tentativas. Espere alguns minutos." });
      const msg: Record<string, string> = {
        incorreto: `Código incorreto · ${String(j.restantes ?? 0)} ${j.restantes === 1 ? "tentativa restante" : "tentativas restantes"}`,
        expirado: "O código venceu. Peça outro.",
        bloqueado: "Muitas tentativas com este código. Peça outro.",
        sem_codigo: "Este código não vale mais. Peça outro.",
      };
      setErrors({ code: msg[String(j.erro)] ?? "Não deu certo. Confira o código." });
    } catch {
      setErrors({ code: "Não conseguimos conferir agora. Tente de novo." });
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Informe seu nome";
    if (phone && !/^\(\d{2}\) 9\d{4}-\d{4}$/.test(phone)) e.phone = "Use o formato (11) 91234-5678 ou deixe em branco";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const { res } = await post("/perfil", { name: name.trim(), phone, ...opts });
      if (res.status === 401) return setStep("email");
      if (!res.ok) return setErrors({ geral: "Não conseguimos salvar. Tente de novo." });
      onDone();
    } catch {
      setErrors({ geral: "Não conseguimos salvar. Tente de novo." });
    } finally {
      setBusy(false);
    }
  };

  const consent = async () => {
    setBusy(true);
    try {
      const { res } = await post("/consentimento", opts);
      if (res.status === 401) return setStep("email");
      if (!res.ok) return setErrors({ geral: "Não deu certo agora. Tente de novo." });
      onDone();
    } catch {
      setErrors({ geral: "Não deu certo agora. Tente de novo." });
    } finally {
      setBusy(false);
    }
  };

  const ativa = agora ? `Ao continuar, você ativa: ${agora.title} · ${agora.itemName} e ganha 1 selo.` : null;
  const switches = (
    <div>
      <h3 className="text-base font-semibold">Comunicações de promoções</h3>
      <p className="mt-1 text-sm text-ink-muted">Receba os convites e benefícios de {restaurantName}</p>
      <div className="mt-2">
        <Switch label="E-mail" checked={opts.optEmail} onChange={(v) => setOpts((o) => ({ ...o, optEmail: v }))} />
        <Switch label="Convites de volta no app" hint="Sem e-mail e sem esta opção, você não recebe convites para voltar" checked={opts.optApp} onChange={(v) => setOpts((o) => ({ ...o, optApp: v }))} />
      </div>
    </div>
  );
  const geral = errors.geral && (
    <p role="alert" className="text-sm font-medium text-red-text">
      {errors.geral}
    </p>
  );

  if (step === "codigo")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="Digite o código"
        description={
          <>
            <span className="block">Enviamos um código de 6 números para</span>
            <span className="block break-all font-medium text-ink">{email}</span>
          </>
        }
        actions={
          <Button variant="primary-app" type="submit" form="form-codigo" loading={busy}>
            Entrar
          </Button>
        }
      >
        <form id="form-codigo" noValidate className="flex flex-col gap-3 text-left" onSubmit={(ev) => (ev.preventDefault(), void confirm())}>
          <Field label="Código" name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(ev) => setCode(ev.target.value)} error={errors.code} autoFocus />
          <p className="text-sm text-ink-muted">Não chegou? Veja a caixa de spam.</p>
          <div className="flex flex-wrap gap-x-5">
            <button type="button" disabled={resendIn > 0 || busy} onClick={() => void sendEmail(true)} className="min-h-11 text-sm font-medium text-red-text underline disabled:text-ink-muted disabled:no-underline">
              {resendIn > 0 ? `Reenviar em ${resendIn} s` : "Reenviar código"}
            </button>
            <button type="button" onClick={() => (setStep("email"), remember("email", ""))} className="min-h-11 text-sm font-medium text-red-text underline">
              Trocar e-mail
            </button>
          </div>
        </form>
      </BottomSheet>
    );

  if (step === "perfil")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="Como podemos te chamar?"
        description={ativa}
        actions={
          <Button variant="primary-app" type="submit" form="form-perfil" loading={busy}>
            Continuar
          </Button>
        }
      >
        <form id="form-perfil" noValidate className="flex flex-col gap-4 text-left" onSubmit={(ev) => (ev.preventDefault(), void saveProfile())}>
          <Field label="Nome" name="name" autoComplete="name" value={name} onChange={(ev) => setName(ev.target.value)} error={errors.name} maxLength={60} />
          <Field
            label="Telefone (opcional)"
            name="tel"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            onChange={(ev) => setPhone(maskPhone(ev.target.value))}
            error={errors.phone}
            hint="Formato (11) 91234-5678"
          />
          {switches}
          {geral}
        </form>
      </BottomSheet>
    );

  if (step === "consentir")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={firstName ? `Olá, ${firstName}!` : "Ative seus benefícios"}
        description={ativa ?? `Faça check-in em ${restaurantName} e junte selos.`}
        actions={
          <Button variant="primary-app" onClick={() => void consent()} loading={busy}>
            Aceitar e fazer check-in
          </Button>
        }
      >
        <div className="flex flex-col gap-4 text-left">
          {switches}
          <p className="text-xs leading-4 text-ink-muted">{TXT.consentimento(restaurantName)}</p>
          {geral}
        </div>
      </BottomSheet>
    );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Entre para ativar seus benefícios"
      description={ativa}
      actions={
        <Button variant="primary-app" type="submit" form="form-email" loading={busy}>
          Enviar código
        </Button>
      }
    >
      <form id="form-email" noValidate className="flex flex-col gap-4 text-left" onSubmit={(ev) => (ev.preventDefault(), void sendEmail())}>
        <Field label="E-mail" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} error={errors.email} maxLength={254} />
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-5">
          <Checkbox
            tone="app"
            checked={accept}
            onChange={(ev) => setAccept(ev.target.checked)}
            aria-invalid={errors.accept ? true : undefined}
            aria-describedby={errors.accept ? "aceite-erro" : undefined}
            className="mt-0.5"
          />
          <span>{TXT.consentimento(restaurantName)}</span>
        </label>
        {errors.accept && (
          <p id="aceite-erro" className="-mt-3 text-xs font-medium text-red-text">
            {errors.accept}
          </p>
        )}
        <p className="text-xs leading-4 text-ink-muted">{TXT.privacidade}</p>
        {geral}
      </form>
    </BottomSheet>
  );
}
