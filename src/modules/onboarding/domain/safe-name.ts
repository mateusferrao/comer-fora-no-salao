/**
 * S9 (revisão de segurança M1): o nome do restaurante e o nome do prato entram no assunto e no corpo dos e-mails que
 * saem do nosso domínio para qualquer endereço (código de acesso, convite, lembrete). Ao GRAVAR, nada de link, e-mail
 * ou telefone (D174) nem da marca iFood (revisão S4–S6): o remetente compartilhado não pode virar canal de golpe.
 * Revisão S9: marca disfarçada ("iF00d", "ıFood", letras cirílicas) também conta; letra fora do alfabeto latino
 * (depois de tirar acentos e abrir ligaduras como "œ") é recusada junto com a marca.
 */
import { hasContactInfo } from "@/src/modules/salao/domain/contact-info";
import { mentionsIfood } from "@/src/shared/brand";

export type NameProblem = "nome_contato" | "nome_marca" | "item_contato" | "item_marca";

/** Letras latinas que não se decompõem em letra + acento (ficam aceitas, como as acentuadas). */
const LATIN_EXTRA: Record<string, string> = { ı: "i", œ: "oe", æ: "ae", ß: "ss", ø: "o", ł: "l", đ: "d", ð: "d", þ: "th" };

/** NFKC (largura total, "º"), minúsculas, ligaduras abertas, sem acento. */
function latinBase(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ıœæßøłđðþ]/g, (c) => LATIN_EXTRA[c]!)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

/** Marca iFood, também com 0 no lugar de o, 1 ou "ı" no lugar de i, ou com letra fora do alfabeto latino. */
function brandProblem(name: string): boolean {
  const base = latinBase(name);
  if (/[^a-z]/.test(base.replace(/[^\p{L}]/gu, ""))) return true;
  return mentionsIfood(base) || mentionsIfood(base.replace(/0/g, "o").replace(/1/g, "i"));
}

export function restaurantNameProblem(name: string): "nome_contato" | "nome_marca" | null {
  if (brandProblem(name)) return "nome_marca";
  return hasContactInfo(name) ? "nome_contato" : null;
}

export function dishNameProblem(name: string): "item_contato" | "item_marca" | null {
  if (brandProblem(name)) return "item_marca";
  return hasContactInfo(name) ? "item_contato" : null;
}

/** Mensagem de cada recusa (para o Portal mostrar no campo). */
export const NAME_PROBLEM_TEXT: Record<NameProblem, string> = {
  nome_contato: "Tire o telefone, o e-mail, o perfil ou o site do nome do restaurante. O nome vai nos e-mails aos clientes.",
  nome_marca: "Não cite a marca iFood no nome do restaurante e use só letras do nosso alfabeto, com ou sem acento.",
  item_contato: "Tire o telefone, o e-mail, o perfil ou o site do nome do prato. O nome vai nos e-mails aos clientes.",
  item_marca: "Não cite a marca iFood no nome do prato e use só letras do nosso alfabeto, com ou sem acento.",
};
