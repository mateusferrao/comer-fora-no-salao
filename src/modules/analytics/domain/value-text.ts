/**
 * Frases do topo em R$ que se repetem no painel (Visão geral) e no resumo por e-mail (S9, revisão de produto): uma
 * fonte só. Os valores chegam já formatados por quem chama.
 */
import type { Topline } from "./value";

export const SWAP_OFFER_CTA = "Trocar a oferta no plano da semana";

/** Intervalo da margem cruza o zero (A5): ainda pode ser acaso; nunca promete lucro. */
export function crossZeroMoneyText(lo: string, hi: string): string {
  return `Em reais, ainda pode ser acaso: o resultado fica entre ${lo} e ${hi}, já descontado o custo dos convites.`;
}

/** "Trocar a oferta no plano da semana": margem negativa, ou margem incerta com visitas a menos. */
export function showSwapOffer(t: Topline): boolean {
  if (t.kind === "causal_negativo") return true;
  return t.kind === "causal_cruza_zero" && t.visitas === "negativo";
}
