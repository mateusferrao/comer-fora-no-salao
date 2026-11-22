import { describe, expect, it } from "vitest";
import { catalogTools, PROPOSAL_ACTIONS } from "@/src/modules/agente/application/catalog";

/** Dívida da revisão S8 (item 22): o JSON Schema do MCP sai do mesmo Zod que valida a chamada. */
describe("catálogo do MCP — schemas gerados do Zod", () => {
  const tools = catalogTools({ clientes: true, edicao: true });
  const byName = (n: string) => tools.find((t) => t.name === n)!;

  it("propor_mudanca descreve e aceita as 8 ações", () => {
    expect(PROPOSAL_ACTIONS).toEqual(["oferta", "item", "faixa", "plano", "tom", "item_novo", "restaurante", "avisos"]);
    const t = byName("propor_mudanca");
    for (const a of PROPOSAL_ACTIONS) expect(t.description).toContain(a);
    const mudanca = (t.inputSchema.properties as Record<"mudanca", { oneOf: Array<{ properties: { acao: { const: string } } }> }>).mudanca;
    expect(mudanca.oneOf.map((o) => o.properties.acao.const)).toEqual(PROPOSAL_ACTIONS);
    expect(t.inputSchema.required).toEqual(["mudanca"]);
  });

  it("enxuto: sem $schema nem o pattern longo do uuid", () => {
    const json = JSON.stringify(tools);
    expect(json).not.toContain("$schema");
    expect(json).not.toContain('"pattern"');
    expect(json).toContain('"format":"uuid"');
  });

  it("buscar_clientes: filtros opcionais e só os segmentos conhecidos", () => {
    const s = byName("buscar_clientes").inputSchema as { required?: string[]; additionalProperties: boolean; properties: { segmento: { anyOf: Array<{ enum?: string[] }> } } };
    expect(s.required ?? []).toEqual([]);
    expect(s.additionalProperties).toBe(false);
    expect(s.properties.segmento.anyOf[0]!.enum).toEqual(["sumiu", "perto", "convite_ativo", "frequente"]);
  });

  it("sem flags: só as leituras", () => {
    expect(catalogTools({ clientes: false, edicao: false }).map((t) => t.name)).toEqual(["ver_configuracao", "ver_numeros"]);
    expect(byName("aplicar_proposta").inputSchema).toMatchObject({ type: "object", required: ["id"], additionalProperties: false });
  });
});
