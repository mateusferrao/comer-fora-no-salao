import { describe, expect, it } from "vitest";
import { emailDecision, parseEmailPrefs } from "@/src/modules/salao/domain/email-prefs";
import { NOTIFY_DEFAULTS } from "@/src/modules/config/domain/notify-settings";

const owner = NOTIFY_DEFAULTS.emails;
const base = { optEmail: true, prefs: parseEmailPrefs(null), hasEmail: true, owner };

describe("quem recebe cada e-mail (S6.1, D196, D198)", () => {
  it("preferências do cliente: nulo ou lixo → tudo ligado; campo ruim volta ao padrão só nele", () => {
    expect(parseEmailPrefs(null)).toEqual({ convites: true, lembretes: true });
    expect(parseEmailPrefs({ convites: false, lembretes: "x" })).toEqual({ convites: false, lembretes: true });
  });

  it("tudo ligado → pendente para os 3 tipos", () => {
    for (const kind of ["convite_mesa", "reativacao", "lembrete"] as const) expect(emailDecision({ ...base, kind })).toEqual({ status: "pendente" });
  });

  it("sem e-mail ou chave-mestra desligada → pulado", () => {
    expect(emailDecision({ ...base, kind: "convite_mesa", hasEmail: false })).toEqual({ status: "pulado", reason: "sem_email" });
    expect(emailDecision({ ...base, kind: "lembrete", optEmail: false })).toEqual({ status: "pulado", reason: "cliente_desligou" });
  });

  it("'Convites' do cliente cobre o da mesa e o de volta; 'Lembretes' só o lembrete", () => {
    const sem = { ...base, prefs: { convites: false, lembretes: true } };
    expect(emailDecision({ ...sem, kind: "convite_mesa" })).toEqual({ status: "pulado", reason: "cliente_desligou" });
    expect(emailDecision({ ...sem, kind: "reativacao" })).toEqual({ status: "pulado", reason: "cliente_desligou" });
    expect(emailDecision({ ...sem, kind: "lembrete" })).toEqual({ status: "pendente" });
  });

  it("o dono desliga por tipo → pulado com motivo 'dono_desligou'", () => {
    expect(emailDecision({ ...base, kind: "convite_mesa", owner: { ...owner, convite: false } })).toEqual({ status: "pulado", reason: "dono_desligou" });
    expect(emailDecision({ ...base, kind: "reativacao", owner: { ...owner, reativacao: false } })).toEqual({ status: "pulado", reason: "dono_desligou" });
    expect(emailDecision({ ...base, kind: "lembrete", owner: { ...owner, lembrete: false } })).toEqual({ status: "pulado", reason: "dono_desligou" });
  });
});
