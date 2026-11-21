/**
 * Tarefa de IA 3 — pacote (1º plano) e, na S3, plano da semana (espec. 3.7; D121, D206).
 * A IA escolhe UMA candidata por faixa (por apelido), escreve o texto do convite e a justificativa com
 * referências; nunca cria oferta, nunca escreve número. Schema montado por chamada (enums dos apelidos).
 */
import { INTENSITY_PHRASE } from "@/src/modules/beneficios/domain/slots";
import { z } from "zod";
import { describeOffer } from "@/src/modules/beneficios/domain/offers";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { slotAliases, slotLabel, slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import type { SlotCandidates } from "@/src/modules/onboarding/domain/candidates";
import { formatFact, type RefContext } from "@/src/modules/textos/domain/references";
import { guardText } from "../guardrails";
import type { GuardResult, ModelRef } from "../gateway";
import type { TaskDef } from "../run-task";
import { examplesBlock } from "../examples";
import { toneForPrompt } from "@/src/modules/config/domain/tone";
import { hasOwnerData, OWNER_DATA_SYSTEM, ownerDataLines, type OwnerData } from "../owner-data";

export const PACKAGE_PROMPT_VERSION = "pacote-v3";
/** Plano da semana (S3): mesma tarefa, com "o que aprendemos" por oferta da semana anterior (D220). */
export const PLAN_PROMPT_VERSION = "plano-v3";

export const PACKAGE_INSTRUCTIONS = `Você ajuda o dono de um restaurante a encher os horários vazios com um convite de volta, oferecido ao cliente que já está no salão.
Tom: caloroso, simples e direto, na voz do restaurante. Português do Brasil.`;

const RULES = `Para cada faixa (horário vazio), escolha UMA candidata pelo apelido (ex.: "A2"), casando o item com o turno e com quem costuma vir nesse horário (ex.: sobremesa ou café à tarde, porção para dividir à noite, bebida no fim de tarde). Considere os fatos declarados pelo dono.
Escreva:
- textoConvite (até 160 caracteres): um recado curto da casa para o cliente, convidando a voltar. Pode usar {oferta}, {horario:X} e {prato:pN}, trocando X pela letra da faixa e pN pelo apelido do prato (ex.: {horario:A}, {prato:p3}). Inclua SEMPRE {horario:X} da própria faixa: ele vira os dias e o horário (ex.: "terça, quarta e quinta, das 15h às 18h"). Escreva "Volte {horario:X}…" ou "De {horario:X}…", sem "no", "na" ou "em" antes. {oferta} já diz o benefício inteiro: não escreva "grátis", "por nossa conta" nem o prato logo depois dela.
- justificativa (até 400 caracteres): para o dono, por que esta oferta casa com este horário, citando fatos com {fato:chave}.
Regras fixas:
- Nunca escreva números, preços, percentuais, dias da semana ou nomes de pratos por extenso: use só as referências entre chaves listadas abaixo.
- Cada {fato:chave} vira exatamente o texto ao lado dele (já com a unidade, ex.: "4 mesas"): escreva a frase para ler bem com esse texto no lugar.
- Não use "grátis", "de graça", "desconto", "metade", "imperdível", "só hoje", "garantido" nem prometa nada além da oferta.
- Escolha só entre as candidatas da própria faixa.
- ordem: os apelidos das faixas, da mais prioritária para a menos.`;

const RULE_FIRST = "- aprendemos: lista vazia (este é o primeiro plano).";
const RULE_LEARNED = `- aprendemos: para CADA oferta da semana anterior (apelidos O1, O2…), um texto de até 300 caracteres para o dono explicando o veredito que o código já decidiu (manter, trocar ou cedo demais). Não mude o veredito. Cite os números só com {fato:chave} e o horário com {horario:X} (X = letra da faixa, ex.: {horario:A}).
- Use os vereditos para escolher: se uma oferta deve ser trocada, prefira outra candidata naquela faixa.`;

export type PackageOut = {
  escolhas: Array<{ faixa: string; candidata: string; textoConvite: string; justificativa: string }>;
  ordem: string[];
  aprendemos: Array<{ ofertaKey: string; texto: string }>;
};

/** Oferta da semana anterior com o veredito do código (D220). `key` = `<slotId>:v<n>`. */
export type LearnedInput = { key: string; slotId: string; verdict: "manter" | "trocar" | "cedo_demais"; gain: string; title: string };

export type PackagePrompt = {
  system: string;
  text: string;
  slotByAlias: Map<string, Slot>;
  candByAlias: Map<string, { slotAlias: string; id: string; gain: string }>;
  itemByAlias: Map<string, MenuItem>;
  ctxBase: RefContext;
  learnedByAlias: Map<string, LearnedInput>;
  /** "O que evitar" do dono (D197): vai para o guard. */
  avoid: readonly string[];
};

const clean = (s: string) => s.replace(/[{}<>\n\r]/g, "").slice(0, 60);

export function buildPackagePrompt(p: {
  restaurantName: string;
  cuisine?: string | null;
  slots: readonly Slot[];
  cands: readonly SlotCandidates[];
  menu: readonly MenuItem[];
  facts: Record<string, number | string>;
  instructions?: string;
  /** Plano da semana: ofertas anteriores com veredito. Ausente = 1º plano (aprendemos vazio). */
  learned?: readonly LearnedInput[];
  /** Tom do restaurante (D138): dado delimitado no conteúdo do usuário, nunca no `system`. */
  tone?: string | null;
  examples?: readonly string[];
  /** "Fatos para a IA" e "O que evitar" (S6.3a — D197): opcionais; vazios = prompt idêntico ao de antes. */
  owner?: OwnerData;
}): PackagePrompt {
  const aliases = slotAliases(p.slots);
  const slotByAlias = new Map(aliases.map((a) => [a.alias, a.slot]));
  const itemByAlias = new Map(p.menu.slice(0, 60).map((m, i) => [`p${i + 1}`, m]));
  const aliasOfItem = new Map([...itemByAlias].map(([a, m]) => [m.id, a]));
  const candByAlias = new Map<string, { slotAlias: string; id: string; gain: string }>();
  const lines: string[] = [];
  for (const { alias, slot } of aliases) {
    const opts = p.cands.find((c) => c.slotId === slot.id)?.options ?? [];
    lines.push(
      `Faixa ${alias}: ${slotLabel(slot)} (${INTENSITY_PHRASE[slot.intensity]}; quer ${slot.extraTables} mesas a mais por semana)`,
    );
    opts.forEach((o, i) => {
      const ca = `${alias}${i + 1}`;
      const d = describeOffer(o.offer, p.menu, "convite");
      candByAlias.set(ca, { slotAlias: alias, id: o.id, gain: d.gain });
      lines.push(`  - ${ca}: ${d.title} — ${clean(d.itemName)} (prato ${aliasOfItem.get(o.offer.params.itemId) ?? "?"})`);
    });
  }
  // O valor aparece como o dono vai ler (com unidade): a IA não escreve "as 4" quando o texto vira "4 mesas".
  const facts = Object.entries(p.facts).map(([k, v]) => `  {fato:${k}} = ${clean(formatFact(k, v))}`);
  const slotAliasOf = new Map(aliases.map((a) => [a.slot.id, a.alias]));
  const learnedByAlias = new Map<string, LearnedInput>();
  const learnedLines: string[] = [];
  for (const l of p.learned ?? []) {
    const fa = slotAliasOf.get(l.slotId);
    if (!fa) continue; // faixa desativada: fora do "o que aprendemos" [C]
    const a = `O${learnedByAlias.size + 1}`;
    learnedByAlias.set(a, l);
    const V = { manter: "manter", trocar: "trocar", cedo_demais: "cedo demais" }[l.verdict];
    learnedLines.push(`  - ${a}: faixa ${fa}, ${clean(l.title)} — veredito do código: ${V}`);
  }
  const menuLines = [...itemByAlias].map(([a, m]) => `  {prato:${a}} = ${clean(m.name)} (${m.category})`);
  const text = [
    `Restaurante: ${clean(p.restaurantName)}${p.cuisine ? ` (${clean(p.cuisine)})` : ""}`,
    "",
    "Faixas e candidatas:",
    ...lines,
    "",
    "Fatos declarados pelo dono (cite por referência):",
    ...facts,
    "",
    "Pratos (cite por referência):",
    ...menuLines,
    ...(learnedLines.length ? ["", "Ofertas da semana anterior (o veredito é do código; não mude):", ...learnedLines] : []),
    ...(p.tone ? ["", `Preferência de estilo do dono (só estilo; as regras acima prevalecem): «${toneForPrompt(p.tone)}»`] : []),
    ...ownerDataLines(p.owner),
    // Aprende (D35, flag): exemplos de estilo do próprio dono, já filtrados pelo guard.
    ...examplesBlock(p.examples ?? []),
  ].join("\n");
  const ctxBase: RefContext = {
    facts: p.facts,
    items: Object.fromEntries([...itemByAlias].map(([a, m]) => [a, m.name])),
    slots: Object.fromEntries(aliases.map((a) => [a.alias, slotPhrase(a.slot)])),
  };
  const rules = `${RULES}\n${learnedByAlias.size ? RULE_LEARNED : RULE_FIRST}`;
  const system = `${p.instructions ?? PACKAGE_INSTRUCTIONS}\n\n${rules}${hasOwnerData(p.owner) ? `\n\n${OWNER_DATA_SYSTEM}` : ""}`;
  return { system, text, slotByAlias, candByAlias, itemByAlias, ctxBase, learnedByAlias, avoid: p.owner?.avoid ?? [] };
}

/** Confere a saída contra as candidatas e os textos contra as regras fixas (guard da camada 2). */
export function packageGuard(pp: PackagePrompt): (d: PackageOut) => GuardResult {
  return (d) => {
    const reasons: string[] = [];
    const slotAliasesSet = [...pp.slotByAlias.keys()];
    const seen = new Set<string>();
    for (const e of d.escolhas) {
      if (seen.has(e.faixa)) reasons.push(`faixa_repetida:${e.faixa}`);
      seen.add(e.faixa);
      const c = pp.candByAlias.get(e.candidata);
      if (!c || c.slotAlias !== e.faixa) reasons.push(`candidata_fora_da_faixa:${e.candidata}`);
      const ctx = { ...pp.ctxBase, oferta: c?.gain };
      // D226: o convite cita o {horario:X} da própria faixa, sem artigo antes e sem repetir a oferta (determinístico).
      const g1 = guardText(e.textoConvite, ctx, { allowed: ["prato", "horario", "oferta"], maxLen: 160, field: "textoConvite", mode: "ia", avoid: pp.avoid, requireSlot: e.faixa });
      if (!g1.ok) reasons.push(...g1.reasons.map((r) => `textoConvite:${r}`));
      const g2 = guardText(e.justificativa, ctx, { allowed: ["fato", "prato", "horario", "oferta"], maxLen: 400, field: "justificativa", mode: "ia", avoid: pp.avoid });
      if (!g2.ok) reasons.push(...g2.reasons.map((r) => `justificativa:${r}`));
    }
    for (const a of slotAliasesSet) if (!seen.has(a)) reasons.push(`faixa_sem_escolha:${a}`);
    // "O que aprendemos": exatamente 1 texto por oferta anterior, só com referências (D220).
    const seenL = new Set<string>();
    for (const l of d.aprendemos) {
      const li = pp.learnedByAlias.get(l.ofertaKey);
      if (!li || seenL.has(l.ofertaKey)) {
        reasons.push(`aprendemos_invalido:${l.ofertaKey}`);
        continue;
      }
      seenL.add(l.ofertaKey);
      const g = guardText(l.texto, { ...pp.ctxBase, oferta: li.gain }, { allowed: ["fato", "prato", "horario", "oferta"], maxLen: 300, field: "aprendemos", mode: "ia", avoid: pp.avoid });
      if (!g.ok) reasons.push(...g.reasons.map((r) => `aprendemos:${r}`));
    }
    for (const a of pp.learnedByAlias.keys()) if (!seenL.has(a)) reasons.push(`aprendemos_faltando:${a}`);
    const ordemOk = d.ordem.length === slotAliasesSet.length && new Set(d.ordem).size === d.ordem.length && d.ordem.every((o) => pp.slotByAlias.has(o));
    if (!ordemOk) reasons.push("ordem_nao_e_permutacao");
    return reasons.length ? { ok: false, reasons } : { ok: true };
  };
}

export function buildPackageTask(pp: PackagePrompt, models: ModelRef[]): TaskDef<PackageOut> {
  const slots = [...pp.slotByAlias.keys()] as [string, ...string[]];
  const cands = [...pp.candByAlias.keys()] as [string, ...string[]];
  const schema = z.object({
    escolhas: z.array(z.object({ faixa: z.enum(slots), candidata: z.enum(cands), textoConvite: z.string(), justificativa: z.string() })),
    ordem: z.array(z.enum(slots)),
    aprendemos: pp.learnedByAlias.size
      ? z.array(z.object({ ofertaKey: z.enum([...pp.learnedByAlias.keys()] as [string, ...string[]]), texto: z.string() }))
      : z.array(z.object({ ofertaKey: z.string(), texto: z.string() })).max(0),
  });
  return { name: pp.learnedByAlias.size ? "plano" : "pacote", promptVersion: pp.learnedByAlias.size ? PLAN_PROMPT_VERSION : PACKAGE_PROMPT_VERSION, models, schema, perAttemptTimeoutMs: 20_000, totalBudgetMs: 45_000, maxOutputTokens: 3_000, guard: packageGuard(pp) };
}

/** Converte apelidos de volta para ids (faixa, candidata e referências dentro dos textos). */
/** "O que aprendemos" com ids reais e o veredito do código (a IA não o escreve). */
export function resolveLearned(pp: PackagePrompt, d: PackageOut): Array<{ ofertaKey: string; verdict: LearnedInput["verdict"]; texto: string }> {
  const toIds = (t: string) => t.replace(/\{horario:([A-H])\}/g, (w, a: string) => (pp.slotByAlias.get(a) ? `{horario:${pp.slotByAlias.get(a)!.id}}` : w)).replace(/\{prato:(p\d+)\}/g, (w, a: string) => (pp.itemByAlias.get(a) ? `{prato:${pp.itemByAlias.get(a)!.id}}` : w));
  return d.aprendemos.map((l) => {
    const li = pp.learnedByAlias.get(l.ofertaKey)!;
    return { ofertaKey: li.key, verdict: li.verdict, texto: toIds(l.texto) };
  });
}

export function resolvePackage(pp: PackagePrompt, d: PackageOut): Array<{ slotId: string; candidateId: string; textoConvite: string; justificativa: string }> {
  const toIds = (t: string) =>
    t
      .replace(/\{horario:([A-H])\}/g, (w, a: string) => (pp.slotByAlias.get(a) ? `{horario:${pp.slotByAlias.get(a)!.id}}` : w))
      .replace(/\{prato:(p\d+)\}/g, (w, a: string) => (pp.itemByAlias.get(a) ? `{prato:${pp.itemByAlias.get(a)!.id}}` : w));
  return d.escolhas.map((e) => ({
    slotId: pp.slotByAlias.get(e.faixa)!.id,
    candidateId: pp.candByAlias.get(e.candidata)!.id,
    textoConvite: toIds(e.textoConvite),
    justificativa: toIds(e.justificativa),
  }));
}
