import { describe, expect, it } from "vitest";
import { digestDue, planDue, reminderAt, reminderDue, scheduledAt } from "@/src/modules/agendador/domain/schedule";
import { instantSP } from "@/src/shared/tz";

// 23/11/2026 = segunda (semana 2026-W48). Padrão: segunda 08:30 (D196).
const SEG = { weekday: 1, minute: 510 };
const at = (day: string, hhmm: string) => instantSP(day, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)));

describe("agendamento do resumo e do plano (S6.1, D187, D196)", () => {
  it("T = dia e hora escolhidos, na semana ISO do dia (SP)", () => {
    expect(scheduledAt("2026-11-25", SEG)).toEqual({ at: at("2026-11-23", "08:30"), weekKey: "2026-W48" });
    // domingo = fim da semana ISO
    expect(scheduledAt("2026-11-23", { weekday: 0, minute: 1320 })).toEqual({ at: at("2026-11-29", "22:00"), weekKey: "2026-W48" });
  });

  it("resumo: de T até T + 24 h (recuperação); fora disso, nada", () => {
    expect(digestDue(at("2026-11-23", "08:29"), SEG)).toBeNull();
    expect(digestDue(at("2026-11-23", "08:30"), SEG)).toEqual({ at: at("2026-11-23", "08:30"), weekKey: "2026-W48" });
    expect(digestDue(at("2026-11-24", "08:29"), SEG)?.weekKey).toBe("2026-W48");
    expect(digestDue(at("2026-11-24", "08:30"), SEG)).toBeNull();
  });

  it("virada da semana: resumo de domingo 22h recuperado na segunda fica na semana do domingo", () => {
    const DOM = { weekday: 0, minute: 1320 };
    expect(digestDue(at("2026-11-30", "09:00"), DOM)).toEqual({ at: at("2026-11-29", "22:00"), weekKey: "2026-W48" });
  });

  it("plano: a partir de T − 30 min; segunda 06:00 gera às 05:30 da mesma semana", () => {
    expect(planDue(at("2026-11-23", "07:59"), SEG)).toBeNull();
    expect(planDue(at("2026-11-23", "08:00"), SEG)?.weekKey).toBe("2026-W48");
    const SEG6 = { weekday: 1, minute: 360 };
    expect(planDue(at("2026-11-23", "05:30"), SEG6)).toEqual({ at: at("2026-11-23", "06:00"), weekKey: "2026-W48" });
    // segunda 00:00: a geração começa no domingo 23:30 da semana anterior, mas é da semana de T
    expect(planDue(at("2026-11-22", "23:30"), { weekday: 1, minute: 0 })?.weekKey).toBe("2026-W48");
    expect(planDue(at("2026-11-24", "08:30"), SEG)).toBeNull();
  });
});

describe("lembrete ao cliente: X h antes da janela, nunca antes das 07h nem depois do início (D189)", () => {
  it("janela 15h com 3 h → 12:00; com 6 h → 09:00; com 24 h → 07:00 do mesmo dia", () => {
    const start = at("2026-11-24", "15:00");
    expect(reminderAt(start, 3)).toEqual(at("2026-11-24", "12:00"));
    expect(reminderAt(start, 6)).toEqual(at("2026-11-24", "09:00"));
    expect(reminderAt(start, 24)).toEqual(at("2026-11-24", "07:00"));
  });

  it("janela 08h com 3 h → 07:00; janela às 07h ou antes → sem lembrete", () => {
    expect(reminderAt(at("2026-11-24", "08:00"), 3)).toEqual(at("2026-11-24", "07:00"));
    expect(reminderAt(at("2026-11-24", "07:00"), 3)).toBeNull();
    expect(reminderAt(at("2026-11-24", "06:00"), 3)).toBeNull();
  });

  it("devido entre o horário do lembrete e o início; depois do início, não sai", () => {
    const start = at("2026-11-24", "15:00");
    expect(reminderDue(at("2026-11-24", "11:59"), start, 3)).toBe(false);
    expect(reminderDue(at("2026-11-24", "12:00"), start, 3)).toBe(true);
    expect(reminderDue(at("2026-11-24", "14:59"), start, 3)).toBe(true);
    expect(reminderDue(at("2026-11-24", "15:00"), start, 3)).toBe(false);
  });
});
