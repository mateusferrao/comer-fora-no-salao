/**
 * Mensagens dos convites REAIS (S4.4 — D155): no app sempre; o e-mail fica `pendente` só se o cliente tem e-mail,
 * aceitou (chave-mestra + preferência por tipo — D198) e o dono deixou aquele tipo ligado (D196). Senão `pulado`
 * com o motivo (`email_skip_reason`). As configurações são lidas em TS (sem cast de jsonb no SQL — revisão I7).
 */
import { sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { parseNotifySettings } from "@/src/modules/config/domain/notify-settings";
import { emailDecision, parseEmailPrefs, type MessageKind } from "../domain/email-prefs";

export type { MessageKind };

type Row = { invite_id: string; customer_id: string; restaurant_id: string; opt_email: boolean | null; email_prefs: unknown; has_email: boolean; settings: unknown };

/** Cria as mensagens dos convites REAIS dados (o grupo de controle nunca recebe nada). Devolve quantos e-mails ficaram pendentes. */
export async function queueInviteMessages(ex: Executor, p: { inviteIds: string[]; kind: MessageKind; now: Date }): Promise<number> {
  if (!p.inviteIds.length) return 0;
  const rows = (await ex.execute(sql`
    select i.id as invite_id, i.customer_id, i.restaurant_id, rc.opt_email, rc.email_prefs, (cc.email_enc is not null) as has_email, r.notify_settings as settings
    from invites i
    join restaurants r on r.id = i.restaurant_id
    left join restaurant_customers rc on rc.restaurant_id = i.restaurant_id and rc.customer_id = i.customer_id
    left join customer_contacts cc on cc.customer_id = i.customer_id
    where i.id in (${sql.join(p.inviteIds.map((id) => sql`${id}::uuid`), sql`, `)}) and i.arm = 'convidavel'`)) as unknown as { rows: Row[] };
  if (!rows.rows.length) return 0;
  const values = rows.rows.map((r) => {
    const d = emailDecision({ kind: p.kind, hasEmail: !!r.has_email, optEmail: r.opt_email ?? false, prefs: parseEmailPrefs(r.email_prefs), owner: parseNotifySettings(r.settings).emails });
    return sql`(${r.customer_id}::uuid, ${r.restaurant_id}::uuid, ${r.invite_id}::uuid, ${p.kind}, ${p.now.toISOString()}, ${d.status}, ${d.status === "pulado" ? d.reason : null})`;
  });
  const res = (await ex.execute(sql`
    insert into customer_messages (customer_id, restaurant_id, invite_id, kind, created_at, email_status, email_skip_reason)
    values ${sql.join(values, sql`, `)}
    on conflict do nothing
    returning email_status`)) as unknown as { rows: Array<{ email_status: string }> };
  return res.rows.filter((r) => r.email_status === "pendente").length;
}
