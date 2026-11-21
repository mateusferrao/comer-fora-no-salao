/**
 * "Avisos e automação" do dono (S6.1 — D189, D196): resumo semanal (liga + dia e hora), plano automático
 * (independente do resumo), aprovar pelo e-mail, e-mails aos clientes por tipo e antecedência do lembrete.
 * Gravado em `restaurants.notify_settings` (jsonb); nulo = padrões, todos ligados. A leitura é tolerante POR CAMPO:
 * um valor ruim volta ao padrão só nele, sem religar o que o dono desligou (revisão técnica I7).
 */
import { z } from "zod";

export const NOTIFY_DEFAULTS = {
  resumo: { on: true, weekday: 1, minute: 510 },
  planoAuto: true,
  aprovarEmail: true,
  emails: { convite: true, lembrete: true, reativacao: true },
  lembreteHorasAntes: 3,
} as const;

export type NotifySettings = {
  resumo: { on: boolean; weekday: number; minute: number };
  planoAuto: boolean;
  aprovarEmail: boolean;
  emails: { convite: boolean; lembrete: boolean; reativacao: boolean };
  lembreteHorasAntes: number;
};

export const DIGEST_MIN_MINUTE = 6 * 60;
export const DIGEST_MAX_MINUTE = 22 * 60;
const minute = z.number().int().min(DIGEST_MIN_MINUTE).max(DIGEST_MAX_MINUTE).refine((m) => m % 30 === 0);
const weekday = z.number().int().min(0).max(6);
const hours = z.number().int().min(1).max(24);

/** Entrada da tela (estrita). */
export const notifySettingsInput = z.object({
  resumo: z.object({ on: z.boolean(), weekday, minute }),
  planoAuto: z.boolean(),
  aprovarEmail: z.boolean(),
  emails: z.object({ convite: z.boolean(), lembrete: z.boolean(), reativacao: z.boolean() }),
  lembreteHorasAntes: hours,
});

const D = NOTIFY_DEFAULTS;
const stored = z
  .object({
    resumo: z
      .object({ on: z.boolean().catch(D.resumo.on), weekday: weekday.catch(D.resumo.weekday), minute: minute.catch(D.resumo.minute) })
      .catch({ ...D.resumo }),
    planoAuto: z.boolean().catch(D.planoAuto),
    aprovarEmail: z.boolean().catch(D.aprovarEmail),
    emails: z
      .object({ convite: z.boolean().catch(D.emails.convite), lembrete: z.boolean().catch(D.emails.lembrete), reativacao: z.boolean().catch(D.emails.reativacao) })
      .catch({ ...D.emails }),
    lembreteHorasAntes: hours.catch(D.lembreteHorasAntes),
  })
  .partial();

export function parseNotifySettings(raw: unknown): NotifySettings {
  const r = stored.safeParse(raw && typeof raw === "object" ? raw : {});
  const v = r.success ? r.data : {};
  return {
    resumo: v.resumo ?? { ...D.resumo },
    planoAuto: v.planoAuto ?? D.planoAuto,
    aprovarEmail: v.aprovarEmail ?? D.aprovarEmail,
    emails: v.emails ?? { ...D.emails },
    lembreteHorasAntes: v.lembreteHorasAntes ?? D.lembreteHorasAntes,
  };
}
