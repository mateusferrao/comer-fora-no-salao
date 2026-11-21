import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/src/db/client";
import { aiCalls } from "@/src/db/schema";
import { setFlag } from "@/src/modules/config/application/app-config";
import { PUBLIC_DAILY_CAP_USD } from "@/src/modules/ia/ai-calls";
import { gatewayFor } from "@/src/modules/ia/gateway-factory";
import { resetDb } from "./helpers/db";

const NOW = new Date("2026-11-21T18:00:00Z");
const env = { OPENROUTER_KEY_PUBLIC: "sk-or-teste-ficticia", OPENROUTER_KEY_DEMO: "sk-or-demo-ficticia" } as NodeJS.ProcessEnv;

describe("teto diário da chave pública (D85) e a flag ia_sem_teto (D252)", () => {
  beforeEach(async () => {
    await resetDb();
    await getDb().insert(aiCalls).values({ task: "plano", promptVersion: "t", status: "ok", attempts: [], keyKind: "publica", costUsd: String(PUBLIC_DAILY_CAP_USD + 0.01), at: NOW });
  });
  afterAll(closeDb);

  it("teto atingido → sem IA; com a flag ligada → IA de novo; desligada → teto volta", async () => {
    expect(await gatewayFor(getDb(), "publica", NOW, env)).toMatchObject({ gateway: null, reason: "teto_diario" });
    await setFlag(getDb(), "ia_sem_teto", true);
    const on = await gatewayFor(getDb(), "publica", NOW, env);
    expect(on.gateway).not.toBeNull();
    expect(on.reason).toBeUndefined();
    await setFlag(getDb(), "ia_sem_teto", false);
    expect(await gatewayFor(getDb(), "publica", NOW, env)).toMatchObject({ gateway: null, reason: "teto_diario" });
  });
});
