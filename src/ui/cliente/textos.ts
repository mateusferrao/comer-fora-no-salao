/** Textos do fluxo do cliente montados pelo código (nunca pela IA). Exatos da spec quando há fonte; o resto [C]. */
import { formatDays, formatDaysLong, formatHours } from "@/src/modules/beneficios/domain/slots";
import type { GpsStatus } from "@/src/modules/salao/domain/geo";
import type { CodeView, InviteView } from "@/src/modules/salao/application/views";

export const TXT = {
  linhaConvite: "Faça check-in e você pode ganhar um convite para voltar",
  /** S9: "código do benefício" (para o garçom) × "código de acesso" (do e-mail, para entrar). */
  mostreCodigo: "Mostre este código ao garçom",
  valeHoje: "Vale só hoje",
  /** D171 (texto exato aprovado). */
  privacidade: "Protótipo de case, não é o iFood. Você pode apagar seus dados quando quiser.",
  /** Aceite obrigatório: só o uso dos dados (revisão S4 I5); os interruptores são as escolhas de marketing [C]. */
  // D237: o restaurante vê o contato completo; o consentimento diz isso.
  consentimento: (restaurante: string) =>
    `Aceito que o restaurante ${restaurante} veja meu nome, e-mail e telefone (se eu informar) e registre minhas visitas. O assistente de IA do restaurante pode ver meu primeiro nome e minhas visitas, nunca meu contato.`,
  primeiraVisitaUsada: "Você já usou o benefício da 1ª visita neste restaurante.",
  comoUsarConvite: "Vale só nos dias e horários acima. Ao chegar, faça check-in de novo e mostre ao garçom o código do benefício.",
  /** Interruptor `opt_app` (S9): libera os convites mandados depois da visita (reativação); o da mesa aparece sempre. */
  convitesOutrasDatas: "Convites para outras datas",
  convitesOutrasDatasDica: "O restaurante pode te mandar convites para voltar depois desta visita. Eles aparecem em Sua jornada.",
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

/** "Volte Ter, Qua, Qui · 15h–18h e ganhe Cannoli grátis" (espec. 3.5.4; P-I3). No dia em que vale (S9), o que fazer agora. */
export function inviteSentence(inv: InviteView): string {
  const gain = inv.offer?.gain;
  if (inv.state === "usar_hoje") return gain ? `Mostre o código do convite ao garçom e ganhe ${gain}` : "Mostre o código do convite ao garçom";
  const when = inviteWhen(inv).short;
  if (!gain) return `Volte ${when}`;
  const verb = gain.startsWith("Leve 2") ? "e aproveite:" : "e ganhe";
  return `Volte ${when} ${verb} ${gain}`;
}

/**
 * Validade do convite (S9): o código do convite nunca nasce no dia da emissão (`decide-checkin`), então o convite
 * novo diz o 1º dia em que vale (`nextValidWindow`). Sem esse dia (nenhuma janela antes do fim da validade), só
 * "Vale até dd/mm", como no e-mail (`deliver-messages`): nada de prometer "a partir de amanhã".
 */
export function inviteValidity(inv: Pick<InviteView, "state" | "untilDay" | "firstDay">): string {
  if (inv.state === "novo" && inv.firstDay) return `Vale de ${ddmm(inv.firstDay)} até ${ddmm(inv.untilDay)}`;
  return `Vale até ${ddmm(inv.untilDay)}`;
}

/** Folha do GPS (S9): longe × sem localização (permissão negada, sem resposta ou sem GPS), sem acusar o cliente. */
export function gpsSheet(s: GpsStatus): { title: string; body: string } {
  if (s === "longe") return { title: "Você está no restaurante?", body: "O GPS às vezes erra dentro do salão. Se você já está no restaurante, confirme para continuar." };
  return { title: "Não conseguimos ver sua localização", body: "Tudo bem. Se você está no restaurante, confirme para continuar." };
}

/** Nome do cupom: o ganho ("Panna cotta grátis"); resultados antigos guardaram o tipo e o item separados. */
export function codeTitle(c: Pick<CodeView, "title" | "itemName">): string {
  return c.itemName && !c.title.includes(c.itemName) ? `${c.title} · ${c.itemName}` : c.title;
}
