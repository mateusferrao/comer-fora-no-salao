import { describe, expect, it } from "vitest";
import { NOTIFY_DEFAULTS, notifySettingsInput, parseNotifySettings } from "@/src/modules/config/domain/notify-settings";

describe("Avisos e automação (S6.1, D196): padrões e leitura tolerante por campo", () => {
  it("nulo ou lixo → padrões, tudo ligado (segunda 08:30, lembrete 3 h antes)", () => {
    expect(NOTIFY_DEFAULTS).toEqual({
      resumo: { on: true, weekday: 1, minute: 510 },
      planoAuto: true,
      aprovarEmail: true,
      emails: { convite: true, lembrete: true, reativacao: true },
      lembreteHorasAntes: 3,
    });
    expect(parseNotifySettings(null)).toEqual(NOTIFY_DEFAULTS);
    expect(parseNotifySettings("x")).toEqual(NOTIFY_DEFAULTS);
  });

  it("um campo inválido volta ao padrão só nele (não religa o resumo desligado — revisão técnica I7)", () => {
    const s = parseNotifySettings({ resumo: { on: false, weekday: 9, minute: 510 }, planoAuto: "sim", emails: { convite: false }, lembreteHorasAntes: 30 });
    expect(s.resumo).toEqual({ on: false, weekday: 1, minute: 510 });
    expect(s.planoAuto).toBe(true);
    expect(s.emails).toEqual({ convite: false, lembrete: true, reativacao: true });
    expect(s.lembreteHorasAntes).toBe(3);
  });

  it("entrada da tela: dia 0–6, hora 06:00–22:00 de 30 em 30 min, lembrete 1–24 h", () => {
    const ok = { ...NOTIFY_DEFAULTS, resumo: { on: true, weekday: 0, minute: 1320 }, lembreteHorasAntes: 24 };
    expect(notifySettingsInput.safeParse(ok).success).toBe(true);
    expect(notifySettingsInput.safeParse({ ...ok, resumo: { on: true, weekday: 1, minute: 345 } }).success).toBe(false);
    expect(notifySettingsInput.safeParse({ ...ok, resumo: { on: true, weekday: 1, minute: 1350 } }).success).toBe(false);
    expect(notifySettingsInput.safeParse({ ...ok, resumo: { on: true, weekday: 1, minute: 525 } }).success).toBe(false);
    expect(notifySettingsInput.safeParse({ ...ok, lembreteHorasAntes: 0 }).success).toBe(false);
    expect(notifySettingsInput.safeParse({ ...ok, lembreteHorasAntes: 25 }).success).toBe(false);
  });
});
