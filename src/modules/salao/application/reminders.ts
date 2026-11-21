/**
 * Lembrete do convite (S6.1 — D189): 1 por convite REAL ativo, só no 1º dia em que o código pode nascer, a partir
 * de X h antes do início da janela (escolha do dono; nunca antes das 07h) e até o início. Quem recebe é decidido em
 * `queueInviteMessages` (consentimento, preferência por tipo, escolha do dono); o índice único (invite, kind)
 * garante 1 por convite mesmo com 2 tiques ao mesmo tempo.
 */
import { sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { reminderDue } from "@/src/modules/agendador/domain/schedule";
import { parseNotifySettings } from "@/src/modules/config/domain/notify-settings";
import { daySP } from "@/src/shared/tz";
import { addDaysSP } from "@/src/shared/week";
import { nextValidWindow } from "../domain/invite-window";
import { queueInviteMessages } from "./queue-messages";

type Row = { id: string; restaurant_id: string; slot_snapshot: Slot; issued_day: string; issued_at: string; expires_at: string; settings: unknown };

/** Enfileira os lembretes devidos agora; devolve os convites por restaurante (o envio sai depois, fora da transação). */
export async function queueDueReminders(db: Db, p: { now: Date; restaurantId?: string }): Promise<Record<string, string[]>> {
  const today = daySP(p.now);
  const scope = p.restaurantId ? sql`and i.restaurant_id = ${p.restaurantId}` : sql``;
  const rows = (await db.execute(sql`
    select i.id, i.restaurant_id, i.slot_snapshot, i.issued_day, i.issued_at, i.expires_at, r.notify_settings as settings
    from invites i
    join restaurants r on r.id = i.restaurant_id and r.status = 'ativo'
    join owners o on o.id = r.owner_id and o.via <> 'e2e'
    where i.status = 'ativo' and i.arm = 'convidavel' and i.simulation_run_id is null
      and i.issued_day < ${today} and i.issued_day >= ${addDaysSP(today, -9)} and i.expires_at > ${p.now.toISOString()}
      and not exists (select 1 from customer_messages m where m.invite_id = i.id and m.kind = 'lembrete')
      ${scope}
    order by i.issued_day desc
    limit 500`)) as unknown as { rows: Row[] };
  const due: Record<string, string[]> = {};
  for (const r of rows.rows) {
    const s = parseNotifySettings(r.settings);
    // 1º dia válido: a janela calculada a partir da emissão (não "a próxima a partir de agora").
    const w = nextValidWindow({ slot: r.slot_snapshot, issuedDay: r.issued_day, expiresAt: new Date(r.expires_at), now: new Date(r.issued_at) });
    if (!w || w.day !== today || !reminderDue(p.now, w.start, s.lembreteHorasAntes)) continue;
    (due[r.restaurant_id] ??= []).push(r.id);
  }
  for (const ids of Object.values(due)) await queueInviteMessages(db, { inviteIds: ids, kind: "lembrete", now: p.now });
  return due;
}
