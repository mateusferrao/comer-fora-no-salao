"use client";

import { useEffect, useState } from "react";
import type { OfferView } from "@/src/modules/salao/application/views";
import { fictitiousIdentity } from "@/src/modules/salao/domain/fictitious-identity";
import { isPhoneFormat, maskPhone } from "@/src/modules/salao/domain/phone";
import { BottomSheet } from "@/src/ui/components/BottomSheet";
import { Button } from "@/src/ui/components/Button";
import { Field } from "@/src/ui/components/Field";
import { Switch } from "@/src/ui/components/Switch";
import { TXT } from "./textos";

type Props = { open: boolean; slug: string; agora: OfferView | null; onClose: () => void; onDone: () => void };

/** Identificação (espec. 3.5.3, D31, D106): pré-preenchida com fictícios; qualquer telefone no formato é aceito. */
export function IdentifySheet({ open, slug, agora, onClose, onDone }: Props) {
  // Dados fictícios gerados no navegador ao abrir (não no servidor: evita divergência na hidratação).
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    if (!open || name || phone) return;
    const id = fictitiousIdentity(Math.random);
    // Inicialização única ao abrir (aleatória, só no navegador); não há cascata de renderizações.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(id.name);
    setPhone(id.phone);
  }, [open, name, phone]);
  const [opts, setOpts] = useState({ optWhatsapp: true, optApp: true, optPush: true });
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; accept?: string; geral?: string }>({});
  const [busy, setBusy] = useState(false);

  const regenerate = () => {
    const id = fictitiousIdentity(Math.random);
    setName(id.name);
    setPhone(id.phone);
  };

  const submit = async () => {
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = "Informe um nome";
    if (!isPhoneFormat(phone)) e.phone = "Use o formato (00) 90000-0000";
    if (!accept) e.accept = "Marque o aceite para continuar";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/r/${slug}/identificacao`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone, ...opts, accept: true }),
      });
      if (res.status === 409) {
        setErrors({ phone: "Este telefone fictício já está em uso com outro nome. Toque em \"Gerar outros dados fictícios\"." });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      onDone();
    } catch {
      setErrors({ geral: "Não conseguimos salvar seus dados. Tente de novo." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Identifique-se para ativar seus benefícios"
      description={
        <>
          {agora && (
            <span className="block font-medium text-ink">
              Ao continuar, você ativa: {agora.title} · {agora.itemName} e ganha 1 selo.
            </span>
          )}
          <span className="mt-1 block">{TXT.avisoFicticio}</span>
        </>
      }
      actions={
        <Button variant="primary-app" type="submit" form="form-identificacao" loading={busy}>
          Continuar
        </Button>
      }
    >
      <form
        id="form-identificacao"
        autoComplete="off"
        noValidate
        className="flex flex-col gap-4 text-left"
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit();
        }}
      >
        <Field label="Nome (fictício)" name="nome-ficticio" value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="off" error={errors.name} maxLength={60} />
        <Field
          label="Telefone (fictício)"
          name="telefone-ficticio"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(ev) => setPhone(maskPhone(ev.target.value))}
          autoComplete="off"
          error={errors.phone}
          hint="Formato (00) 90000-0000"
        />
        <button type="button" onClick={regenerate} className="-mt-2 min-h-11 self-start text-sm font-medium text-red-text underline">
          Gerar outros dados fictícios
        </button>
        <div>
          <h3 className="text-base font-semibold">Comunicações de promoções</h3>
          <p className="mt-1 text-sm text-ink-muted">Mantenha ativado para receber ofertas e benefícios exclusivos do Comer Fora</p>
          <p className="mt-1 text-xs text-ink-muted">{TXT.nadaEnviado}</p>
          <div className="mt-2">
            <Switch label="WhatsApp" checked={opts.optWhatsapp} onChange={(v) => setOpts((o) => ({ ...o, optWhatsapp: v }))} />
            <Switch label="Notificação no app" checked={opts.optApp} onChange={(v) => setOpts((o) => ({ ...o, optApp: v }))} />
            <Switch label="Push" checked={opts.optPush} onChange={(v) => setOpts((o) => ({ ...o, optPush: v }))} />
          </div>
        </div>
        <label className="flex min-h-11 items-start gap-3 text-sm leading-5">
          <input
            type="checkbox"
            checked={accept}
            onChange={(ev) => setAccept(ev.target.checked)}
            aria-invalid={errors.accept ? true : undefined}
            aria-describedby={errors.accept ? "aceite-erro" : undefined}
            className="mt-0.5 size-5 accent-red-button"
          />
          <span>Aceito usar estes dados neste protótipo</span>
        </label>
        {errors.accept && (
          <p id="aceite-erro" className="-mt-3 text-xs font-medium text-red-text">
            {errors.accept}
          </p>
        )}
        {errors.geral && (
          <p role="alert" className="text-sm font-medium text-red-text">
            {errors.geral}
          </p>
        )}
      </form>
    </BottomSheet>
  );
}
