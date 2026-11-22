import { describe, expect, it } from "vitest";
import { gpsSheet, inviteSentence, inviteValidity } from "@/src/ui/cliente/textos";
import type { InviteView } from "@/src/modules/salao/application/views";

const offer = { title: "Doce grátis", subtitle: "Convite", itemName: "Cannoli", gain: "Cannoli grátis", category: "sobremesa" };
const inv = (o: Partial<InviteView>): InviteView => ({ state: "novo", days: [2, 3, 4], startMin: 900, endMin: 1080, untilDay: "2026-12-07", offer, message: null, ...o });

describe("textos do convite ao cliente (S9)", () => {
  it("convite que nasceu hoje não vale hoje: a validade diz o 1º dia (ou 'a partir de amanhã')", () => {
    expect(inviteValidity(inv({ state: "novo", firstDay: "2026-11-25" }))).toBe("Vale de 25/11 até 07/12");
    expect(inviteValidity(inv({ state: "novo" }))).toBe("Vale a partir de amanhã, até 07/12");
    expect(inviteValidity(inv({ state: "lembrete", firstDay: "2026-11-26" }))).toBe("Vale até 07/12");
  });
  it("frase: 'Volte…' para depois; no dia em que vale, manda mostrar o código", () => {
    expect(inviteSentence(inv({ state: "novo" }))).toBe("Volte Ter, Qua, Qui · 15h–18h e ganhe Cannoli grátis");
    expect(inviteSentence(inv({ state: "usar_hoje" }))).toBe("Mostre o código do convite ao garçom e ganhe Cannoli grátis");
  });
  it("GPS: longe × sem localização, sem exclamação", () => {
    const longe = gpsSheet("longe");
    const sem = gpsSheet("negado");
    expect(longe.title).toBe("Você está no restaurante?");
    expect(sem.title).toBe("Não conseguimos ver sua localização");
    expect(gpsSheet("tempo_esgotado")).toEqual(sem);
    expect(gpsSheet("sem_suporte")).toEqual(sem);
    for (const t of [longe.title, longe.body, sem.title, sem.body]) expect(t).not.toContain("!");
  });
});
