import { describe, expect, it } from "vitest";
import { assignArm, decideInvite, type InviteState } from "@/src/modules/salao/domain/experiment";
import type { Slot } from "@/src/modules/beneficios/domain/slots";

const A: Slot = { id: "A", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 55 };
const B: Slot = { id: "B", days: [1, 2, 3], startMin: 1260, endMin: 1380, intensity: "um_pouco", extraTables: 35 };
const at = new Date("2026-11-23T20:10:00Z"); // seg 23/11 17h10 SP

function state(p: Partial<InviteState> = {}): InviteState {
  return {
    customerId: "c1",
    restaurantId: "r1",
    ruleActive: true,
    hasActiveInvite: false,
    slots: [B, A],
    remaining: { A: 10, B: 10 },
    arm: "convidavel",
    ...p,
  };
}

describe("sorteio do grupo", () => {
  it("1.000 clientes → 7–13% holdout, estável entre execuções", () => {
    let holdout = 0;
    for (let i = 0; i < 1000; i++) if (assignArm(`cliente-${i}`, "r1") === "holdout") holdout++;
    expect(holdout).toBeGreaterThanOrEqual(70);
    expect(holdout).toBeLessThanOrEqual(130);
    expect(assignArm("cliente-7", "r1")).toBe(assignArm("cliente-7", "r1"));
  });
});

describe("decideInvite", () => {
  it("ordem: sem plano → já tem ativo → teto esgotado", () => {
    expect(decideInvite(state({ ruleActive: false, hasActiveInvite: true }), at)).toEqual({ kind: "sem_plano" });
    expect(decideInvite(state({ hasActiveInvite: true, remaining: { A: 0, B: 0 } }), at)).toEqual({ kind: "ja_tem_ativo" });
    expect(decideInvite(state({ remaining: { A: 0, B: 0 } }), at)).toEqual({ kind: "teto_esgotado" });
  });
  it("convidável → convite real na faixa de maior prioridade com vaga, válido 30 dias até 23:59:59 SP", () => {
    const d = decideInvite(state(), at);
    expect(d).toMatchObject({ kind: "real", slotId: "A", arm: "convidavel", armIsNew: false });
    if (d.kind !== "real") throw new Error();
    expect(d.expiresAt.toISOString()).toBe("2026-12-24T02:59:59.999Z"); // 23/12 23:59:59.999 SP
    expect(decideInvite(state({ remaining: { A: 0, B: 3 } }), at)).toMatchObject({ kind: "real", slotId: "B" });
  });
  it("holdout → fantasma na mesma faixa (não consome teto)", () => {
    expect(decideInvite(state({ arm: "holdout" }), at)).toMatchObject({ kind: "fantasma", slotId: "A", arm: "holdout" });
  });
  it("sem grupo ainda: sorteia pelo hash e marca como novo", () => {
    const d = decideInvite(state({ arm: null }), at);
    expect(d.kind === "real" || d.kind === "fantasma").toBe(true);
    if (d.kind === "real" || d.kind === "fantasma") {
      expect(d.armIsNew).toBe(true);
      expect(d.arm).toBe(assignArm("c1", "r1"));
    }
  });
  it("sem elegibilidade, o grupo não é sorteado", () => {
    expect(decideInvite(state({ arm: null, remaining: { A: 0, B: 0 } }), at)).toEqual({ kind: "teto_esgotado" });
  });
});
