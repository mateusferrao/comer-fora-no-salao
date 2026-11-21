"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NotifyView } from "@/src/modules/config/application/update-settings";
import type { NotifySettings } from "@/src/modules/config/domain/notify-settings";
import { Button } from "../components/Button";
import { Switch } from "../components/Switch";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const TIMES = Array.from({ length: (22 * 60 - 6 * 60) / 30 + 1 }, (_, i) => 6 * 60 + i * 30);
const HOURS = Array.from({ length: 24 }, (_, i) => i + 1);
const OFF_HINT = "O envio automático está desligado por enquanto.";

/**
 * "Avisos e automação" (S6.1 — D196): o que o sistema faz sozinho e o que vai por e-mail, em 3 grupos. Tudo ligado
 * por padrão. Com a flag global desligada, o interruptor aparece desabilitado com a explicação (revisão de produto I2).
 */
export function NotifySettingsTab({ view, flags }: { view: NotifyView; flags: { agendador: boolean; resumo_email: boolean } }) {
  const router = useRouter();
  const [s, setS] = useState<NotifySettings>(view.settings);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<NotifySettings>) => (setS({ ...s, ...patch }), setMsg(null));
  const save = async () => {
    setBusy(true);
    const r = await fetch("/api/parceiro/configuracoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "avisos", settings: s }) }).catch(() => null);
    setBusy(false);
    setMsg(r?.ok ? { ok: true, text: "Avisos salvos" } : { ok: false, text: "Não conseguimos salvar. Tente de novo." });
    if (r?.ok) router.refresh();
  };
  const when = `${DAYS[s.resumo.weekday]} às ${hhmm(s.resumo.minute)}`;
  const digestOff = !flags.resumo_email;
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="avisos-voce" className="flex flex-col gap-2 rounded-sm border border-border p-4">
        <h2 id="avisos-voce" className="text-lg font-bold text-ink">
          Para você
        </h2>
        <Switch
          label="Receber o resumo da semana por e-mail"
          hint={digestOff ? OFF_HINT : view.to ? `Vai para ${view.to} · ${when} (horário de Brasília)` : undefined}
          checked={s.resumo.on}
          disabled={digestOff}
          onChange={(on) => set({ resumo: { ...s.resumo, on } })}
        />
        {!view.to && (
          <p className="text-sm text-ink-muted">
            {view.ownerVia === "link" ? "Esta conta entrou pelo link de acesso e não tem e-mail guardado: " : "Entre com seu e-mail para receber o resumo. Enquanto isso, "}
            <Link href="/parceiro/salao/plano#resumo" className="font-semibold text-red-text underline">
              veja o e-mail que o dono recebe em Plano da semana
            </Link>
            .
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Dia
            <select className="min-h-11 rounded-sm border border-border bg-white px-2" value={s.resumo.weekday} disabled={!s.resumo.on || digestOff} onChange={(e) => set({ resumo: { ...s.resumo, weekday: Number(e.target.value) } })}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Hora (de Brasília)
            <select className="min-h-11 rounded-sm border border-border bg-white px-2" value={s.resumo.minute} disabled={!s.resumo.on || digestOff} onChange={(e) => set({ resumo: { ...s.resumo, minute: Number(e.target.value) } })}>
              {TIMES.map((m) => (
                <option key={m} value={m}>
                  {hhmm(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Switch
          label="Permitir aprovar o plano pelo link do e-mail"
          hint={!s.resumo.on || digestOff ? "Precisa do resumo ligado." : "O link vale uma vez, só para o plano daquela semana."}
          checked={s.aprovarEmail}
          disabled={!s.resumo.on || digestOff}
          onChange={(aprovarEmail) => set({ aprovarEmail })}
        />
      </section>

      <section aria-labelledby="avisos-plano" className="flex flex-col gap-2 rounded-sm border border-border p-4">
        <h2 id="avisos-plano" className="text-lg font-bold text-ink">
          Plano da semana
        </h2>
        <Switch
          label="Gerar o plano da semana sozinho"
          hint={!flags.agendador ? OFF_HINT : `${when}, meia hora antes do resumo. O plano espera sua aprovação no Portal.`}
          checked={s.planoAuto}
          disabled={!flags.agendador}
          onChange={(planoAuto) => set({ planoAuto })}
        />
      </section>

      <section aria-labelledby="avisos-clientes" className="flex flex-col gap-2 rounded-sm border border-border p-4">
        <h2 id="avisos-clientes" className="text-lg font-bold text-ink">
          Para seus clientes
        </h2>
        <p className="text-sm text-ink-muted">Só para quem aceitou receber e-mails. No app, o convite aparece sempre.</p>
        <Switch label="Convite por e-mail quando o cliente ganha o convite na mesa" checked={s.emails.convite} onChange={(convite) => set({ emails: { ...s.emails, convite } })} />
        <Switch label="Convite de volta (reativação) por e-mail" checked={s.emails.reativacao} onChange={(reativacao) => set({ emails: { ...s.emails, reativacao } })} />
        <Switch label="Lembrete no dia do convite" hint={!flags.agendador ? OFF_HINT : undefined} checked={s.emails.lembrete} disabled={!flags.agendador} onChange={(lembrete) => set({ emails: { ...s.emails, lembrete } })} />
        <label className="flex flex-col gap-1 text-sm text-ink">
          Lembrete: horas antes do horário do convite (nunca antes das 7h)
          <select
            className="min-h-11 w-40 rounded-sm border border-border bg-white px-2"
            value={s.lembreteHorasAntes}
            disabled={!s.emails.lembrete || !flags.agendador}
            onChange={(e) => set({ lembreteHorasAntes: Number(e.target.value) })}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h} {h === 1 ? "hora" : "horas"} antes
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="flex items-center gap-3">
        <Button variant="primary-portal" loading={busy} onClick={() => void save()}>
          Salvar
        </Button>
        {msg && (
          <p role="status" className={`text-sm ${msg.ok ? "text-ink" : "font-medium text-red-text"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
