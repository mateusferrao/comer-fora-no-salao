/**
 * Clientes como segmentos acionáveis (espec. 3.6; planejamento S3 §4.5). Só o restaurante da sessão; nome como
 * "primeiro nome + inicial" (D106) e telefone só com os 4 últimos dígitos. Nunca o HMAC.
 */
import { sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { daySP } from "@/src/shared/tz";
import { addDaysSP } from "@/src/shared/week";
import { segmentOf, SEGMENTS, type Segment } from "../domain/segments";
import type { ReactivationCustomer } from "@/src/modules/planos/domain/reactivation";

export type CustomerRow = {
  id: string;
  displayName: string;
  phoneHint: string;
  firstDay: string | null;
  lastDay: string | null;
  visits: number;
  stamps: number;
  piece: string | null;
  /** S4: canais reais são e-mail e app; WhatsApp/Push ficam só nas linhas antigas. */
  optIn: { email: boolean; app: boolean; whatsapp: boolean; push: boolean };
  segments: Segment[];
  arm: "convidavel" | "holdout" | null;
  hasActiveInvite: boolean;
};

export type SegmentsView = { counts: Record<Segment, { count: number; optIn: number }>; list: CustomerRow[]; segment: Segment };

import { shortName } from "@/src/shared/name";
export { shortName };

type Row = Record<string, unknown>;

export async function loadCustomerRows(ex: Executor, restaurantId: string, now: Date): Promise<CustomerRow[]> {
  const today = daySP(now);
  const from30 = addDaysSP(today, -29);
  const res = (await ex.execute(sql`
    select rc.customer_id, cc.name, cc.phone_last4, rc.card_stamps, rc.card_completed_day, rc.arm,
           rc.opt_whatsapp, rc.opt_app, rc.opt_push, rc.opt_email, kp.kind as piece_kind, pv.label as piece_label,
           (select count(*) from checkins c where c.restaurant_id = rc.restaurant_id and c.customer_id = rc.customer_id) as visits,
           (select count(*) from checkins c where c.restaurant_id = rc.restaurant_id and c.customer_id = rc.customer_id and c.day_sp >= ${from30}) as visits30,
           (select min(c.day_sp) from checkins c where c.restaurant_id = rc.restaurant_id and c.customer_id = rc.customer_id) as first_day,
           rc.last_checkin_day,
           exists (select 1 from invites i where i.restaurant_id = rc.restaurant_id and i.customer_id = rc.customer_id and i.status in ('ativo', 'suprimido') and i.expires_at > ${now.toISOString()}) as active_any,
           exists (select 1 from invites i where i.restaurant_id = rc.restaurant_id and i.customer_id = rc.customer_id and i.status = 'ativo' and i.expires_at > ${now.toISOString()}) as active_real
    from restaurant_customers rc
    left join customer_contacts cc on cc.customer_id = rc.customer_id
    left join piece_variants pv on pv.id = rc.origin_variant_id
    left join kit_pieces kp on kp.id = pv.piece_id
    where rc.restaurant_id = ${restaurantId}`)) as unknown as { rows: Row[] };
  const PIECE: Record<string, string> = { display: "Display", cartaz: "Cartaz" };
  return res.rows.map((r) => {
    const stamps = r.card_completed_day ? 0 : Number(r.card_stamps ?? 0);
    const visits = Number(r.visits ?? 0);
    const lastDay = (r.last_checkin_day as string | null) ?? null;
    // Para os segmentos, "convite ativo" conta real ou fantasma (a reativação pula os dois); na tela, só o real.
    const segs = segmentOf({ visits, lastDay, stamps, visits30d: Number(r.visits30 ?? 0), hasActiveInvite: !!r.active_real }, today);
    return {
      id: String(r.customer_id),
      displayName: shortName(r.name == null ? null : String(r.name)),
      phoneHint: `•••• ${String(r.phone_last4 ?? "")}`,
      firstDay: (r.first_day as string | null) ?? null,
      lastDay,
      visits,
      stamps,
      piece: r.piece_kind ? `${PIECE[String(r.piece_kind)] ?? String(r.piece_kind)} ${String(r.piece_label)}` : null,
      optIn: { email: !!r.opt_email, app: !!r.opt_app, whatsapp: !!r.opt_whatsapp, push: !!r.opt_push },
      segments: segs,
      arm: (r.arm as CustomerRow["arm"]) ?? null,
      hasActiveInvite: !!r.active_any,
    };
  });
}

/** Uma regra só (revisão técnica S4 B2): aceitou algum canal. */
export const hasOptIn = (c: Pick<CustomerRow, "optIn">) => c.optIn.email || c.optIn.app || c.optIn.whatsapp || c.optIn.push;

export function toReactivationCustomers(rows: readonly CustomerRow[]): ReactivationCustomer[] {
  return rows.map((c) => ({ id: c.id, arm: c.arm, optIn: hasOptIn(c), segments: c.segments, hasActiveInvite: c.hasActiveInvite, lastDay: c.lastDay }));
}

export async function getSegments(ex: Executor, restaurantId: string, now: Date, segment: Segment = "sumiu"): Promise<SegmentsView> {
  const all = await loadCustomerRows(ex, restaurantId, now);
  const counts = Object.fromEntries(SEGMENTS.map((s) => [s, { count: 0, optIn: 0 }])) as SegmentsView["counts"];
  for (const c of all) for (const s of c.segments) {
    counts[s].count++;
    if (hasOptIn(c)) counts[s].optIn++;
  }
  const list = all
    .filter((c) => c.segments.includes(segment))
    .sort((a, b) => ((b.lastDay ?? "") > (a.lastDay ?? "") ? 1 : (b.lastDay ?? "") < (a.lastDay ?? "") ? -1 : 0))
    .slice(0, 20);
  return { counts, list, segment };
}
