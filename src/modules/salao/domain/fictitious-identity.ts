/** Identidade fictícia pré-preenchida (D31): nome inventado + telefone com DDD 00. */
const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabriela", "Heitor", "Isabela", "João", "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Rafael", "Sofia", "Tiago", "Vitória", "Yuri"];
const LAST = ["Fictício", "Exemplo", "Teste", "Demonstração", "Protótipo", "Simulado"];

export function fictitiousIdentity(rng: () => number): { name: string; phone: string } {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)]!;
  const digits = Array.from({ length: 8 }, () => Math.floor(rng() * 10)).join("");
  return { name: `${pick(FIRST)} ${pick(LAST)}`, phone: `(00) 9${digits.slice(0, 4)}-${digits.slice(4)}` };
}
