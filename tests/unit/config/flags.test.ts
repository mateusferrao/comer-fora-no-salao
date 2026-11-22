import { describe, expect, it } from "vitest";
import { FLAG_DEFAULTS, FLAGS } from "@/src/modules/config/domain/flags";

describe("padrões das flags (S9, revisão de requisitos A3)", () => {
  it("o que já foi entregue e está ligado em produção vem ligado no código; só o agendador nasce desligado", () => {
    const off = FLAGS.filter((f) => !FLAG_DEFAULTS[f]);
    expect(off).toEqual(["agendador"]);
  });
});
