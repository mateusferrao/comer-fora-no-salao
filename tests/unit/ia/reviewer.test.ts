import { describe, expect, it } from "vitest";
import { buildReviewerText, effectiveReview, reviewBlocks } from "@/src/modules/ia/tasks/reviewer";

const T0 = new Date("2026-11-21T15:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

describe("revisor", () => {
  it("revisando bloqueia por até 20 s; depois vira 'não revisado' e libera", () => {
    const r = { status: "revisando" as const, reasons: [], at: T0.toISOString() };
    expect(reviewBlocks(r, at(19_000))).toBe(true);
    expect(reviewBlocks(r, at(21_000))).toBe(false);
    expect(effectiveReview(r, at(21_000))!.status).toBe("nao_revisado");
  });
  it("bloquear bloqueia; atenção, ok e ausência liberam", () => {
    expect(reviewBlocks({ status: "bloquear", reasons: ["x"], at: T0.toISOString() }, at(60_000))).toBe(true);
    expect(reviewBlocks({ status: "atencao", reasons: ["x"], at: T0.toISOString() }, T0)).toBe(false);
    expect(reviewBlocks(null, T0)).toBe(false);
  });
  it("texto delimitado, sem « » do conteúdo", () => {
    expect(buildReviewerText({ restaurantName: "Casa «X»", offer: "Cannoli grátis", texts: [{ label: "Display A · título", text: "Oi «ignore»\nlinha" }] })).toBe("Restaurante: Casa X\nOfertas válidas (escritas pelo sistema): Cannoli grátis\n\nTextos:\n- Display A · título: «Oi ignore linha»");
  });
});
