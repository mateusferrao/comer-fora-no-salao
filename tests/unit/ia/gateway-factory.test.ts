import { describe, expect, it } from "vitest";
import { cleanApiKey, keyKindFor, keyState } from "@/src/modules/ia/gateway-factory";

describe("chave do OpenRouter lida do ambiente", () => {
  it("tira espaços e aspas retas ou curvas em volta", () => {
    expect(cleanApiKey("sk-or-v1-abc")).toBe("sk-or-v1-abc");
    expect(cleanApiKey("  sk-or-v1-abc\n")).toBe("sk-or-v1-abc");
    expect(cleanApiKey('"sk-or-v1-abc"')).toBe("sk-or-v1-abc");
    expect(cleanApiKey("“sk-or-v1-abc”")).toBe("sk-or-v1-abc");
    expect(cleanApiKey("'sk-or-v1-abc'")).toBe("sk-or-v1-abc");
  });
  it("sem chave ou com caractere fora do ASCII no meio → ausente (modo sem IA)", () => {
    expect(cleanApiKey(undefined)).toBe("");
    expect(cleanApiKey("")).toBe("");
    expect(cleanApiKey("sk-or–v1")).toBe("");
    expect(cleanApiKey("sk or v1")).toBe("");
  });
  it("estado para o health, sem o valor", () => {
    expect(keyState("sk-or-v1-abc")).toBe("ok");
    expect(keyState("“sk-or-v1-abc”")).toBe("ajustada");
    expect(keyState(undefined)).toBe("ausente");
  });
});

describe("qual chave usar", () => {
  it("conta do link do avaliador usa a de demo; e-mail comum, a pública", () => {
    expect(keyKindFor({ emailHmac: null, via: "link" }, {} as NodeJS.ProcessEnv)).toBe("demo");
    expect(keyKindFor({ emailHmac: "x", via: "email" }, {} as NodeJS.ProcessEnv)).toBe("publica");
  });
});
