/**
 * Textos-modelo de "o que aprendemos" por veredito (modo sem IA e planos fixos da vitrine — D220, D145) e a
 * justificativa-modelo (modo sem IA e linha de base da T3 — revisão T-I6). Só referências: o código escreve os
 * números. `alias` = apelido da faixa nas chaves de fato (A, B…); `slotRef` = o que vai em `{horario:…}`.
 */
import type { Verdict } from "@/src/modules/analytics/domain/verdict";

export const usageFactKey = (alias: string) => `uso7d_${alias}_pct`;
export const issuedFactKey = (alias: string) => `convites7d_${alias}`;

export function learnedTemplate(v: Verdict, alias: string, slotRef: string): string {
  if (v === "manter") return `{fato:${usageFactKey(alias)}} dos convites de {horario:${slotRef}} foram usados em até uma semana: a oferta está funcionando.`;
  if (v === "trocar") return `Só {fato:${usageFactKey(alias)}} dos convites de {horario:${slotRef}} foram usados em até uma semana: vale testar outra oferta.`;
  return `Ainda há poucos convites com uma semana em {horario:${slotRef}} para julgar esta oferta.`;
}

export function justificationTemplate(alias: string, slotRef: string, facts: Record<string, number | string>): string {
  const parts: string[] = [];
  if (facts[`faixa_${alias}_intensidade`] !== undefined) parts.push(`A faixa de {horario:${slotRef}} está {fato:faixa_${alias}_intensidade}`);
  if (facts[`faixa_${alias}_mesas`] !== undefined) parts.push(`você quer {fato:faixa_${alias}_mesas} a mais por semana`);
  const head = parts.length ? `${parts.join(" e ")}. ` : "";
  return `${head}Esta é a oferta válida com a melhor relação entre o que o cliente ganha e o custo para você.`;
}
