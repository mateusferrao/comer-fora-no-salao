import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import { weeklyInviteCost } from "@/src/ui/portal/wizard/weekly-cost";

const menu: MenuItem[] = [
  { id: "panna", category: "sobremesa", name: "Panna cotta", priceCents: 1800 },
  { id: "fritto", category: "porcao", name: "Fritto misto", priceCents: 4800 },
];

describe("custo dos convites da semana (passo 5 da ativação)", () => {
  it("sem margem: soma teto × preço do item, e o valor é máximo", () => {
    const r = weeklyInviteCost(
      [
        { offer: { kind: "doce_gratis", params: { itemId: "panna" } }, weeklyCap: 10 },
        { offer: { kind: "entrada_gratis", params: { itemId: "fritto" } }, weeklyCap: 2 },
      ],
      menu,
    );
    expect(r).toEqual({ cents: 10 * 1800 + 2 * 4800, isMax: true });
  });
  it("com margem ou desconto, o valor é estimado", () => {
    expect(weeklyInviteCost([{ offer: { kind: "doce_gratis", params: { itemId: "panna" } }, weeklyCap: 10 }], menu, 60)).toEqual({ cents: 10 * 720, isMax: false });
    expect(weeklyInviteCost([{ offer: { kind: "desconto", params: { itemId: "fritto", pct: 10 } }, weeklyCap: 5 }], menu)).toEqual({ cents: 5 * 480, isMax: false });
  });
});
