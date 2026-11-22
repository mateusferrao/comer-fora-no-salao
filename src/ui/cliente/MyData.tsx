"use client";

import { useState } from "react";
import { maskPhone } from "@/src/modules/salao/domain/phone";
import { Button } from "../components/Button";
import { Field } from "../components/Field";

export type MyDataView = { name: string; phone: string; oldPhoneLast4: string | null; email: string };

/**
 * "Seus dados" em "Sua conta" (D250): o cliente vê e corrige nome e telefone (o e-mail é o do login). Cadastro antigo
 * guardou só os 4 últimos dígitos: a tela pede o número completo e, se o campo ficar vazio, mantém o antigo.
 */
export function MyData({ initial, onBack }: { initial: MyDataView; onBack: () => void }) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; geral?: string }>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = "Escreva seu nome (pelo menos 2 letras).";
    if (phone && !/^\(\d{2}\) 9\d{4}-\d{4}$/.test(phone)) e.phone = "Use o formato (11) 91234-5678, com DDD.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setSaved(false);
    // Sem mexer no telefone de um cadastro antigo, ele fica como está (null); vazio de propósito apaga.
    const keepOld = !touched && !!initial.oldPhoneLast4 && phone === "";
    const r = await fetch("/api/cliente/dados", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: keepOld ? null : phone }),
    }).catch(() => null);
    setBusy(false);
    if (r?.ok) return setSaved(true);
    const j = (await r?.json().catch(() => null)) as { campos?: string[] } | null;
    if (j?.campos?.includes("phone")) return setErrors({ phone: "Use o formato (11) 91234-5678, com DDD." });
    if (j?.campos?.includes("name")) return setErrors({ name: "Escreva seu nome (pelo menos 2 letras)." });
    setErrors({ geral: r ? "Não conseguimos salvar agora. Tente de novo em instantes." : "Sem conexão. Verifique a internet e tente de novo." });
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4 text-left"
      onSubmit={(ev) => {
        ev.preventDefault();
        void save();
      }}
    >
      <Field label="Nome" name="name" autoComplete="name" value={name} onChange={(ev) => (setName(ev.target.value), setSaved(false))} error={errors.name} maxLength={60} />
      <Field
        label="Telefone (opcional)"
        name="tel"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={phone}
        onChange={(ev) => (setPhone(maskPhone(ev.target.value)), setTouched(true), setSaved(false))}
        error={errors.phone}
        hint={initial.oldPhoneLast4 && !touched ? `Hoje guardamos só o final ${initial.oldPhoneLast4}. Informe o número completo, no formato (11) 91234-5678.` : "Formato (11) 91234-5678"}
      />
      <div className="text-sm">
        <p className="font-medium text-ink">E-mail</p>
        <p className="text-ink-muted">{initial.email || "—"}</p>
        <p className="text-xs text-ink-muted">É o e-mail com que você entra. Ele não muda por aqui.</p>
      </div>
      <p className="text-xs text-ink-muted">Os restaurantes em que você aceitou participar veem seu nome, telefone e e-mail.</p>
      {errors.geral && (
        <p role="alert" className="text-sm font-medium text-red-text">
          {errors.geral}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-medium text-ink">
          Dados salvos.
        </p>
      )}
      <Button variant="primary-app" type="submit" loading={busy}>
        Salvar
      </Button>
      <Button variant="outline-app" onClick={onBack}>
        Voltar
      </Button>
    </form>
  );
}
