import { describe, expect, it } from "vitest";
import { fakeCopilotEnabled, LOCAL_E2E_TOKEN } from "@/src/modules/agente/adapters/fake-copilot-gateway";

describe("IA falsa do copiloto só no E2E local (revisão técnica I8)", () => {
  const ok = { COPILOT_FAKE_AI: "1", OPENROUTER_KEY_PUBLIC: "", OPENROUTER_KEY_DEMO: "", E2E_LOGIN_TOKEN: LOCAL_E2E_TOKEN };
  it("liga com as 3 condições", () => expect(fakeCopilotEnabled(ok)).toBe(true));
  it("não liga com chave de IA, token de produção ou sem a variável", () => {
    expect(fakeCopilotEnabled({ ...ok, OPENROUTER_KEY_PUBLIC: "sk-x" })).toBe(false);
    expect(fakeCopilotEnabled({ ...ok, OPENROUTER_KEY_DEMO: "sk-x" })).toBe(false);
    expect(fakeCopilotEnabled({ ...ok, E2E_LOGIN_TOKEN: "token-de-producao" })).toBe(false);
    expect(fakeCopilotEnabled({ ...ok, COPILOT_FAKE_AI: undefined })).toBe(false);
  });
});
