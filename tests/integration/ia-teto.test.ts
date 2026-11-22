import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/src/db/client";
import { aiCalls } from "@/src/db/schema";
import { PUBLIC_DAILY_CAP_USD } from "@/src/modules/ia/ai-calls";
import { dailyCapOff, gatewayFor } from "@/src/modules/ia/gateway-factory";
import { resetDb } from "./helpers/db";

const NOW = new Date("2026-11-21T18:00:00Z");
const env = (extra: Record<string, string> = {}) => ({ OPENROUTER_KEY_PUBLIC: "sk-or-teste-ficticia", OPENROUTER_KEY_DEMO: "sk-or-demo-ficticia", ...extra }) as unknown as NodeJS.ProcessEnv;

describe("teto diário da chave pública (D85) e IA_SEM_TETO_DIARIO (D254)", () => {
  beforeEach(async () => {
    await resetDb();
    await getDb().insert(aiCalls).values({ task: "plano", promptVersion: "t", status: "ok", attempts: [], keyKind: "publica", costUsd: String(PUBLIC_DAILY_CAP_USD + 0.01), at: NOW });
  });
  afterAll(closeDb);

  it("teto atingido → sem IA; com a variável ligada → IA; valor inválido mantém o teto", async () => {
    expect(await gatewayFor(getDb(), "publica", NOW, env())).toMatchObject({ gateway: null, reason: "teto_diario" });
    for (const on of ["1", "true", "SIM", " sim "]) {
      const g = await gatewayFor(getDb(), "publica", NOW, env({ IA_SEM_TETO_DIARIO: on }));
      expect(g.gateway).not.toBeNull();
      expect(g.reason).toBeUndefined();
    }
    for (const off of ["0", "nao", "false", ""]) {
      expect(dailyCapOff(env({ IA_SEM_TETO_DIARIO: off }))).toBe(false);
      expect(await gatewayFor(getDb(), "publica", NOW, env({ IA_SEM_TETO_DIARIO: off }))).toMatchObject({ gateway: null, reason: "teto_diario" });
    }
  });
});
