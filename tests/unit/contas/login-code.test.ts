import { describe, expect, it } from "vitest";
import {
  E2E_EMAIL_RE,
  generateLoginCode,
  isLoginCodeFormat,
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_TTL_MIN,
  loginCodeState,
  maskEmail,
  normalizeEmail,
  parseEmail,
} from "@/src/modules/contas/domain/login-code";

describe("e-mail do dono", () => {
  it("normaliza (minúsculas, sem espaços nas pontas)", () => {
    expect(normalizeEmail("  Maria.Silva@Exemplo.COM ")).toBe("maria.silva@exemplo.com");
  });
  it("aceita só formato de e-mail", () => {
    expect(parseEmail("dono@restaurante.com.br")).toBe("dono@restaurante.com.br");
    expect(parseEmail("sem-arroba")).toBeNull();
    expect(parseEmail("a@b")).toBeNull();
    expect(parseEmail("")).toBeNull();
    expect(parseEmail("x".repeat(250) + "@a.com")).toBeNull();
  });
  it("mascara para a dica: primeira letra do usuário e do domínio + TLD", () => {
    expect(maskEmail("maria@dominio.com")).toBe("m•••@d•••.com");
    expect(maskEmail("a@exemplo.com.br")).toBe("a•••@e•••.com.br");
  });
  it("e-mails de teste do E2E: e2e-dono+N@exemplo.invalid", () => {
    expect(E2E_EMAIL_RE.test("e2e-dono+1@exemplo.invalid")).toBe(true);
    expect(E2E_EMAIL_RE.test("e2e-dono+12@exemplo.invalid")).toBe(true);
    expect(E2E_EMAIL_RE.test("e2e-dono@exemplo.invalid")).toBe(false);
    expect(E2E_EMAIL_RE.test("e2e-dono+1@gmail.com")).toBe(false);
  });
});

describe("código de login", () => {
  it("6 dígitos a partir do sorteio", () => {
    const seq = [1, 2, 3, 4, 5, 6];
    let i = 0;
    expect(generateLoginCode(() => seq[i++]!)).toBe("123456");
    expect(isLoginCodeFormat("123456")).toBe(true);
    expect(isLoginCodeFormat("12345")).toBe(false);
    expect(isLoginCodeFormat("12a456")).toBe(false);
  });
  it("vale 10 min e até 5 tentativas", () => {
    expect(LOGIN_CODE_TTL_MIN).toBe(10);
    expect(LOGIN_CODE_MAX_ATTEMPTS).toBe(5);
    const now = new Date("2026-11-21T12:00:00Z");
    const base = { expiresAt: new Date("2026-11-21T12:05:00Z"), attempts: 0, usedAt: null };
    expect(loginCodeState(base, now)).toBe("valido");
    expect(loginCodeState({ ...base, expiresAt: new Date("2026-11-21T11:59:59Z") }, now)).toBe("expirado");
    expect(loginCodeState({ ...base, attempts: 5 }, now)).toBe("bloqueado");
    expect(loginCodeState({ ...base, usedAt: now }, now)).toBe("usado");
    expect(loginCodeState(null, now)).toBe("ausente");
  });
});
