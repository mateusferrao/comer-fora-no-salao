import { describe, expect, it } from "vitest";
import {
  formatDays,
  formatDaysLong,
  formatHours,
  isInSlot,
  isOpen,
  openingStatus,
  sortByPriority,
  turnOf,
  validateSlot,
  type OpeningHours,
  type Slot,
} from "@/src/modules/beneficios/domain/slots";

const ABERTO_11_2330: OpeningHours = [{ days: [0, 1, 2, 3, 4, 5, 6], startMin: 660, endMin: 1410 }];
const faixaA: Slot = { id: "A", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 55 };
const faixaB: Slot = { id: "B", days: [1, 2, 3], startMin: 1260, endMin: 1380, intensity: "um_pouco", extraTables: 35 };
const seg2311_1710 = new Date("2026-11-23T20:10:00Z");

describe("faixas e turnos", () => {
  it("23/11/2026 17h10 SP: segunda, turno tarde, fora da faixa A (Ter–Qui)", () => {
    expect(turnOf(seg2311_1710)).toBe("tarde");
    expect(isInSlot(faixaA, seg2311_1710)).toBe(false);
    expect(isInSlot(faixaA, new Date("2026-11-24T20:10:00Z"))).toBe(true); // terça 17h10
    expect(isInSlot(faixaA, new Date("2026-11-24T21:00:00Z"))).toBe(false); // terça 18h00 (fim exclusivo)
  });
  it("tabela de turnos", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 10, 23, h + 3, 0));
    expect([0, 5, 6, 10, 11, 14, 15, 17, 18, 23].map((h) => turnOf(at(h)))).toEqual([
      "madrugada", "madrugada", "manha", "manha", "almoco", "almoco", "tarde", "tarde", "noite", "noite",
    ]);
  });
  it("faixa fora do horário de funcionamento é rejeitada", () => {
    expect(validateSlot(faixaA, ABERTO_11_2330)).toEqual([]);
    expect(validateSlot({ ...faixaA, startMin: 600 }, ABERTO_11_2330)).toEqual(["fora_do_funcionamento"]);
    expect(validateSlot({ ...faixaA, days: [] }, ABERTO_11_2330)).toEqual(["dias_vazios"]);
    expect(validateSlot({ ...faixaA, startMin: 1080, endMin: 900 }, ABERTO_11_2330)).toEqual(["horario_invalido"]);
    const fechadoSeg: OpeningHours = [{ days: [0, 2, 3, 4, 5, 6], startMin: 660, endMin: 1410 }];
    expect(validateSlot(faixaB, fechadoSeg)).toEqual(["fora_do_funcionamento"]);
  });
  it("prioridade: muito antes de um_pouco, empate pela ordem", () => {
    const c: Slot = { ...faixaB, id: "C", intensity: "muito" };
    expect(sortByPriority([faixaB, faixaA, c]).map((s) => s.id)).toEqual(["A", "C", "B"]);
  });
  it("3 níveis (ajuste de 21/11): muito, mais ou menos, pouco", () => {
    const m: Slot = { ...faixaB, id: "M", intensity: "medio" };
    expect(sortByPriority([faixaB, m, faixaA]).map((s) => s.id)).toEqual(["A", "M", "B"]);
  });
  it("rótulos", () => {
    expect(formatDays([2, 3, 4])).toBe("Ter, Qua, Qui");
    expect(formatDaysLong([2, 3, 4])).toBe("terça, quarta e quinta");
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe("Todos os dias");
    expect(formatHours(900, 1080)).toBe("15h–18h");
    expect(formatHours(1290, 1440)).toBe("21h30–24h");
  });
  it("aberto/fechado informativo", () => {
    expect(isOpen(ABERTO_11_2330, seg2311_1710)).toBe(true);
    expect(openingStatus(ABERTO_11_2330, seg2311_1710)).toEqual({ open: true, label: "Aberto agora • Fecha às 23:30" });
    expect(openingStatus(ABERTO_11_2330, new Date("2026-11-23T12:00:00Z"))).toEqual({ open: false, label: "Loja fechada • Abre seg às 11:00" });
    expect(openingStatus(ABERTO_11_2330, new Date("2026-11-24T02:45:00Z"))).toEqual({ open: false, label: "Loja fechada • Abre ter às 11:00" });
  });
});
