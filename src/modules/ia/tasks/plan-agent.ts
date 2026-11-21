/**
 * Plano da semana como agente (S6.3b — D158, D159, D166, D194): a MESMA tarefa 3 (schema com enum das candidatas,
 * `packageGuard`, modelos e reservas), com 4 ferramentas só de leitura sobre dados já montados em memória pelo código.
 * Nenhuma ferramenta escreve nada nem recebe texto livre do dono como comando; `checar_texto` roda o guard (é a
 * autocorreção). Números e dinheiro continuam do código (`custo_semana`). Funções puras: servem também à T3 sem banco.
 */
import { z } from "zod";
import type { SlotCandidates } from "@/src/modules/onboarding/domain/candidates";
import { slotLabel } from "@/src/modules/beneficios/domain/slot-text";
import { formatFact, renderReferences } from "@/src/modules/textos/domain/references";
import { guardText } from "../guardrails";
import type { AgentStep, AiTool, ModelRef } from "../gateway";
import type { TaskDef } from "../run-task";
import { buildPackageTask, type PackageOut, type PackagePrompt } from "./package";

export const AGENT_PROMPT_VERSION = "plano-agente-v3";
export const AGENT_MAX_STEPS = 6;

export const AGENT_RULES = `Você trabalha como agente. Antes da resposta final, use as ferramentas:
- ver_candidatas para cada faixa e ver_fatos para os números do restaurante;
- custo_semana para conferir o custo máximo da oferta escolhida;
- checar_texto em CADA textoConvite e justificativa. Ela devolve o texto como o cliente e o dono vão ler ("renderizado"): leia em voz alta; se apontar problema ou soar estranho, reescreva e confira de novo.
Escrita (vale o tom da casa acima):
- textoConvite é um recado caloroso da casa, curto e natural, como se o dono falasse com o cliente. Nada de linguagem de relatório.
- {oferta} já diz o benefício inteiro (ex.: "Cannoli grátis"): não repita "grátis", "por nossa conta" nem o nome do prato ao lado dela.
- Todo textoConvite cita o {horario:X} da própria faixa (dias e horário são o que dá sentido ao convite): escreva "Volte {horario:X}…" ou "De {horario:X}…", sem "no", "na" ou "em" antes. O checar_texto recusa convite sem horário.
- justificativa: cite pelo menos 1 fato concreto do restaurante com {fato:chave} e explique em 1 ou 2 frases por que a oferta casa com o horário.
A resposta final segue exatamente o formato pedido.`;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const GROUPS = ["faixas", "convites", "clientes", "todos"] as const;
type Group = (typeof GROUPS)[number];
const groupOf = (key: string): Exclude<Group, "todos"> =>
  key.startsWith("faixa_") ? "faixas" : /^(uso|custo|emitid|usad|convite|teto|vered)/.test(key) ? "convites" : "clientes";

/** Ferramentas do agente sobre o prompt montado e as candidatas (com custo e teto) do código. */
export function buildPlanAgentTools(pp: PackagePrompt, cands: readonly SlotCandidates[], caps: Record<string, number> = {}): AiTool[] {
  const facts = (pp.ctxBase.facts ?? {}) as Record<string, number | string>;
  const optionById = new Map(cands.flatMap((c) => c.options.map((o) => [o.id, { ...o, slotId: c.slotId }] as const)));
  const slotAliases = [...pp.slotByAlias.keys()] as [string, ...string[]];
  const candAliases = [...pp.candByAlias.keys()] as [string, ...string[]];
  return [
    {
      name: "ver_fatos",
      description: "Fatos do restaurante (números já formatados), para citar com {fato:chave}. Grupos: faixas, convites, clientes ou todos.",
      input: z.object({ grupo: z.enum(GROUPS) }),
      execute: async (raw) => {
        const { grupo } = raw as { grupo: Group };
        return Object.fromEntries(Object.entries(facts).filter(([k]) => grupo === "todos" || groupOf(k) === grupo).map(([k, v]) => [`{fato:${k}}`, formatFact(k, v)]));
      },
    },
    {
      name: "ver_candidatas",
      description: "Ofertas candidatas válidas de uma faixa (o código já conferiu custo, categoria e teto).",
      input: z.object({ faixa: z.enum(slotAliases) }),
      execute: async (raw) => {
        const { faixa } = raw as { faixa: string };
        return [...pp.candByAlias].filter(([, c]) => c.slotAlias === faixa).map(([alias, c]) => ({ candidata: alias, oferta: c.gain }));
      },
    },
    {
      name: "custo_semana",
      description: "Custo máximo da semana de uma candidata (teto de convites × custo de cada um), calculado pelo código.",
      input: z.object({ candidata: z.enum(candAliases) }),
      execute: async (raw) => {
        const { candidata } = raw as { candidata: string };
        const c = pp.candByAlias.get(candidata)!;
        const o = optionById.get(c.id);
        if (!o) return { erro: "candidata_desconhecida" };
        const cap = caps[o.slotId] ?? o.weeklyCap;
        return { candidata, teto: `${cap} convites`, custo_por_convite: BRL.format(o.unitCostCents / 100), custo_maximo_semana: BRL.format((o.unitCostCents * cap) / 100) };
      },
    },
    {
      name: "checar_texto",
      description: "Confere um texto contra as regras fixas antes da resposta final (referências, números, palavras proibidas, termos a evitar, tamanho).",
      input: z.object({ campo: z.enum(["textoConvite", "justificativa", "aprendemos"]), faixa: z.enum(slotAliases).optional(), texto: z.string().max(600) }),
      execute: async (raw) => {
        const { campo, faixa, texto } = raw as { campo: "textoConvite" | "justificativa" | "aprendemos"; faixa?: string; texto: string };
        const oferta = faixa ? [...pp.candByAlias.values()].find((c) => c.slotAlias === faixa)?.gain : undefined;
        const allowed = campo === "textoConvite" ? (["prato", "horario", "oferta"] as const) : (["fato", "prato", "horario", "oferta"] as const);
        const maxLen = campo === "textoConvite" ? 160 : campo === "justificativa" ? 400 : 300;
        const ctx = { ...pp.ctxBase, oferta: oferta ?? "a oferta" };
        const g = guardText(texto, ctx, { allowed, maxLen, field: campo, mode: "ia", avoid: pp.avoid, ...(campo === "textoConvite" && faixa ? { requireSlot: faixa } : {}) });
        // O agente lê o texto como vai ficar (revisão da 1ª rodada da T3: "Volte no terça" passou sem ninguém ler).
        const renderizado = renderReferences(texto, ctx);
        return g.ok ? { ok: true, renderizado } : { ok: false, problemas: g.reasons, renderizado };
      },
    },
  ];
}

