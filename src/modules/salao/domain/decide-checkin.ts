/**
 * Fonte única das regras do check-in (espec. 3.3, 3.5, 3.8): o produto e o simulador chamam esta função.
 * Pura: recebe o estado e o instante, devolve a decisão. Quem persiste é a aplicação (ou o simulador).
 */
import { daySP } from "@/src/shared/tz";
import { isInSlot, turnOf, type Slot, type Turn } from "@/src/modules/beneficios/domain/slots";
import { applyCheckin, type StampCardConfig, type StampCardState } from "@/src/modules/beneficios/domain/stamp-card";
import type { CodeType } from "@/src/modules/beneficios/domain/codes";
import { decideInvite, type Arm, type InviteDecision } from "./experiment";

export type ActiveInvite = {
  /** Faixa congelada na emissão (snapshot). */
  slot: Slot;
  arm: Arm;
  status: "ativo" | "suprimido";
  issuedDay: string;
  expiresAt: Date;
  /** S3 (D141): só em restaurante de teste, "Antecipar" libera o convite fora da faixa neste dia (SP). */
  anyTimeDay?: string | null;
};

export type CustomerState = {
  lastCheckinDay: string | null;
  firstVisitCodeIssued: boolean;
  card: StampCardState | null;
  /** Convite real (`ativo`) ou fantasma (`suprimido`) ainda não vencido. */
  activeInvite: ActiveInvite | null;
  arm: Arm | null;
};

export type CheckinInput = {
  at: Date;
  customerId: string;
  restaurantId: string;
  customer: CustomerState;
  rule: { active: boolean; slots: Slot[]; remaining: Record<string, number> };
  stampConfig: StampCardConfig;
};

export type CheckinOutcome = "ja_fez_checkin_hoje" | "primeira_visita" | "volta_com_convite" | "volta_lembrete" | "volta";

export type CheckinDecision = {
  outcome: CheckinOutcome;
  day: string;
  turn: Turn;
  stamp: { stamped: boolean; stamps: number; required: number; completed: boolean; renewed: boolean } | null;
  card: StampCardState | null;
  codes: CodeType[];
  /** Novo convite (real ou fantasma) ou o motivo de não haver; null quando não foi avaliado. */
  invite: InviteDecision | null;
  /** Convite real ativo, fora da faixa: lembrete ao cliente. */
  reminder: ActiveInvite | null;
  /** Convite real usado para emitir o código de hoje. */
  inviteForCode: ActiveInvite | null;
  firstVisitAlreadyUsed: boolean;
};

function liveInvite(inv: ActiveInvite | null, at: Date): ActiveInvite | null {
  return inv && inv.expiresAt.getTime() > at.getTime() ? inv : null;
}

export function decideCheckin(input: CheckinInput): CheckinDecision {
  const { at, customer } = input;
  const day = daySP(at);
  const turn = turnOf(at);
  if (customer.lastCheckinDay === day) {
    return { outcome: "ja_fez_checkin_hoje", day, turn, stamp: null, card: customer.card, codes: [], invite: null, reminder: null, inviteForCode: null, firstVisitAlreadyUsed: false };
  }

  const isFirst = customer.lastCheckinDay === null;
  const codes: CodeType[] = [];
  if (!customer.firstVisitCodeIssued) codes.push("primeira_visita");

  const stamp = applyCheckin(customer.card, at, input.stampConfig);

  const active = liveInvite(customer.activeInvite, at);
  let reminder: ActiveInvite | null = null;
  let inviteForCode: ActiveInvite | null = null;
  if (active && active.status === "ativo" && active.arm === "convidavel") {
    if ((isInSlot(active.slot, at) || active.anyTimeDay === day) && active.issuedDay !== day) {
      inviteForCode = active;
      codes.push("convite");
    } else {
      reminder = active;
    }
  }

  const invite = active
    ? null
    : decideInvite(
        {
          customerId: input.customerId,
          restaurantId: input.restaurantId,
          ruleActive: input.rule.active,
          hasActiveInvite: false,
          slots: input.rule.slots,
          remaining: input.rule.remaining,
          arm: customer.arm,
        },
        at,
      );

  if (stamp.completed) codes.push("recompensa");

  const outcome: CheckinOutcome = isFirst ? "primeira_visita" : inviteForCode ? "volta_com_convite" : reminder ? "volta_lembrete" : "volta";
  return {
    outcome,
    day,
    turn,
    stamp: { stamped: stamp.stamped, stamps: stamp.card.stamps, required: input.stampConfig.required, completed: stamp.completed, renewed: stamp.renewed },
    card: stamp.card,
    codes,
    invite,
    reminder,
    inviteForCode,
    firstVisitAlreadyUsed: !isFirst && customer.firstVisitCodeIssued,
  };
}

/** Aplica a decisão ao estado em memória (simulador). A aplicação faz o mesmo em SQL. */
export function applyDecision(state: CustomerState, d: CheckinDecision): CustomerState {
  if (d.outcome === "ja_fez_checkin_hoje") return state;
  let activeInvite = state.activeInvite;
  let arm = state.arm;
  if (d.invite && (d.invite.kind === "real" || d.invite.kind === "fantasma")) {
    const inv = d.invite;
    arm = inv.arm;
    activeInvite = { slot: inv.slot, arm: inv.arm, status: inv.kind === "real" ? "ativo" : "suprimido", issuedDay: d.day, expiresAt: inv.expiresAt };
  }
  return {
    lastCheckinDay: d.day,
    firstVisitCodeIssued: state.firstVisitCodeIssued || d.codes.includes("primeira_visita"),
    card: d.card,
    activeInvite,
    arm,
  };
}
