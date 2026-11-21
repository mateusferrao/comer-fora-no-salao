/**
 * D237: clientes simulados criados antes do contato completo (só nome + 4 últimos do telefone) ganham contato fictício
 * óbvio — telefone com DDD 00 e os mesmos 4 últimos; e-mail em exemplo.invalid (sem `email_hmac`). Idempotente: só
 * toca quem ainda não tem `phone_enc` ou `email_enc`. Em lotes, no boot (depois do seed).
 */
import { sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { encryptEmail, encryptPhone } from "@/src/shared/crypto";
import { fakeEmail, fakePhone } from "@/src/modules/salao/domain/phone";

const BATCH = 500;

export async function backfillSimulatedContacts(db: Db): Promise<number> {
  let total = 0;
  for (;;) {
    const res = (await db.execute(sql`
      select cc.customer_id, cc.name, cc.phone_last4, cc.phone_enc is null as need_phone, cc.email_enc is null as need_email
      from customer_contacts cc
      join customers c on c.id = cc.customer_id
      where c.simulation_run_id is not null and (cc.phone_enc is null or cc.email_enc is null)
      limit ${BATCH}`)) as unknown as { rows: Array<{ customer_id: string; name: string | null; phone_last4: string | null; need_phone: boolean; need_email: boolean }> };
    if (!res.rows.length) return total;
    const values = res.rows.map((r) => {
      const name = r.name?.trim() || "Cliente";
      const phone = r.need_phone ? encryptPhone(fakePhone(r.customer_id, r.phone_last4 ?? "0000")) : null;
      const email = r.need_email ? encryptEmail(fakeEmail(name, r.customer_id)) : null;
      return sql`(${r.customer_id}::uuid, ${phone}, ${email}, ${name})`;
    });
    await db.execute(sql`
      update customer_contacts cc
      set phone_enc = coalesce(cc.phone_enc, v.phone_enc), email_enc = coalesce(cc.email_enc, v.email_enc), name = coalesce(nullif(trim(cc.name), ''), v.name)
      from (values ${sql.join(values, sql`, `)}) as v(customer_id, phone_enc, email_enc, name)
      where cc.customer_id = v.customer_id`);
    total += res.rows.length;
  }
}
