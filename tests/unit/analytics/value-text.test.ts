import { describe, expect, it } from "vitest";
import { crossZeroMoneyText, showSwapOffer, SWAP_OFFER_CTA } from "@/src/modules/analytics/domain/value-text";
import type { Topline } from "@/src/modules/analytics/domain/value";

const causal = (kind: "causal_positivo" | "causal_negativo" | "causal_cruza_zero", visitas: "positivo" | "negativo"): Topline => ({ kind, visitas, cents: 1, lo: -1, hi: 2, nT: 100 });

describe("textos do topo em R$ (S9, revisão de produto)", () => {
  it("cruza zero: diz que ainda pode ser acaso, com o intervalo e o custo dos convites descontado", () => {
    const t = crossZeroMoneyText("-R$ 50", "R$ 650");
    expect(t).toBe("Em reais, ainda pode ser acaso: o resultado fica entre -R$ 50 e R$ 650, já descontado o custo dos convites.");
    expect(t).not.toMatch(/garantir|lucro/);
  });

  it("botão de trocar a oferta: no negativo e no cruza zero com visitas a menos", () => {
    expect(showSwapOffer(causal("causal_negativo", "positivo"))).toBe(true);
    expect(showSwapOffer(causal("causal_cruza_zero", "negativo"))).toBe(true);
    expect(showSwapOffer(causal("causal_cruza_zero", "positivo"))).toBe(false);
    expect(showSwapOffer(causal("causal_positivo", "positivo"))).toBe(false);
    expect(SWAP_OFFER_CTA).toBe("Trocar a oferta no plano da semana");
  });
});
