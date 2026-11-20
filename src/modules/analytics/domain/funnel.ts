/**
 * Funil do painel (espec. 3.6; revisão do plano S3): convites só da mesa (os da reativação ficam à parte) e
 * percentual só entre etapas em que uma é subconjunto da anterior.
 */
import { addDaysSP } from "@/src/shared/week";

export type Period = "hoje" | "7d" | "30d";
export const PERIODS: readonly Period[] = ["7d", "30d", "hoje"];

export function periodRange(p: Period, today: string): { from: string; to: string } {
  const back = p === "hoje" ? 0 : p === "7d" ? 6 : 29;
  return { from: addDaysSP(today, -back), to: today };
}

export type FunnelCounts = {
  scans: number;
  checkins: number;
  /** Clientes cuja 1ª visita ao restaurante caiu no período. */
  newContacts: number;
  /** Convites reais emitidos na mesa (`origin = mesa`). */
  invitesTable: number;
  invitesReactivation: number;
  /** Códigos de convite emitidos (volta dentro da faixa). */
  returnsWithInvite: number;
  /** Desses, os validados pelo garçom. */
  inviteCodesValidated: number;
  firstVisitValidated: number;
};

export type FunnelKey = "leituras" | "checkins" | "contato" | "convites" | "voltaram" | "validados";
export type FunnelStep = { key: FunnelKey; label: string; value: number; pctOfPrev: number | null };

const pct = (part: number, whole: number): number | null => (whole > 0 && part <= whole ? Math.round((100 * part) / whole) : null);

export function funnelSteps(c: FunnelCounts): { steps: FunnelStep[]; side: { invitesReactivation: number; firstVisitValidated: number } } {
  return {
    steps: [
      { key: "leituras", label: "Leituras do QR", value: c.scans, pctOfPrev: null },
      { key: "checkins", label: "Check-ins", value: c.checkins, pctOfPrev: pct(c.checkins, c.scans) },
      { key: "contato", label: "Deixaram contato", value: c.newContacts, pctOfPrev: pct(c.newContacts, c.checkins) },
      { key: "convites", label: "Convites emitidos na mesa", value: c.invitesTable, pctOfPrev: null },
      { key: "voltaram", label: "Voltaram com convite", value: c.returnsWithInvite, pctOfPrev: null },
      { key: "validados", label: "Códigos de convite validados", value: c.inviteCodesValidated, pctOfPrev: pct(c.inviteCodesValidated, c.returnsWithInvite) },
    ],
    side: { invitesReactivation: c.invitesReactivation, firstVisitValidated: c.firstVisitValidated },
  };
}
