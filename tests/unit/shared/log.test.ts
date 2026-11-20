import { describe, expect, it } from "vitest";
import { formatLog } from "@/src/shared/log";

describe("log estruturado (lista de campos permitidos)", () => {
  it("só os campos da lista entram; PII e campos desconhecidos são descartados", () => {
    const line = JSON.parse(formatLog("error", "falha no envio", { area: "login", err: "TypeError", email: "ana@exemplo.com", phone: "(00) 91234-5678", name: "Ana", body: { x: 1 } }, new Date("2026-11-23T20:00:00Z")));
    expect(line).toEqual({ at: "2026-11-23T20:00:00.000Z", level: "error", msg: "falha no envio", area: "login", err: "TypeError" });
  });
  it("corta textos longos e converte objetos inesperados em texto curto", () => {
    const line = JSON.parse(formatLog("info", "x".repeat(500), { reason: "y".repeat(500), count: 3 }));
    expect(line.msg).toHaveLength(200);
    expect(line.reason).toHaveLength(200);
    expect(line.count).toBe(3);
  });
});
