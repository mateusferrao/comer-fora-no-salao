/** Segmentos acionáveis de Clientes (espec. 3.6; limiares [C] da S3 — D145). */
import { addDaysSP } from "@/src/shared/week";

export type Segment = "sumiu" | "perto" | "convite_ativo" | "frequente";
export const SEGMENTS: readonly Segment[] = ["sumiu", "perto", "convite_ativo", "frequente"];
export const GONE_AFTER_DAYS = 14;
export const FREQUENT_30D = 3;

export function segmentOf(c: { visits: number; lastDay: string | null; stamps: number; visits30d: number; hasActiveInvite: boolean }, today: string): Segment[] {
  const out: Segment[] = [];
  if (c.visits === 1 && c.lastDay !== null && c.lastDay <= addDaysSP(today, -GONE_AFTER_DAYS)) out.push("sumiu");
  if (c.stamps >= 4 && c.stamps <= 5) out.push("perto");
  if (c.hasActiveInvite) out.push("convite_ativo");
  if (c.visits30d >= FREQUENT_30D) out.push("frequente");
  return out;
}
