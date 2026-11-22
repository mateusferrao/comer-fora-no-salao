import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/src/db/client";
import { setFlag } from "@/src/modules/config/application/app-config";
import { POST as turn } from "@/app/api/parceiro/copiloto/route";
import { POST as decide } from "@/app/api/parceiro/copiloto/proposta/route";
import { POST as salon } from "@/app/api/parceiro/copiloto/salao/route";
import { resetDb } from "./helpers/db";

const req = (body: unknown, headers: Record<string, string> = {}) => new Request("http://localhost/api/parceiro/copiloto", { method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers }, body: JSON.stringify(body) });

describe("rotas do copiloto (revisão S8)", () => {
  beforeAll(resetDb, 60_000);
  afterAll(closeDb);

  it("flag desligada → 404 nas 3 rotas; outro site → 403", async () => {
    await setFlag(getDb(), "copiloto", false);
    expect((await turn(req({ turns: [{ role: "user", text: "oi" }], page: "painel" }))).status).toBe(404);
    expect((await decide(req({ id: crypto.randomUUID(), acao: "aplicar" }))).status).toBe(404);
    expect((await salon(req({ texto: "doze mesas, abro às onze" }))).status).toBe(404);
    expect((await turn(req({}, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });
});
