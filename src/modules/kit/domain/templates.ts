/**
 * Kit de divulgação (espec. 3.4): display (meia A4) e cartaz (A4) = um modelo visual em 2 tamanhos, 2 versões
 * (A/B) com QR próprio; cartão do garçom (¼ de A4, sem QR, só sobre o "agora"). A IA escreve só as chamadas;
 * benefício e recompensa entram por referência; o convite aparece só como linha genérica (holdout — D223).
 */
export const PIECE_KINDS = ["display", "cartaz", "garcom", "porta_conta"] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];
export const PIECE_LABEL: Record<PieceKind, string> = { display: "Display de mesa (meia A4)", cartaz: "Cartaz (A4)", garcom: "Cartão do garçom (¼ de A4)", porta_conta: "Porta-conta (⅓ de A4)" };
/** Peças com texto fixo do código (1 versão, sem IA nem revisor). */
export const FIXED_KINDS: readonly PieceKind[] = ["garcom", "porta_conta"];

/**
 * Porta-conta (S6.4 — D192): lido na hora de pagar. O benefício vale só na 1ª visita (revisão de produto I6) e o
 * convite aparece só pela linha genérica (holdout). Texto modelo do código, com referências.
 */
export const BILL_TEMPLATE = {
  titulo: "Antes de pagar, faça check-in",
  subtitulo: "Na 1ª visita, {beneficio}. Cada visita vale 1 selo e, com 6 selos, {recompensa}.",
  acao: "Aponte a câmera para o QR",
} as const;

export const VERSION_FIELDS = ["titulo", "subtitulo", "acao"] as const;
export type VersionField = (typeof VERSION_FIELDS)[number];
/** Limites medidos DEPOIS de renderizar as referências [C] (título 50 em vez de 40: o benefício renderizado já ocupa ~20). */
export const FIELD_MAX: Record<VersionField | "recado", number> = { titulo: 50, subtitulo: 90, acao: 40, recado: 120 };

export type VersionTexts = Record<VersionField, string>;
export type KitTexts = { A: VersionTexts; B: VersionTexts; recado: string };

/** Linha fixa do código sobre o convite: genérica, sem oferta nem horário. */
export const INVITE_LINE = "Faça check-in e você pode ganhar um convite para voltar";

/**
 * Cartão do garçom (≤ 2 frases, só o "agora"; não menciona o convite para não contaminar o holdout). S9: o benefício
 * vale só na 1ª visita, e o código é o "do benefício" (o de acesso, do e-mail, não serve ao garçom).
 */
export const WAITER_TEMPLATE = "Na 1ª visita, quem faz check-in pelo QR da mesa ganha {beneficio}. Peça ao cliente o código do benefício e valide no Portal.";
/** Texto gravado nos kits feitos antes da S9 (prometia o benefício a todo check-in): sai com o texto novo. */
const LEGACY_WAITER_TEMPLATE = "Hoje, quem faz check-in ganha {beneficio}. Peça o código ao cliente e valide no Portal.";

/** Com o link do garçom ligado (S6.2 — D190), o cartão impresso aponta para ele; o texto gravado não muda. */
export function waiterPhrase(frase: string, waiterLink: boolean): string {
  const f = frase === LEGACY_WAITER_TEMPLATE ? WAITER_TEMPLATE : frase;
  return waiterLink ? f.replace("valide no Portal", "valide no link do garçom") : f;
}

/** Textos modelo do modo sem IA (rotulados na tela). */
export const FALLBACK_KIT: KitTexts = {
  // S9: "primeira" por extenso (o texto do kit não leva algarismo); o benefício vale só na 1ª visita.
  A: { titulo: "Na primeira visita, ganhe {beneficio}", subtitulo: "Leia o QR, faça check-in e mostre o código ao garçom.", acao: "Aponte a câmera para o QR" },
  B: { titulo: "{beneficio} no seu primeiro check-in", subtitulo: "Cada visita vale um selo. Junte selos e ganhe {recompensa}.", acao: "Leia o QR e faça check-in" },
  recado: "Obrigado por estar aqui. Boa refeição.",
};

export function sentenceCount(text: string): number {
  return text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length;
}
