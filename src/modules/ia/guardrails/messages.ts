/**
 * Motivos do guardrail → mensagens que dizem o que fazer (ajuste de 21/11: validação na hora, no campo). Função pura,
 * usada no Portal (pacote, configurações, kit) e no erro do servidor ao ativar.
 */
import type { RefContext } from "@/src/modules/textos/domain/references";
import { guardText, type TextGuard } from "./index";

export type TextIssues = { errors: string[]; warnings: string[] };

const SOFT_WARNING =
  "O texto cita número, preço ou promessa (ex.: “grátis”). Quem decide o benefício é a oferta acima; o garçom valida só ela.";

export function reasonMessage(
  reason: string,
  o: { maxLen: number; label?: string } = { maxLen: 160 },
): string {
  const what = o.label ?? "o texto do convite";
  if (reason === "vazio") return `Escreva ${what} ou volte ao texto sugerido.`;
  if (reason.startsWith("tamanho:")) {
    const n = Number(reason.slice("tamanho:".length).split(">")[0]);
    return `Está com ${n} caracteres; o limite é ${o.maxLen}. Tire ${n - o.maxLen}.`;
  }
  if (reason === "pii")
    return "Tire e-mail, telefone ou CPF: o convite vai para muitos clientes.";
  if (reason === "formato")
    return "Tire os sinais < > { }: eles não aparecem como você espera para o cliente.";
  if (reason.startsWith("referencia:"))
    return `A marcação {${reason.slice("referencia:".length).replace(/ \(.*\)$/, "")}} não existe. Escreva o texto sem chaves ou volte ao texto sugerido.`;
  if (reason.startsWith("dia_turno:"))
    return `Tire “${reason.slice("dia_turno:".length)}”: este texto vai para todos os clientes, então não pode citar dia nem turno.`;
  if (reason.startsWith("item_do_convite:"))
    return "Tire o prato do convite de volta: este texto vai para todos os clientes.";
  if (reason.startsWith("evitar:"))
    return `O texto usa “${reason.slice("evitar:".length)}”, que você pediu para evitar.`;
  if (reason === "numero" || reason.startsWith("proibida:"))
    return SOFT_WARNING;
  return "Ajuste o texto ou volte ao texto sugerido.";
}

export function textIssues(
  g: TextGuard,
  o: { maxLen: number; label?: string },
): TextIssues {
  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    errors: g.ok ? [] : uniq(g.reasons.map((r) => reasonMessage(r, o))),
    warnings: uniq(g.warnings.map((r) => reasonMessage(r, o))),
  };
}

/** Texto do convite escrito pelo dono (D125: números e promessas só avisam). Mesma regra do servidor ao salvar. */
export function inviteIssues(text: string, ctx: RefContext): TextIssues {
  return textIssues(
    guardText(text, ctx, {
      allowed: ["prato", "horario", "oferta"],
      maxLen: 160,
      field: "textoConvite",
      mode: "dono",
    }),
    { maxLen: 160 },
  );
}
