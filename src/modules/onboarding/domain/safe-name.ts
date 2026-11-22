/**
 * S9 (revisão de segurança M1): o nome do restaurante e o nome do prato entram no assunto e no corpo dos e-mails que
 * saem do nosso domínio para qualquer endereço (código de acesso, convite, lembrete). Ao GRAVAR, nada de link, e-mail
 * ou telefone (D174) nem da marca iFood (revisão S4–S6): o remetente compartilhado não pode virar canal de golpe.
 */
import { hasContactInfo } from "@/src/modules/salao/domain/contact-info";
import { mentionsIfood } from "@/src/shared/brand";

export type NameProblem = "nome_contato" | "nome_marca" | "item_contato" | "item_marca";

export function restaurantNameProblem(name: string): "nome_contato" | "nome_marca" | null {
  if (mentionsIfood(name)) return "nome_marca";
  return hasContactInfo(name) ? "nome_contato" : null;
}

export function dishNameProblem(name: string): "item_contato" | "item_marca" | null {
  if (mentionsIfood(name)) return "item_marca";
  return hasContactInfo(name) ? "item_contato" : null;
}

/** Mensagem de cada recusa (para o Portal mostrar no campo). */
export const NAME_PROBLEM_TEXT: Record<NameProblem, string> = {
  nome_contato: "Tire o telefone, o e-mail ou o site do nome do restaurante. O nome vai nos e-mails aos clientes.",
  nome_marca: "O nome do restaurante não pode citar a marca iFood.",
  item_contato: "Tire o telefone, o e-mail ou o site do nome do prato. O nome vai nos e-mails aos clientes.",
  item_marca: "O nome do prato não pode citar a marca iFood.",
};