/** A tarefa 3 com ferramentas: mesmo schema e guard; 6 passos; 30 s por modelo, 12 s por passo. */
export function buildPlanAgentTask(pp: PackagePrompt, models: ModelRef[], tools: readonly AiTool[]): TaskDef<PackageOut> {
  const base = buildPackageTask(pp, models);
  return { ...base, name: "plano_agente", promptVersion: AGENT_PROMPT_VERSION, perAttemptTimeoutMs: 30_000, totalBudgetMs: 45_000, tools, maxSteps: AGENT_MAX_STEPS, stepMs: 12_000 };
}

const short = (v: unknown, n = 200) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/** Nomes para o dono: apelido da faixa → "terça, quarta e quinta, das 15h às 18h"; da candidata → "Cannoli grátis". */
export type StepNames = { faixa: (alias: string) => string | undefined; candidata: (alias: string) => string | undefined };
const GROUP_NAMES: Record<string, string> = { faixas: "dos horários", convites: "dos convites", clientes: "dos clientes" };

export function stepNames(pp: Pick<PackagePrompt, "slotByAlias" | "candByAlias">): StepNames {
  return {
    faixa: (a) => {
      const s = pp.slotByAlias.get(a);
      return s ? slotLabel(s) : undefined;
    },
    candidata: (a) => pp.candByAlias.get(a)?.gain,
  };
}

/**
 * Rótulo legível de um passo (revisão de produto: "1. Consultou os turnos · 0,4 s"). Sem apelidos internos (A, A1)
 * na tela do dono (revisão S4–S6, produto 3): com `names`, a faixa e a oferta aparecem pelo nome.
 */
export function stepLabel(s: Pick<AgentStep, "tool" | "input">, names?: StepNames): string {
  const i = (s.input ?? {}) as Record<string, string>;
  switch (s.tool) {
    case "ver_fatos":
      return i.grupo === "todos" ? "Consultou os números do restaurante" : `Consultou os números ${GROUP_NAMES[i.grupo ?? ""] ?? "do restaurante"}`;
    case "ver_candidatas": {
      const f = names?.faixa(i.faixa ?? "");
      return f ? `Viu as ofertas possíveis de ${f}` : "Viu as ofertas possíveis de um horário";
    }
    case "custo_semana": {
      const c = names?.candidata(i.candidata ?? "");
      return c ? `Calculou o custo máximo da semana de ${c}` : "Calculou o custo máximo da semana de uma oferta";
    }
    case "checar_texto":
      return i.campo === "textoConvite" ? "Conferiu o texto do convite nas regras" : i.campo === "justificativa" ? "Conferiu a justificativa nas regras" : "Conferiu o “o que aprendemos” nas regras";
    default:
      return "Consultou os dados do restaurante";
  }
}

/** Passos como ficam gravados em `weekly_plans.agent_steps` (entrada e saída resumidas; nunca PII — só dados do código). */
export function storedSteps(steps: readonly AgentStep[], names?: StepNames): Array<{ tool: string; label: string; input: string; output: string; ms: number }> {
  return steps.map((s) => ({ tool: s.tool, label: stepLabel(s, names), input: short(s.input), output: short(s.output), ms: s.ms }));
}
