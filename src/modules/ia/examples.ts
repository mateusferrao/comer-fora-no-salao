/**
 * "Aprende" (D35; flag `aprende`): textos que o próprio dono escreveu ou aprovou viram exemplos de ESTILO no
 * conteúdo do usuário (nunca no `system`), só do mesmo restaurante e só se passam no guard em modo `ia`.
 * As referências viram marcadores genéricos ({prato}, {horario}…): o modelo copia o tom, não o conteúdo.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { ownerEdits } from "@/src/db/schema";

export const MAX_EXAMPLES = 3;

export function styleExample(text: string): string {
  return text.replace(/\{(prato|horario|fato):[^}]+\}/g, "{$1}").replace(/[«»<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
}

export function examplesBlock(examples: readonly string[]): string[] {
  if (!examples.length) return [];
  return ["", "Textos que o dono já escreveu ou aprovou (só para o estilo; não copie; as regras acima prevalecem):", ...examples.map((e) => `  «${e}»`)];
}

/** Últimas edições finais do dono (dos tipos pedidos) que passam no guard; sem repetidas. */
export async function ownerExamples(ex: Executor, restaurantId: string, kinds: string[], passes: (raw: string) => boolean, n = MAX_EXAMPLES): Promise<string[]> {
  const rows = await ex
    .select({ final: ownerEdits.final })
    .from(ownerEdits)
    .where(and(eq(ownerEdits.restaurantId, restaurantId), inArray(ownerEdits.kind, kinds)))
    .orderBy(desc(ownerEdits.at))
    .limit(30);
  const out: string[] = [];
  for (const r of rows) {
    if (typeof r.final !== "string" || !r.final.trim() || !passes(r.final)) continue;
    const s = styleExample(r.final);
    if (!out.includes(s)) out.push(s);
    if (out.length >= n) break;
  }
  return out;
}
