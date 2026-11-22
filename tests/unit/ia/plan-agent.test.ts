import { describe, expect, it } from "vitest";
import { buildCandidates } from "@/src/modules/onboarding/domain/candidates";
import { declaredFacts } from "@/src/modules/onboarding/domain/facts";
import { buildPackagePrompt } from "@/src/modules/ia/tasks/package";
import { buildPlanAgentTask, buildPlanAgentTools, stepLabel, storedSteps } from "@/src/modules/ia/tasks/plan-agent";
import { guardText } from "@/src/modules/ia/guardrails";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import type { Slot } from "@/src/modules/beneficios/domain/slots";

const menu: MenuItem[] = [
  { id: "i-cannoli", category: "sobremesa", name: "Cannoli", priceCents: 2200 },
  { id: "i-fritto", category: "porcao", name: "Fritto misto", priceCents: 4800 },
  { id: "i-limonada", category: "bebida", name: "Limonada", priceCents: 1400 },
];
const slot: Slot = { id: "uuid-tarde", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 5 };
const cands = buildCandidates([slot], menu, { ticketCents: 8500, marginPct: 65, exclude: [] });
const pp = buildPackagePrompt({ restaurantName: "Cantina", slots: [slot], cands, menu, facts: declaredFacts({ ticketCents: 8500 }, [slot], menu), owner: { avoid: ["álcool"] } });
const tools = Object.fromEntries(buildPlanAgentTools(pp, cands, { "uuid-tarde": 12 }).map((t) => [t.name, t]));

describe("ferramentas do agente (S6.3b, D166): só leitura, números do código, sem PII", () => {
  it("são 4, com entrada validada", () => {
    expect(Object.keys(tools).sort()).toEqual(["checar_texto", "custo_semana", "ver_candidatas", "ver_fatos"]);
    expect(tools.ver_candidatas!.input.safeParse({ faixa: "Z" }).success).toBe(false);
  });

  it("ver_candidatas devolve só as da faixa; ver_fatos devolve as referências formatadas", async () => {
    const c = (await tools.ver_candidatas!.execute({ faixa: "A" })) as Array<{ candidata: string; oferta: string }>;
    expect(c.length).toBe(cands[0]!.options.length);
    expect(c.every((x) => x.candidata.startsWith("A"))).toBe(true);
    const f = (await tools.ver_fatos!.execute({ grupo: "todos" })) as Record<string, string>;
    expect(f["{fato:ticket_medio}"]).toBe("R$ 85,00");
    expect(JSON.stringify(f)).not.toMatch(/@|\d{8,}/);
  });

  it("custo_semana = teto (recalibrado) × custo unitário do código", async () => {
    const o = cands[0]!.options[0]!;
    const r = (await tools.custo_semana!.execute({ candidata: "A1" })) as Record<string, string>;
    expect(r.teto).toBe("12 convites");
    expect(r.custo_maximo_semana!.replace(/\s/g, " ")).toBe(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format((o.unitCostCents * 12) / 100).replace(/\s/g, " "));
  });

  it("checar_texto = o mesmo guard (inclui o 'O que evitar')", async () => {
    const ok = await tools.checar_texto!.execute({ campo: "textoConvite", faixa: "A", texto: "Volte {horario:A} e aproveite {oferta}." });
    expect(ok).toEqual({ ok: true, renderizado: expect.stringMatching(/^Volte terça, quarta e quinta/) });
    const bad = (await tools.checar_texto!.execute({ campo: "textoConvite", faixa: "A", texto: "Ganhe 50% e um drink sem alcool" })) as { ok: boolean; problemas: string[] };
    expect(bad.ok).toBe(false);
    expect(bad.problemas).toEqual(expect.arrayContaining(["numero", "evitar:álcool"]));
    const g = guardText("Ganhe 50% e um drink sem alcool", { ...pp.ctxBase, oferta: "x" }, { allowed: ["prato", "horario", "oferta"], maxLen: 160, field: "textoConvite", mode: "ia", avoid: ["álcool"], requireSlot: "A" });
    expect(g.ok === false && g.reasons).toEqual(bad.problemas);
  });

  it("checar_texto usa a candidata escolhida, não a 1ª da faixa (S9, M3)", async () => {
    const a2 = pp.candByAlias.get("A2")!;
    const a1 = pp.candByAlias.get("A1")!;
    expect(a2.gain).not.toBe(a1.gain);
    const r = (await tools.checar_texto!.execute({ campo: "textoConvite", faixa: "A", candidata: "A2", texto: "Volte {horario:A} e aproveite {oferta}." })) as { renderizado: string };
    expect(r.renderizado).toContain(a2.gain);
    expect(r.renderizado).not.toContain(a1.gain);
    expect(tools.checar_texto!.input.safeParse({ campo: "textoConvite", faixa: "A", candidata: "Z9", texto: "x" }).success).toBe(false);
  });

  it("tarefa: mesmo schema e guard do plano, com 6 passos e 12 s por passo", () => {
    const t = buildPlanAgentTask(pp, [], buildPlanAgentTools(pp, cands));
    expect(t).toMatchObject({ name: "plano_agente", maxSteps: 6, stepMs: 12_000, perAttemptTimeoutMs: 30_000 });
    expect(t.tools).toHaveLength(4);
  });

  it("passos gravados com rótulos legíveis e resumidos", () => {
    // Sem apelidos internos na tela (revisão S4–S6, produto 3).
    expect(stepLabel({ tool: "ver_candidatas", input: { faixa: "A" } })).toBe("Viu as ofertas possíveis de um horário");
    const names = { faixa: (a: string) => (a === "A" ? "terça, quarta e quinta, das 15h às 18h" : undefined), candidata: (a: string) => (a === "A1" ? "Cannoli grátis" : undefined) };
    expect(stepLabel({ tool: "ver_candidatas", input: { faixa: "A" } }, names)).toBe("Viu as ofertas possíveis de terça, quarta e quinta, das 15h às 18h");
    expect(stepLabel({ tool: "custo_semana", input: { faixa: "A", candidata: "A1" } }, names)).toBe("Calculou o custo máximo da semana de Cannoli grátis");
    expect(stepLabel({ tool: "ver_fatos", input: { grupo: "faixas" } })).toBe("Consultou os números dos horários");
    const s = storedSteps([{ tool: "ver_fatos", input: { grupo: "faixas" }, output: { x: "y".repeat(500) }, ms: 400 }]);
    expect(s[0]).toMatchObject({ tool: "ver_fatos", label: "Consultou os números dos horários", ms: 400 });
    expect(s[0]!.output.length).toBeLessThanOrEqual(200);
  });
});
