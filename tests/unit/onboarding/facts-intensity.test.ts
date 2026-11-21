import { describe, expect, it } from "vitest";
import { declaredFacts } from "@/src/modules/onboarding/domain/facts";
import type { Slot } from "@/src/modules/beneficios/domain/slots";

const slot = (id: string, intensity: Slot["intensity"], startMin: number): Slot => ({ id, days: [1], startMin, endMin: startMin + 120, intensity, extraTables: 2 });

describe("declaredFacts: intensidade nos 3 níveis (D240)", () => {
  it("muito, mais ou menos e pouco vazia, concordando com 'a faixa'", () => {
    const f = declaredFacts({}, [slot("a", "muito", 900), slot("b", "medio", 1140), slot("c", "um_pouco", 1260)], []);
    const vals = Object.entries(f).filter(([k]) => k.endsWith("_intensidade")).map(([, v]) => v);
    expect(vals.sort()).toEqual(["mais ou menos vazia", "muito vazia", "pouco vazia"]);
  });
});
