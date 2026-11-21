import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { weeklyPlans } from "@/src/db/schema";
import { seedAll } from "@/src/db/seed";
import { vitrineHistory } from "@/src/db/seed/history";
import { VITRINE_ID } from "@/src/db/seed/vitrine";
import { setFlag } from "@/src/modules/config/application/app-config";
import { createToken, resolveToken, revokeTokens } from "@/src/modules/mcp/tokens";
import { fixedClock } from "@/src/shared/clock";
import { POST } from "@/app/api/mcp/route";
import { handleRpc } from "@/src/modules/mcp/server";
import { resetDb } from "./helpers/db";
import type { AiGateway } from "@/src/modules/ia/gateway";

const NOW = new Date();
const URL_MCP = "http://localhost:3000/api/mcp";
const rpc = (token: string | null, body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request(URL_MCP, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(body) }));
const call = async (token: string, name: string, args: Record<string, unknown> = {}, id = 1) => {
  const r = await rpc(token, { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
  const j = (await r.json()) as { result: { structuredContent: Record<string, unknown>; isError: boolean } };
  return j.result;
};

describe("MCP (flag; D219)", () => {
  beforeAll(async () => {
    await resetDb();
    await seedAll(getDb(), fixedClock(NOW.toISOString()), vitrineHistory);
  }, 120_000);
  afterAll(closeDb);

  it("flag desligada → 404; sem token → 401; Origin de outro site com token → 200 (D248); token revogado → 401", async () => {
    const { token } = await createToken(getDb(), VITRINE_ID, NOW);
    await setFlag(getDb(), "mcp", false);
    expect((await rpc(token, { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(404);
    await setFlag(getDb(), "mcp", true);
    expect((await rpc(null, { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(401);
    expect((await rpc("cfs_" + "x".repeat(43), { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(401);
    // D248: o conector do Claude (e de outros assistentes) chama de outra origem; quem protege é o token.
    expect((await rpc(token, { jsonrpc: "2.0", id: 1, method: "ping" }, { origin: "https://claude.ai" })).status).toBe(200);
    expect((await rpc(null, { jsonrpc: "2.0", id: 1, method: "ping" }, { origin: "https://malicioso.example" })).status).toBe(401);
    // Valor do cabeçalho colado só com o token (sem "Bearer ") também vale.
    expect((await rpc(null, { jsonrpc: "2.0", id: 1, method: "ping" }, { authorization: token })).status).toBe(200);
    expect((await rpc(token, { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(200);
    // Notificação → 202 sem corpo; lote → 400.
    expect((await rpc(token, { jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
    expect((await rpc(token, [{ jsonrpc: "2.0", id: 1, method: "ping" }])).status).toBe(400);
    await revokeTokens(getDb(), VITRINE_ID, NOW);
    expect(await resolveToken(getDb(), token)).toBeNull();
    expect((await rpc(token, { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(401);
  });

  it("initialize, tools/list e o ciclo ler → gerar → ver → aprovar (via agente)", async () => {
    await setFlag(getDb(), "mcp", true);
    const { token } = await createToken(getDb(), VITRINE_ID, NOW);
    const init = (await (await rpc(token, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } })).json()) as { result: { protocolVersion: string; capabilities: { tools: unknown } } };
    expect(init.result.protocolVersion).toBe("2025-06-18");
    const list = (await (await rpc(token, { jsonrpc: "2.0", id: 2, method: "tools/list" })).json()) as { result: { tools: Array<{ name: string; inputSchema: { properties: Record<string, unknown> } }> } };
    expect(list.result.tools.map((t) => t.name)).toEqual(["ler_insights", "ver_plano", "gerar_plano", "aprovar_plano"]);
    // Nenhuma ferramenta recebe o restaurante: ele vem do token.
    expect(list.result.tools.every((t) => !("restaurantId" in t.inputSchema.properties))).toBe(true);
    const unknown = (await (await rpc(token, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "apagar_tudo" } })).json()) as { error: { code: number } };
    expect(unknown.error.code).toBe(-32602);

    const ins = await call(token, "ler_insights");
    expect(ins.isError).toBe(false);
    expect(JSON.stringify(ins.structuredContent)).not.toMatch(/telefone|phone|@/i);
    const g = await call(token, "gerar_plano");
    expect(g.isError).toBe(false);
    const planId = g.structuredContent.planId as string;
    // Sem IA neste ambiente: o assistente fica sabendo por quê (achado do teste de ponta a ponta pelo Claude).
    expect(g.structuredContent).toMatchObject({ origem: "sem_ia", motivo_sem_ia: expect.any(String) });
    const v = await call(token, "ver_plano");
    expect((v.structuredContent.plano as { id: string }).id).toBe(planId);
    expect(v.structuredContent.plano).toMatchObject({ origem: "sem_ia", motivo_sem_ia: expect.any(String) });
    const a = await call(token, "aprovar_plano", { planId });
    expect(a).toMatchObject({ isError: false, structuredContent: { aprovado: true } });
    const [row] = await getDb().select().from(weeklyPlans).where(eq(weeklyPlans.id, planId));
    expect(row!.approvedVia).toBe("agente");
    // Plano de outro id → erro da ferramenta (não exceção).
    expect((await call(token, "aprovar_plano", { planId: crypto.randomUUID() })).isError).toBe(true);
  }, 60_000);

  it("revisor (D148) vale também pelo agente: gerar → aprovar na hora dá 'revisor'; depois da revisão, aprova", async () => {
    await setFlag(getDb(), "revisor", true);
    const jobs: Array<() => Promise<void>> = [];
    // IA falsa: 1ª candidata de cada faixa com texto só de referências; revisor que aprova.
    const gateway: AiGateway = {
      async generate(req) {
        const text = "text" in req.input ? req.input.text : "";
        const faixas = [...text.matchAll(/^Faixa ([A-H]):/gm)].map((m) => m[1]!);
        const ofertas = [...text.matchAll(/^ {2}- (O\d+): faixa ([A-H])/gm)].map((m) => ({ o: m[1]!, f: m[2]! }));
        return { output: { escolhas: faixas.map((f) => ({ faixa: f, candidata: `${f}1`, textoConvite: `Volte {horario:${f}} e aproveite {oferta}.`, justificativa: `A faixa está {fato:faixa_${f}_intensidade}.` })), ordem: faixas, aprendemos: ofertas.map(({ o, f }) => ({ ofertaKey: o, texto: `Em {horario:${f}}, {fato:uso7d_${f}_pct} dos convites foram usados.` })) }, usage: { inTokens: 1, outTokens: 1 }, model: "fake" };
      },
    };
    const reviewerGateway: AiGateway = { generate: async () => ({ output: { veredito: "ok", motivos: [] }, usage: { inTokens: 1, outTokens: 1 }, model: "fake-revisor" }) };
    const deps = { schedule: (fn: () => Promise<void>) => void jobs.push(fn), gateway, reviewerGateway };
    const tool = async (name: string, args: Record<string, unknown> = {}) =>
      ((await handleRpc(getDb(), VITRINE_ID, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, new Date(), deps)) as { result: { structuredContent: Record<string, unknown>; isError: boolean } }).result;
    const g = await tool("gerar_plano");
    expect(g.structuredContent.origem).toBe("ia");
    const planId = g.structuredContent.planId as string;
    expect(await tool("aprovar_plano", { planId })).toMatchObject({ isError: true, structuredContent: { erro: "revisor" } });
    await Promise.all(jobs.map((j) => j()));
    expect(await tool("aprovar_plano", { planId })).toMatchObject({ isError: false });
  }, 60_000);

  it("token do restaurante A não aprova plano do restaurante B", async () => {
    await setFlag(getDb(), "mcp", true);
    const other = await getDb().execute(sql`select id from weekly_plans where restaurant_id <> ${VITRINE_ID} limit 1`);
    const { token } = await createToken(getDb(), VITRINE_ID, new Date());
    const planId = ((other as unknown as { rows: Array<{ id: string }> }).rows[0]?.id) ?? crypto.randomUUID();
    expect(await call(token, "aprovar_plano", { planId })).toMatchObject({ isError: true });
  });
});
