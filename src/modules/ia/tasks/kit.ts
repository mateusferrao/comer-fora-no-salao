/**
 * Tarefa de IA 2 — chamadas do kit (espec. 3.4, 4.4). A IA escreve título, subtítulo e ação de 2 versões
 * (A/B) e o recado do restaurante, com `{beneficio}`, `{recompensa}` e `{prato:pN}`. Proteção do holdout
 * (revisão P-I2): o contexto NÃO recebe faixas nem itens de convite; o guard reprova dia/turno e item de convite.
 */
import { z } from "zod";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import type { RefContext } from "@/src/modules/textos/domain/references";
import { FIELD_MAX, VERSION_FIELDS, type KitTexts } from "@/src/modules/kit/domain/templates";
import { guardText } from "../guardrails";
import type { GuardResult, ModelRef } from "../gateway";
import type { TaskDef } from "../run-task";
import { examplesBlock } from "../examples";
import { toneForPrompt } from "@/src/modules/config/domain/tone";
import { hasOwnerData, OWNER_DATA_SYSTEM, ownerDataLines, type OwnerData } from "../owner-data";

export const KIT_PROMPT_VERSION = "kit-v2";

export const KIT_INSTRUCTIONS = `Você escreve as chamadas de um display de mesa e de um cartaz que ficam no salão de um restaurante, para convidar quem já está sentado a ler o QR e fazer check-in no app.
Tom: caloroso, simples e direto, na voz do restaurante. Português do Brasil.`;

const RULES = `Escreva 2 versões diferentes (A e B), para testar qual chama mais atenção, e um recado curto do restaurante.
- titulo (curto, chamativo), subtitulo (uma frase explicando o que fazer), acao (chamada para ler o QR).
- recado: uma frase calorosa do restaurante para o cliente (aparece no app, junto do benefício).
- Use {beneficio} para citar o benefício do check-in e {recompensa} para a recompensa da cartela de selos. Pode citar pratos com {prato:pN}.
- Tamanho máximo, contando o texto já com as referências trocadas (o tamanho de cada uma está ao lado dela): titulo ${FIELD_MAX.titulo}, subtitulo ${FIELD_MAX.subtitulo}, acao ${FIELD_MAX.acao} e recado ${FIELD_MAX.recado} caracteres. Prefira frases curtas; o recado pode não citar nada.
Regras fixas:
- Nunca escreva números, preços, percentuais, nomes de pratos por extenso, dias da semana ou turnos (manhã, tarde, noite): use só as referências entre chaves.
- Não fale de convite, volta ou horários: isso é decidido em outra etapa.
- Não use "grátis", "de graça", "desconto", "metade", "imperdível", "só hoje", "garantido", "brinde", "por conta da casa".
- {beneficio} é o que o cliente ganha na 1ª visita, ao fazer o check-in.
Escrita (S9):
- Sem ponto de exclamação e sem travessão (—). Frases curtas, com ponto final ou vírgula.
- Nada de fórmulas de anúncio: "descubra", "experimente", "não perca", "aproveite já", "venha conferir", "especial para você", "momento único", "sabor inesquecível", "do jeito que você merece".
- Nada de "não é só X, é Y", de listas do que não tem ("sem X, sem Y") nem de pergunta seguida da resposta ("O melhor? …").
- Diga o que o cliente faz e o que ganha, com palavras simples.`;

export type KitOut = { A: { titulo: string; subtitulo: string; acao: string }; B: { titulo: string; subtitulo: string; acao: string }; recado: string };

const version = z.object({ titulo: z.string(), subtitulo: z.string(), acao: z.string() });
export const kitSchema = z.object({ A: version, B: version, recado: z.string() });

export type KitPrompt = { system: string; text: string; ctx: RefContext; itemByAlias: Map<string, MenuItem>; forbidAliases: string[]; avoid?: readonly string[] };

const clean = (s: string) => s.replace(/[{}<>\n\r]/g, "").slice(0, 60);

