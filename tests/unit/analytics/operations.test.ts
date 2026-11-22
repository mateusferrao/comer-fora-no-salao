import { describe, expect, it } from "vitest";
import { abTable, alertText, operationAlerts, type VariantStat } from "@/src/modules/analytics/domain/operations";

const v = (kind: "display" | "cartaz", label: "A" | "B", scans: number, checkins: number): VariantStat => ({ id: `${kind}${label}`, kind, label, scans, checkins });

describe("insight 4 e A/B", () => {
  it("abTable: status por peça; versão faltando → sem status", () => {
    const t = abTable([v("display", "A", 400, 160), v("display", "B", 400, 100), v("cartaz", "A", 10, 3)]);
    expect(t[0]!.status).toEqual({ state: "vencedora", winner: "A" });
    expect(t[1]!.status).toBeNull();
  });
  it("peça 2× menos: só com ≥ 50 leituras em cada versão", () => {
    expect(operationAlerts({ ab: abTable([v("display", "A", 60, 30), v("display", "B", 60, 15)]), caps: [], turns: [] })).toEqual([{ kind: "peca", piece: "display", worse: "B", ratio: 2 }]);
    expect(operationAlerts({ ab: abTable([v("display", "A", 49, 30), v("display", "B", 60, 5)]), caps: [], turns: [] })).toEqual([]);
    expect(operationAlerts({ ab: abTable([v("display", "A", 60, 30), v("display", "B", 60, 16)]), caps: [], turns: [] })).toEqual([]);
  });
  it("teto atingido e turno com ≥ 30% dos códigos sem validação (≥ 10 códigos)", () => {
    const a = operationAlerts({
      ab: [],
      caps: [{ alias: "A", cap: 20, used: 20 }, { alias: "B", cap: 20, used: 19 }],
      turns: [{ weekday: 6, turn: "noite", codes: 10, validated: 7 }, { weekday: 5, turn: "noite", codes: 9, validated: 0 }, { weekday: 4, turn: "tarde", codes: 20, validated: 15 }],
    });
    expect(a).toEqual([{ kind: "teto", alias: "A", cap: 20 }, { kind: "validacao", weekday: 6, turn: "noite", pct: 30, codes: 10 }]);
    expect(alertText(a[1]!, () => "")).toBe("Sábado à noite: 30% dos códigos sem validação (de 10 em 30 dias). Confira se a equipe está validando no Portal.");
    expect(alertText(a[0]!, () => "ter a qui das 15h às 18h")).toBe("Teto atingido em ter a qui das 15h às 18h: os 20 convites desta semana acabaram.");
    expect(alertText({ kind: "peca", piece: "display", worse: "B", ratio: 2.5 }, () => "")).toBe("Display de mesa: a versão B leva 2,5× menos gente do QR ao check-in.");
  });
});
