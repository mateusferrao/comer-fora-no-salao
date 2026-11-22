/**
 * "Hoje no salão" (S5.1, D172, D185): o que aconteceu hoje (dia em SP) no restaurante — leituras do QR, check-ins
 * (com a marca do grupo de controle, só para o dono), convites emitidos na mesa e códigos validados. Só clientes
 * reais (sem o histórico gerado); nome completo (D237); cada evento com id estável.
 * O grupo de controle não gera linha de convite (o fantasma não existe para ninguém além da medida).
 */
import { sql } from "drizzle-orm";
import type { Executor } from "@/src/db/executor";
import { fullName } from "@/src/shared/contact";
import { daySP, instantSP } from "@/src/shared/tz";

export type FeedItem = {
  id: string;
  at: string;
  kind: "leitura" | "checkin" | "convite" | "codigo";
  name?: string;
  piece?: string | null;
  outcome?: string;
  controle?: boolean;
  slot?: { days: number[]; startMin: number; endMin: number };
  codeType?: string;
};
export type TodayFeed = { counts: { leituras: number; checkins: number; validados: number }; items: FeedItem[] };

type Row = Record<string, unknown>;
const rows = async (ex: Executor, q: ReturnType<typeof sql>): Promise<Row[]> => ((await ex.execute(q)) as unknown as { rows: Row[] }).rows;
const PIECE: Record<string, string> = { display: "Display de mesa", cartaz: "Cartaz", garcom: "Cartão do garçom", porta_conta: "Porta-conta" };
const iso = (v: unknown) => new Date(String(v)).toISOString();
const name = (v: unknown) => fullName(v == null ? null : String(v));

export async function getTodayFeed(ex: Executor, restaurantId: string, now: Date, limit = 15): Promise<TodayFeed> {
  const start = instantSP(daySP(now), 0).toISOString();
  const [scans, checkins, invites, codes, counts] = await Promise.all([
    rows(
      ex,
      sql`select s.id, s.at, kp.kind, pv.label from scans s
          left join piece_variants pv on pv.id = s.variant_id left join kit_pieces kp on kp.id = pv.piece_id
          where s.restaurant_id = ${restaurantId} and s.at >= ${start} and s.simulation_run_id is null
          order by s.at desc limit ${limit}`,
    ),
    rows(
      ex,
      sql`select c.id, c.at, c.result->>'outcome' as outcome, cc.name, rc.arm from checkins c
          join customers cu on cu.id = c.customer_id and cu.simulation_run_id is null
          left join customer_contacts cc on cc.customer_id = c.customer_id
          left join restaurant_customers rc on rc.restaurant_id = c.restaurant_id and rc.customer_id = c.customer_id
          where c.restaurant_id = ${restaurantId} and c.at >= ${start} and c.simulation_run_id is null
          order by c.at desc limit ${limit}`,
    ),
    rows(
      ex,
      sql`select i.id, i.issued_at, i.slot_snapshot, cc.name from invites i
          join customers cu on cu.id = i.customer_id and cu.simulation_run_id is null
          left join customer_contacts cc on cc.customer_id = i.customer_id
          where i.restaurant_id = ${restaurantId} and i.issued_at >= ${start} and i.simulation_run_id is null
            and i.arm = 'convidavel' and i.origin = 'mesa'
          order by i.issued_at desc limit ${limit}`,
    ),
    rows(
      ex,
      sql`select k.id, k.validated_at, k.type, cc.name from codes k
          join customers cu on cu.id = k.customer_id and cu.simulation_run_id is null
          left join customer_contacts cc on cc.customer_id = k.customer_id
          where k.restaurant_id = ${restaurantId} and k.status = 'validado' and k.validated_at >= ${start} and k.simulation_run_id is null
          order by k.validated_at desc limit ${limit}`,
    ),
    rows(
      ex,
      sql`select
          (select count(*)::int from scans where restaurant_id = ${restaurantId} and at >= ${start} and simulation_run_id is null) as leituras,
          (select count(*)::int from checkins c join customers cu on cu.id = c.customer_id and cu.simulation_run_id is null
            where c.restaurant_id = ${restaurantId} and c.at >= ${start} and c.simulation_run_id is null) as checkins,
          (select count(*)::int from codes k join customers cu on cu.id = k.customer_id and cu.simulation_run_id is null
            where k.restaurant_id = ${restaurantId} and k.status = 'validado' and k.validated_at >= ${start} and k.simulation_run_id is null) as validados`,
    ),
  ]);
  const items: FeedItem[] = [
    ...scans.map((r) => ({ id: `l:${r.id}`, at: iso(r.at), kind: "leitura" as const, piece: r.kind ? `${PIECE[String(r.kind)] ?? String(r.kind)} ${String(r.label)}` : null })),
    ...checkins.map((r) => ({ id: `c:${r.id}`, at: iso(r.at), kind: "checkin" as const, name: name(r.name), outcome: String(r.outcome ?? "volta"), controle: r.arm === "holdout" })),
    ...invites.map((r) => {
      const s = r.slot_snapshot as { days: number[]; startMin: number; endMin: number };
      return { id: `i:${r.id}`, at: iso(r.issued_at), kind: "convite" as const, name: name(r.name), slot: { days: s.days, startMin: s.startMin, endMin: s.endMin } };
    }),
    ...codes.map((r) => ({ id: `k:${r.id}`, at: iso(r.validated_at), kind: "codigo" as const, name: name(r.name), codeType: String(r.type) })),
  ];
  // Mais recente primeiro; no mesmo instante, a ordem em que acontecem (leitura → check-in → convite → código) invertida.
  const ORDER = { leitura: 0, checkin: 1, convite: 2, codigo: 3 } as const;
  items.sort((a, b) => b.at.localeCompare(a.at) || ORDER[b.kind] - ORDER[a.kind]);
  const c = counts[0] ?? {};
  return { counts: { leituras: Number(c.leituras ?? 0), checkins: Number(c.checkins ?? 0), validados: Number(c.validados ?? 0) }, items: items.slice(0, limit) };
}