export function buildKitPrompt(p: { restaurantName: string; cuisine?: string | null; beneficio: string; recompensa: string; menu: readonly MenuItem[]; inviteItemIds: readonly string[]; instructions?: string; tone?: string | null; examples?: readonly string[]; owner?: OwnerData }): KitPrompt {
  // Itens de convite ficam fora do contexto (não podem ser citados nas peças).
  const visible = p.menu.filter((m) => !p.inviteItemIds.includes(m.id)).slice(0, 40);
  const itemByAlias = new Map(visible.map((m, i) => [`p${i + 1}`, m]));
  const text = [
    `Restaurante: ${clean(p.restaurantName)}${p.cuisine ? ` (${clean(p.cuisine)})` : ""}`,
    `{beneficio} = ${clean(p.beneficio)} (${p.beneficio.length} caracteres; o cliente ganha na 1ª visita, ao fazer o check-in)`,
    `{recompensa} = ${clean(p.recompensa)} (${p.recompensa.length} caracteres; no 6º selo da cartela)`,
    "Pratos (cite por referência):",
    ...[...itemByAlias].map(([a, m]) => `  {prato:${a}} = ${clean(m.name)} (${m.name.length} caracteres)`),
    // Tom do dono (D138): dado delimitado no conteúdo do usuário, nunca no `system`.
    ...(p.tone ? ["", `Preferência de estilo do dono (só estilo; as regras acima prevalecem): «${toneForPrompt(p.tone)}»`] : []),
    // S6.3a (D197): fatos e termos a evitar, delimitados; vazios = nada muda.
    ...ownerDataLines(p.owner),
    // Aprende (D35, flag): exemplos de estilo do próprio dono, já filtrados pelo guard.
    ...examplesBlock(p.examples ?? []),
  ].join("\n");
  const ctx: RefContext = { beneficio: p.beneficio, recompensa: p.recompensa, items: Object.fromEntries([...itemByAlias].map(([a, m]) => [a, m.name])) };
  const system = `${p.instructions ?? KIT_INSTRUCTIONS}\n\n${RULES}${hasOwnerData(p.owner) ? `\n\n${OWNER_DATA_SYSTEM}` : ""}`;
  return { system, text, ctx, itemByAlias, forbidAliases: [], avoid: p.owner?.avoid ?? [] };
}

export function kitGuard(kp: KitPrompt): (d: KitOut) => GuardResult {
  return (d) => {
    const reasons: string[] = [];
    const opts = (maxLen: number) => ({ allowed: ["beneficio", "recompensa", "prato"] as const, maxLen, field: "kit" as const, mode: "ia" as const, forbidDayTurn: true, avoid: kp.avoid ?? [] });
    for (const v of ["A", "B"] as const) {
      for (const f of VERSION_FIELDS) {
        const g = guardText(d[v][f], kp.ctx, opts(FIELD_MAX[f]));
        if (!g.ok) reasons.push(...g.reasons.map((r) => `${v}.${f}:${r}`));
      }
    }
    const g = guardText(d.recado, kp.ctx, opts(FIELD_MAX.recado));
    if (!g.ok) reasons.push(...g.reasons.map((r) => `recado:${r}`));
    if (/convite|volt(e|ar)/i.test([d.A, d.B].flatMap((x) => Object.values(x)).join(" ") + d.recado)) reasons.push("menciona_convite");
    return reasons.length ? { ok: false, reasons } : { ok: true };
  };
}

export function buildKitTask(kp: KitPrompt, models: ModelRef[]): TaskDef<KitOut> {
  return { name: "kit", promptVersion: KIT_PROMPT_VERSION, models, schema: kitSchema, perAttemptTimeoutMs: 20_000, totalBudgetMs: 45_000, maxOutputTokens: 2_000, guard: kitGuard(kp) };
}

/** Apelidos `{prato:pN}` → ids reais antes de gravar. */
export function resolveKit(kp: KitPrompt, d: KitOut): KitTexts {
  const toIds = (t: string) => t.replace(/\{prato:(p\d+)\}/g, (w, a: string) => (kp.itemByAlias.get(a) ? `{prato:${kp.itemByAlias.get(a)!.id}}` : w));
  const v = (x: KitOut["A"]) => ({ titulo: toIds(x.titulo.trim()), subtitulo: toIds(x.subtitulo.trim()), acao: toIds(x.acao.trim()) });
  return { A: v(d.A), B: v(d.B), recado: toIds(d.recado.trim()) };
}
