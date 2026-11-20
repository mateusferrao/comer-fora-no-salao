/**
 * Conteúdo do plano da semana, versão 1 (espec. 3.7). A S1 grava os 2 planos fixos da vitrine (D224);
 * a S3 gera planos reais com o mesmo formato (e versiona se precisar mudar).
 * Os textos usam só referências ({fato:chave}, {prato:id}, {horario:slotId}, {oferta}); o código resolve,
 * contra o SNAPSHOT de fatos guardado no próprio plano.
 */
import { z } from "zod";
import { OFFER_KINDS } from "@/src/modules/beneficios/domain/offers";

export const VERDICTS = ["manter", "trocar", "cedo_demais"] as const;

const offerRef = z.object({ kind: z.enum(OFFER_KINDS), itemId: z.string(), pct: z.number().int().optional() });

export const planContentSchema = z.object({
  version: z.literal(1),
  facts: z.record(z.string(), z.union([z.number(), z.string()])),
  candidates: z.array(
    z.object({
      slotId: z.string(),
      // Pode vir vazia: restaurante novo sem item que sirva para a faixa (o dono escolhe à mão — S2).
      options: z.array(z.object({ id: z.string(), offer: offerRef, score: z.number(), unitCostCents: z.number().int(), weeklyCap: z.number().int() })),
    }),
  ),
  choices: z.array(
    z.object({
      slotId: z.string(),
      /** Id de uma das `options` da faixa, ou `manual:<kind>:<itemId>` quando o dono escolheu outra oferta (S2). */
      candidateId: z.string(),
      // Tamanho guardado com as referências (ids longos); o limite de 160/400 vale para o texto JÁ RENDERIZADO,
      // conferido pelos guardrails antes de gravar (revisão da S2: {horario:<uuid>} soma ~35 caracteres).
      textoConvite: z.string().max(800),
      justificativa: z.string().max(1200),
    }),
  ),
  order: z.array(z.string()),
  learned: z.array(z.object({ ofertaKey: z.string(), verdict: z.enum(VERDICTS), texto: z.string().max(300) })),
  generatedBy: z.enum(["ia", "sem_ia", "fixo"]),
});
export type PlanContent = z.infer<typeof planContentSchema>;

const REF = /\{(fato|prato|horario):([^}]+)\}|\{(oferta)\}/g;

/** Referências usadas num texto (para conferir que todas existem). */
export function referencesIn(text: string): Array<{ kind: "fato" | "prato" | "horario" | "oferta"; key: string }> {
  const out: Array<{ kind: "fato" | "prato" | "horario" | "oferta"; key: string }> = [];
  for (const m of text.matchAll(REF)) out.push(m[3] ? { kind: "oferta", key: "" } : { kind: m[1] as "fato" | "prato" | "horario", key: m[2]! });
  return out;
}

/** Confere que todo {fato:x} existe no snapshot, todo {horario:x} é uma faixa e todo {prato:x} é um item. */
export function unknownReferences(plan: PlanContent, itemIds: ReadonlySet<string>, slotIds: ReadonlySet<string>): string[] {
  const texts = [...plan.choices.flatMap((c) => [c.textoConvite, c.justificativa]), ...plan.learned.map((l) => l.texto)];
  const bad: string[] = [];
  for (const t of texts) {
    for (const r of referencesIn(t)) {
      if (r.kind === "fato" && !(r.key in plan.facts)) bad.push(`fato:${r.key}`);
      if (r.kind === "horario" && !slotIds.has(r.key)) bad.push(`horario:${r.key}`);
      if (r.kind === "prato" && !itemIds.has(r.key)) bad.push(`prato:${r.key}`);
    }
  }
  return bad;
}

/** Monta o conteúdo do plano a partir das colunas de `weekly_plans` (o inverso do que o seed e a S2 gravam). */
export function planContentFromRow(row: { facts: unknown; candidates: unknown; choices: unknown; texts: unknown; learned: unknown }) {
  const t = (row.texts ?? {}) as { order?: unknown; generatedBy?: unknown; version?: unknown };
  return planContentSchema.safeParse({ version: t.version, facts: row.facts, candidates: row.candidates, choices: row.choices, order: t.order, learned: row.learned, generatedBy: t.generatedBy });
}
