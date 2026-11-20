/**
 * Kit de divulgação (espec. 3.4): display (meia A4) e cartaz (A4) = um modelo visual em 2 tamanhos, 2 versões
 * (A/B) com QR próprio; cartão do garçom (¼ de A4, sem QR, só sobre o "agora"). A IA escreve só as chamadas;
 * benefício e recompensa entram por referência; o convite aparece só como linha genérica (holdout — D223).
 */
export const PIECE_KINDS = ["display", "cartaz", "garcom"] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];
export const PIECE_LABEL: Record<PieceKind, string> = { display: "Display de mesa (meia A4)", cartaz: "Cartaz (A4)", garcom: "Cartão do garçom (¼ de A4)" };

export const VERSION_FIELDS = ["titulo", "subtitulo", "acao"] as const;
export type VersionField = (typeof VERSION_FIELDS)[number];
/** Limites medidos DEPOIS de renderizar as referências [C] (título 50 em vez de 40: o benefício renderizado já ocupa ~20). */
export const FIELD_MAX: Record<VersionField | "recado", number> = { titulo: 50, subtitulo: 90, acao: 40, recado: 120 };

export type VersionTexts = Record<VersionField, string>;
export type KitTexts = { A: VersionTexts; B: VersionTexts; recado: string };

/** Linha fixa do código sobre o convite: genérica, sem oferta nem horário. */
export const INVITE_LINE = "Faça check-in e você pode ganhar um convite para voltar";

/** Cartão do garçom (≤ 2 frases, só o "agora"; não menciona o convite para não contaminar o holdout). */
export const WAITER_TEMPLATE = "Hoje, quem faz check-in ganha {beneficio}. Peça o código ao cliente e valide no Portal.";

/** Textos modelo do modo sem IA (rotulados na tela). */
export const FALLBACK_KIT: KitTexts = {
  A: { titulo: "Faça check-in e ganhe {beneficio}", subtitulo: "Leia o QR, faça check-in no app e mostre o código ao garçom.", acao: "Aponte a câmera para o QR" },
  B: { titulo: "Ganhe {beneficio} no seu check-in", subtitulo: "Junte selos a cada visita e ganhe {recompensa}.", acao: "Leia o QR e faça check-in" },
  recado: "Obrigado por estar aqui. Boa refeição!",
};

export function sentenceCount(text: string): number {
  return text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length;
}
