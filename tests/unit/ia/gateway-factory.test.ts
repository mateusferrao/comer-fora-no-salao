import { describe, expect, it } from "vitest";
import { cleanApiKey, gatewayFor, keyKindFor, keyState } from "@/src/modules/ia/gateway-factory";

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

describe("contas E2E (S9): a fumaça de produção não gasta a chave pública", () => {
  const env = { OPENROUTER_KEY_PUBLIC: "sk-pub", OPENROUTER_KEY_DEMO: "sk-demo" } as unknown as NodeJS.ProcessEnv;
  it("conta via 'e2e' → modo sem IA, mesmo com as chaves no ambiente", async () => {
    expect(keyKindFor({ emailHmac: "x", via: "e2e" }, env)).toBe("e2e");
    expect(await gatewayFor({} as never, "e2e", new Date(), env)).toEqual({ gateway: null, keyKind: "e2e", reason: "sem_chave" });
  });
  it("com a flag explícita E2E_COM_IA=1, a conta E2E volta a usar a chave pública", () => {
    expect(keyKindFor({ emailHmac: "x", via: "e2e" }, { ...env, E2E_COM_IA: "1" })).toBe("publica");
  });
});
