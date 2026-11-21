import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { benefitVersions, menuItems } from "@/src/db/schema";
import { setFlag } from "@/src/modules/config/application/app-config";
import { createToken } from "@/src/modules/mcp/tokens";
import { POST } from "@/app/api/mcp/route";
import { createRestaurant, resetDb } from "./helpers/db";

const NOW = new Date();
const URL_MCP = "http://localhost:3000/api/mcp";
const rpc = async (token: string, method: string, params?: Record<string, unknown>) => {
  const r = await POST(new Request(URL_MCP, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }) }));
  return (await r.json()) as { result?: { tools?: Array<{ name: string }>; structuredContent?: Record<string, unknown>; isError?: boolean }; error?: { message: string } };
};
const call = (token: string, name: string, args: Record<string, unknown> = {}) => rpc(token, "tools/call", { name, arguments: args });

describe("MCP sobre o catálogo do agente (S8 — D267–D269)", () => {
  let token = "";
  let r: Awaited<ReturnType<typeof createRestaurant>>;
  beforeAll(async () => {
    await resetDb();
    r = await createRestaurant();
    token = (await createToken(getDb(), r.restaurantId, NOW)).token;
    await setFlag(getDb(), "mcp", true);
  }, 60_000);
  afterAll(closeDb);

  it("flags desligadas: 4 ferramentas do plano + leituras; clientes e edição escondidos", async () => {
    await setFlag(getDb(), "mcp_clientes", false);
    await setFlag(getDb(), "mcp_edicao", false);
    const names = (await rpc(token, "tools/list")).result!.tools!.map((t) => t.name);
    expect(names).toEqual(["ler_insights", "ver_plano", "gerar_plano", "aprovar_plano", "ver_configuracao", "ver_numeros"]);
    expect((await call(token, "propor_mudanca", { mudanca: {} })).error?.message).toMatch(/Unknown tool/);
  });

  it("ver_configuracao devolve ids; buscar_clientes (flag) sem contato", async () => {
    await setFlag(getDb(), "mcp_clientes", true);
    const cfg = (await call(token, "ver_configuracao")).result!.structuredContent!;
    expect((cfg.cardapio as Array<{ itemId: string }>).some((m) => m.itemId === r.items.bruschetta)).toBe(true);
    const cli = (await call(token, "buscar_clientes", { segmento: null, nome: null })).result!;
    expect(cli.isError).toBe(false);
    expect(JSON.stringify(cli.structuredContent)).not.toMatch(/@|\d{8,}/);
  });

  it("propor_mudanca não grava; aplicar_proposta grava (via agente); 2ª vez → já estava", async () => {
    await setFlag(getDb(), "mcp_edicao", true);
    const p = (await call(token, "propor_mudanca", { mudanca: { acao: "oferta", papel: "convite", slotId: r.slots.A, offer: { kind: "entrada_gratis", itemId: r.items.bruschetta }, weeklyCap: 9 } })).result!;
    expect(p.isError).toBe(false);
    const id = p.structuredContent!.id as string;
    const before = await getDb().select().from(benefitVersions).where(and(eq(benefitVersions.restaurantId, r.restaurantId), eq(benefitVersions.kind, "entrada_gratis")));
    expect(before).toHaveLength(0);
    const a = (await call(token, "aplicar_proposta", { id })).result!;
    expect(a.structuredContent).toMatchObject({ status: "aplicada", ja_estava: false });
    const [v] = await getDb().select().from(benefitVersions).where(and(eq(benefitVersions.restaurantId, r.restaurantId), isNull(benefitVersions.supersededAt), eq(benefitVersions.kind, "entrada_gratis")));
    expect(v!.weeklyCap).toBe(9);
    expect((await call(token, "aplicar_proposta", { id })).result!.structuredContent).toMatchObject({ status: "aplicada", ja_estava: true });
  });

  it("regra do código recusa (Tiramisù é a recompensa); formato inválido explica", async () => {
    const t = (await call(token, "propor_mudanca", { mudanca: { acao: "item", itemId: r.items.tiramisu, mudanca: "indisponivel" } })).result!;
    expect(t.isError).toBe(true);
    expect(t.structuredContent).toMatchObject({ recusada: true });
    const bad = (await call(token, "propor_mudanca", { mudanca: { acao: "item", itemId: "x" } })).result!;
    expect(bad.structuredContent).toMatchObject({ erro: "formato_da_mudanca" });
    const [it] = await getDb().select().from(menuItems).where(eq(menuItems.id, r.items.tiramisu!));
    expect(it!.active).toBe(true);
  });
});
