/**
 * Grupo de controle por intenção de tratar + convite fantasma (espec. 3.3, D216).
 * A elegibilidade é verificada SEM olhar o grupo; só depois o grupo é sorteado (uma única vez).
 */
import { hash32 } from "@/src/shared/hash32";
import { daySP, endOfDaySP } from "@/src/shared/tz";
import { addDaysSP, instantSP } from "@/src/shared/week";
import { sortByPriority, type Slot } from "@/src/modules/beneficios/domain/slots";

export type Arm = "convidavel" | "holdout";
export const HOLDOUT_PCT = 10;
export const INVITE_VALIDITY_DAYS = 30;

/** 10% holdout por hash determinístico de cliente + restaurante. */
export function assignArm(customerId: string, restaurantId: string): Arm {
  return hash32(`${customerId}:${restaurantId}`) % 100 < HOLDOUT_PCT ? "holdout" : "convidavel";
}

export type InviteState = {
  customerId: string;
  restaurantId: string;
  /** Há regra de convite aprovada e vigente (plano ativo). */
  ruleActive: boolean;
  /** Convite ativo (real) ou fantasma não vencido. */
  hasActiveInvite: boolean;
  slots: Slot[];
  /** Vagas restantes na semana ISO corrente, por faixa. */
  remaining: Record<string, number>;
  arm: Arm | null;
};

export type InviteIssue = { kind: "real" | "fantasma"; slotId: string; slot: Slot; arm: Arm; armIsNew: boolean; expiresAt: Date };
export type InviteDecision = InviteIssue | { kind: "teto_esgotado" | "ja_tem_ativo" | "sem_plano" };

/** Validade: até 23:59:59 SP do dia de emissão + 30 dias (congelada na emissão — D218). */
export function inviteExpiry(at: Date): Date {
  return endOfDaySP(instantSP(addDaysSP(daySP(at), INVITE_VALIDITY_DAYS), 12 * 60));
}

export function pickSlot(slots: readonly Slot[], remaining: Record<string, number>): Slot | undefined {
  return sortByPriority(slots).find((s) => (remaining[s.id] ?? 0) > 0);
}

export function decideInvite(s: InviteState, at: Date): InviteDecision {
  if (!s.ruleActive) return { kind: "sem_plano" };
  if (s.hasActiveInvite) return { kind: "ja_tem_ativo" };
  const slot = pickSlot(s.slots, s.remaining);
  if (!slot) return { kind: "teto_esgotado" };
  const arm = s.arm ?? assignArm(s.customerId, s.restaurantId);
  return {
    kind: arm === "holdout" ? "fantasma" : "real",
    slotId: slot.id,
    slot,
    arm,
    armIsNew: s.arm === null,
    expiresAt: inviteExpiry(at),
  };
}
