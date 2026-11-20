import { describe, expect, it } from "vitest";
import { checkCode, CODE_ALPHABET, generateCode, isCodeFormat, normalizeCode } from "@/src/modules/beneficios/domain/codes";
import { mulberry32 } from "@/src/shared/rng";

describe("códigos", () => {
  it("alfabeto sem ambíguos (sem I, L, O, 0, 1) e com 31 símbolos", () => {
    expect(CODE_ALPHABET).toBe("ABCDEFGHJKMNPQRSTUVWXYZ23456789");
    expect(CODE_ALPHABET).toHaveLength(31);
  });
  it("10.000 códigos de 6 caracteres sem caractere ambíguo", () => {
    const rng = mulberry32(7);
    const randInt = (n: number) => Math.floor(rng() * n);
    for (let i = 0; i < 10_000; i++) {
      const c = generateCode(randInt);
      expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
    }
  });
  it("normaliza a digitação", () => {
    expect(normalizeCode(" ab-c 2d3 ")).toBe("ABC2D3");
    expect(isCodeFormat("ABC2D3")).toBe(true);
    expect(isCodeFormat("ABC1D3")).toBe(false);
    expect(isCodeFormat("ABC2D")).toBe(false);
  });
  it("os 5 resultados", () => {
    const now = new Date("2026-11-23T20:10:00Z"); // 23/11 em SP
    const base = { restaurantId: "r1", status: "emitido" as const, validDay: "2026-11-23" };
    expect(checkCode(null, { restaurantId: "r1", now })).toBe("INVALIDO");
    expect(checkCode({ ...base, restaurantId: "r2" }, { restaurantId: "r1", now })).toBe("OUTRO_RESTAURANTE");
    expect(checkCode({ ...base, status: "validado" }, { restaurantId: "r1", now })).toBe("JA_USADO");
    expect(checkCode({ ...base, validDay: "2026-11-22" }, { restaurantId: "r1", now })).toBe("EXPIRADO");
    expect(checkCode({ ...base, status: "validado", validDay: "2026-11-22" }, { restaurantId: "r1", now })).toBe("JA_USADO");
    expect(checkCode(base, { restaurantId: "r1", now })).toBe("OK");
  });
  it("depois da meia-noite em SP o código de ontem expira", () => {
    const base = { restaurantId: "r1", status: "emitido" as const, validDay: "2026-11-23" };
    expect(checkCode(base, { restaurantId: "r1", now: new Date("2026-11-24T02:59:59Z") })).toBe("OK");
    expect(checkCode(base, { restaurantId: "r1", now: new Date("2026-11-24T03:00:00Z") })).toBe("EXPIRADO");
  });
});
