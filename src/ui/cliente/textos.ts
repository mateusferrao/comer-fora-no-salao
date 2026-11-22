/** Textos do fluxo do cliente montados pelo código (nunca pela IA). Exatos da spec quando há fonte; o resto [C]. */
import { formatDays, formatDaysLong, formatHours } from "@/src/modules/beneficios/domain/slots";
import type { InviteView, OfferView } from "@/src/modules/salao/application/views";

export const TXT = {
  linhaConvite: "Faça check-in e você pode ganhar um convite para voltar",
  gpsTitulo: "Parece que você não está no restaurante!",
  gpsCorpo: "O GPS pode não ser preciso. Se você já está no restaurante, confirme abaixo para tentarmos validar seu benefício novamente.",
  informeCodigo: "Informe este código ao garçom",
  valeHoje: "Vale só hoje",
  /** D171 (texto exato aprovado). */
  privacidade: "Protótipo de case, não é o iFood. Você pode apagar seus dados quando quiser.",
  /** Aceite obrigatório: só o uso dos dados (revisão S4 I5); os interruptores são as escolhas de marketing [C]. */
  // D237: o restaurante vê o contato completo; o consentimento diz isso.
  consentimento: (restaurante: string) => `Aceito que ${restaurante} veja meu nome, e-mail e telefone e registre minhas visitas. O assistente de IA do restaurante pode ver meu primeiro nome e minhas visitas, nunca meu contato.`,
  primeiraVisitaUsada: "O benefício de 1ª visita vale só no primeiro check-in.",
  comoUsarConvite:
    "Vale só nos dias e horários acima. Chegando ao restaurante, faça check-in aqui no app e o código do benefício aparece para mostrar ao garçom.",
} as const;

/** "dd/mm" de um dia `YYYY-MM-DD`. */
export function ddmm(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

export function inviteWhen(inv: Pick<InviteView, "days" | "startMin" | "endMin">): { short: string; long: string } {
  return {
    short: `${formatDays(inv.days)} · ${formatHours(inv.startMin, inv.endMin)}`,
    long: `${formatDaysLong(inv.days)}, das ${formatHours(inv.startMin, inv.endMin).replace("–", " às ")}`,
  };
}

/** "Volte Ter, Qua, Qui · 15h–18h e ganhe Cannoli grátis" (espec. 3.5.4; P-I3). */
export function inviteSentence(inv: InviteView): string {
  const when = inviteWhen(inv).short;
  const gain = inv.offer?.gain;
  if (!gain) return `Volte ${when}`;
  const verb = gain.startsWith("Leve 2") ? "e aproveite:" : "e ganhe";
  return `Volte ${when} ${verb} ${gain}`;
}

export function offerSubtitle(o: OfferView): string {
  return `${o.subtitle} · ${o.itemName}`;
}
