/**
 * Tarefa 4 — revisor (espec. 4.4; flag `revisor`): rubrica → `ok | atencao | bloquear` + motivos, de um
 * provedor DIFERENTE dos dois do laço do kit/plano. Roda depois da resposta; enquanto revisa (até 20 s),
 * aprovar e imprimir ficam bloqueados; depois disso, "não revisado" libera. Falha do revisor nunca bloqueia.
 */
import { z } from "zod";
import type { ModelRef } from "../gateway";
import type { TaskDef } from "../run-task";

export const REVIEWER_PROMPT_VERSION = "revisor-v2";
export const REVIEW_WAIT_MS = 20_000;

export const REVIEWER_SYSTEM = `Você revisa textos curtos que um restaurante vai mostrar a clientes (peças no salão, convites) e ao dono (justificativas). Português do Brasil.
Responda em JSON com "veredito" e até 3 "motivos" curtos (até 120 caracteres cada, em português simples, para o dono).
- Os dias, horários, pratos e ofertas listados em "Ofertas válidas" foram escritos pelo sistema e estão certos: citar esse prato, esse horário ou essa oferta NÃO é problema.
- "bloquear": promete algo além da oferta descrita (desconto, brinde ou condição que não está nela); inventa preço, número ou prazo; é ofensivo, discriminatório ou constrangedor; pede ou expõe dado pessoal; cita marca ou restaurante concorrente.
- "atencao": erro de português, frase confusa, tom estranho para um restaurante, ou texto que pode ser mal interpretado.
- "ok": nenhum dos casos acima. Sem motivos.
Avalie só o que está escrito; não reescreva.`;

export const reviewerSchema = z.object({ veredito: z.enum(["ok", "atencao", "bloquear"]), motivos: z.array(z.string().max(160)).max(3) });
export type ReviewOut = z.infer<typeof reviewerSchema>;
export type ReviewStatus = ReviewOut["veredito"] | "revisando" | "nao_revisado";
export type StoredReview = { status: ReviewStatus; reasons: string[]; at: string };

export function buildReviewerText(p: { restaurantName: string; offer: string; texts: Array<{ label: string; text: string }> }): string {
  const clean = (s: string) => s.replace(/[«»]/g, "").replace(/\s+/g, " ").trim().slice(0, 400);
  return [`Restaurante: ${clean(p.restaurantName)}`, `Ofertas válidas (escritas pelo sistema): ${clean(p.offer)}`, "", "Textos:", ...p.texts.map((t) => `- ${clean(t.label)}: «${clean(t.text)}»`)].join("\n");
}

export function buildReviewerTask(models: ModelRef[]): TaskDef<ReviewOut> {
  return { name: "revisor", promptVersion: REVIEWER_PROMPT_VERSION, models, schema: reviewerSchema, perAttemptTimeoutMs: 12_000, totalBudgetMs: 18_000, maxOutputTokens: 800 };
}

/** Estado efetivo: "revisando" há mais de 20 s vira "não revisado" (libera). */
export function effectiveReview(r: StoredReview | null | undefined, now: Date): StoredReview | null {
  if (!r) return null;
  if (r.status === "revisando" && now.getTime() - new Date(r.at).getTime() > REVIEW_WAIT_MS) return { ...r, status: "nao_revisado" };
  return r;
}

/** Bloqueia aprovar/imprimir? Só "bloquear" e "revisando" dentro da espera. */
export function reviewBlocks(r: StoredReview | null | undefined, now: Date): boolean {
  const e = effectiveReview(r, now);
  return e?.status === "bloquear" || e?.status === "revisando";
}
