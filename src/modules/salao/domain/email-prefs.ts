/**
 * Quem recebe cada e-mail ao cliente (S6.1 — D196, D198). Ordem: sem endereço → chave-mestra do cliente
 * (`opt_email`) → preferência por tipo do cliente → escolha do dono por tipo. "Convites" cobre o convite da mesa e o
 * convite de volta (reativação); "Lembretes", só o lembrete. O convite no app aparece sempre (fora daqui).
 */
export type MessageKind = "convite_mesa" | "reativacao" | "lembrete";
export type EmailPrefs = { convites: boolean; lembretes: boolean };
export type OwnerEmails = { convite: boolean; lembrete: boolean; reativacao: boolean };
export type SkipReason = "sem_email" | "cliente_desligou" | "dono_desligou" | "contato_no_texto" | "sem_oferta" | "teto_diario" | "sem_envio";
export type EmailDecision = { status: "pendente" } | { status: "pulado"; reason: SkipReason };

export function parseEmailPrefs(raw: unknown): EmailPrefs {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { convites: typeof o.convites === "boolean" ? o.convites : true, lembretes: typeof o.lembretes === "boolean" ? o.lembretes : true };
}

export function emailDecision(p: { kind: MessageKind; hasEmail: boolean; optEmail: boolean; prefs: EmailPrefs; owner: OwnerEmails }): EmailDecision {
  if (!p.hasEmail) return { status: "pulado", reason: "sem_email" };
  if (!p.optEmail) return { status: "pulado", reason: "cliente_desligou" };
  const customerWants = p.kind === "lembrete" ? p.prefs.lembretes : p.prefs.convites;
  if (!customerWants) return { status: "pulado", reason: "cliente_desligou" };
  const ownerAllows = p.kind === "lembrete" ? p.owner.lembrete : p.kind === "reativacao" ? p.owner.reativacao : p.owner.convite;
  if (!ownerAllows) return { status: "pulado", reason: "dono_desligou" };
  return { status: "pendente" };
}
