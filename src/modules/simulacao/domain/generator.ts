/**
 * Simulador por agente (espec. 3.8, D217, D104; revisão T-B2): usa as MESMAS funções puras do produto
 * (`decideCheckin`, `applyDecision`, `decideInvite`), com relógio falso, em ordem cronológica e em memória.
 * Sorteadores por dia (semente + índice do dia): o resultado depende só da semente e do dia da semana de início.
 *
 * Efeito declarado (ITT): +0,20 visita por cliente em 14 dias para convidados × holdout, 25% do extra vindo de
 * migração do pico. Mecanismo: o convite real gera, com probabilidade q = efeito/(1 − migração), 1 visita extra
 * na faixa vazia dentro de 14 dias; e, enquanto o convite real está nos 14 dias, cada visita de pico é perdida com
 * probabilidade f calibrada para tirar efeito·migração/(1 − migração) visitas.
 */
import { hash32 } from "@/src/shared/hash32";
import { mulberry32, type Rng } from "@/src/shared/rng";
import { addDaysSP, instantSP, weekKeyOfDay, weekdayOfDay } from "@/src/shared/week";
import { generateCode, type CodeType } from "@/src/modules/beneficios/domain/codes";
import { isInSlot, turnOfMinutes, type Slot } from "@/src/modules/beneficios/domain/slots";
import { STAMP_CARD_DEFAULTS } from "@/src/modules/beneficios/domain/stamp-card";
import { applyDecision, decideCheckin, type ActiveInvite, type CustomerState } from "@/src/modules/salao/domain/decide-checkin";
import { type Arm } from "@/src/modules/salao/domain/experiment";
import { segmentOf } from "@/src/modules/analytics/domain/segments";
import { reactivationPlan, REACTIVATION_SHARE_PCT, type ReactivationCustomer } from "@/src/modules/planos/domain/reactivation";

export type SimConvitePeriod = { slotId: string; versionId: string; itemId: string; unitCostCents: number; cap: number; fromDay: string; toDay: string | null };

export type SimRestaurant = {
  id: string;
  slots: Slot[];
  agora: { versionId: string; itemId: string };
  recompensa: { versionId: string; itemId: string };
  convites: SimConvitePeriod[];
  variantTokens: string[];
};

export type SimParams = {
  seed: number;
  startDay: string;
  days: number;
  weeklyNew: number;
  effect: number;
  migrationShare: number;
  /** Visitas-base de volta por cliente em 14 dias (média). */
  baseVisits14: number;
  validationP: number;
  validationPSatNight: number;
  optInP: number;
  /** Leituras sem check-in por check-in (conversão leitura → check-in ≈ 1/(1+x)). */
  extraScansPerCheckin: number;
  /** Reativação simulada do plano anterior (dia e minuto em SP). */
  reactivation?: { day: string; minute: number; planKey: string };
};

export const VITRINE_SIM: Omit<SimParams, "startDay" | "reactivation"> = {
  seed: 20261157,
  days: 60,
  weeklyNew: 200,
  effect: 0.2,
  migrationShare: 0.25,
  baseVisits14: 0.3,
  validationP: 0.85,
  validationPSatNight: 0.7,
  optInP: 0.9,
  extraScansPerCheckin: 1.5,
};

export type SimCustomer = {
  id: string;
  name: string;
  phoneDigits: string;
  optIn: boolean;
  createdDay: string;
  lambda: number;
  device: string;
  variant: string | null;
  state: CustomerState;
  firstCheckinAt: Date | null;
  inviteId: string | null;
  checkins: number;
};

export type SimCheckin = { id: string; customerId: string; at: Date; day: string; turn: string; idle: boolean; variant: string | null; outcome: string };
export type SimScan = { at: Date; device: string; variant: string | null };
export type SimInvite = {
  id: string;
  customerId: string;
  slot: Slot;
  versionId: string;
  arm: Arm;
  status: "ativo" | "usado" | "expirado" | "suprimido";
  origin: "mesa" | "reativacao";
  issuedAt: Date;
  issuedDay: string;
  weekKey: string;
  expiresAt: Date;
  usedAt: Date | null;
  sendKey: string | null;
};
export type SimCode = {
  customerId: string;
  type: CodeType;
  code: string;
  itemId: string;
  versionId: string;
  inviteId: string | null;
  checkinId: string;
  validDay: string;
  issuedAt: Date;
  validatedAt: Date | null;
  costCents: number;
};
export type SimSend = { key: string; at: Date; members: Array<{ customerId: string; inviteId: string | null; arm: Arm }> };
export type SimOutput = {
  customers: SimCustomer[];
  checkins: SimCheckin[];
  scans: SimScan[];
  invites: SimInvite[];
  codes: SimCode[];
  sends: SimSend[];
  quotas: Array<{ slotId: string; weekKey: string; cap: number; used: number }>;
};

const NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabriela", "Heitor", "Isabela", "João", "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Rafael", "Sofia", "Tiago", "Vitória", "Yuri"];
const SURNAMES = ["Souza", "Lima", "Costa", "Rocha", "Alves", "Martins"];
const WEEKDAY_FACTOR = [1.15, 0.75, 0.85, 0.9, 1.0, 1.25, 1.3];
const FACTOR_SUM = WEEKDAY_FACTOR.reduce((a, b) => a + b, 0);
/** Turnos dentro do funcionamento da vitrine (11h–23h30) [C]: almoço 45%, tarde 8%, noite 47%. */
const TURN_WINDOWS: Array<[number, number, number]> = [
  [0.45, 660, 900],
  [0.08, 900, 1080],
  [0.47, 1080, 1410],
];

function uuidFrom(rng: Rng): string {
  const h = Array.from({ length: 32 }, () => Math.floor(rng() * 16).toString(16));
  h[12] = "4";
  h[16] = ((Math.floor(rng() * 4) + 8) as number).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function poisson(rng: Rng, mean: number): number {
  const l = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > l);
  return k - 1;
}

function pickMinute(rng: Rng): number {
  let u = rng();
  for (const [share, a, b] of TURN_WINDOWS) {
    if (u < share) return a + Math.floor(rng() * (b - a));
    u -= share;
  }
  return 1080 + Math.floor(rng() * 330);
}

type Visit = { customerId: string; minute: number; extra: boolean };

export function simulate(r: SimRestaurant, p: SimParams): SimOutput {
  const q = p.effect / (1 - p.migrationShare);
  const peakLoss = q * p.migrationShare;
  const f = Math.min(0.95, peakLoss / (p.baseVisits14 * 0.95));
  const customers = new Map<string, SimCustomer>();
  const out: SimOutput = { customers: [], checkins: [], scans: [], invites: [], codes: [], sends: [], quotas: [] };
  const invitesById = new Map<string, SimInvite>();
  const realCount = new Map<string, number>(); // slot|week
  const usedCodes = new Set<string>();
  const extra = new Map<string, Visit[]>(); // dia → visitas extras (efeito do convite)
  const endDay = addDaysSP(p.startDay, p.days); // exclusivo
  const checkinDays = new Map<string, string[]>(); // cliente → dias com check-in (segmento "frequentes")
  let seq = 0; // telefones sequenciais: nunca repetem dentro da rodada (revisão S1)

  const conviteOn = (slotId: string, day: string) => r.convites.find((c) => c.slotId === slotId && c.fromDay <= day && (c.toDay === null || day < c.toDay));
  const activeSlots = (day: string) => r.slots.filter((s) => conviteOn(s.id, day));
  const remaining = (day: string) => {
    const wk = weekKeyOfDay(day);
    const rem: Record<string, number> = {};
    for (const s of activeSlots(day)) rem[s.id] = Math.max(0, conviteOn(s.id, day)!.cap - (realCount.get(`${s.id}|${wk}`) ?? 0));
    return rem;
  };

  const scheduleExtra = (rng: Rng, c: SimCustomer, inv: SimInvite) => {
    if (rng() >= q) return;
    const days: string[] = [];
    for (let k = 1; k <= 14; k++) {
      const d = addDaysSP(inv.issuedDay, k);
      if (inv.slot.days.includes(weekdayOfDay(d))) days.push(d);
    }
    if (days.length === 0) return;
    const d = days[Math.floor(rng() * days.length)]!;
    const minute = inv.slot.startMin + Math.floor(rng() * (inv.slot.endMin - inv.slot.startMin));
    extra.set(d, [...(extra.get(d) ?? []), { customerId: c.id, minute, extra: true }]);
  };

  const issueInvite = (rng: Rng, c: SimCustomer, d: { kind: "real" | "fantasma"; slotId: string; slot: Slot; arm: Arm; expiresAt: Date }, at: Date, day: string, origin: SimInvite["origin"], sendKey: string | null) => {
    const conv = conviteOn(d.slotId, day)!;
    const inv: SimInvite = {
      id: uuidFrom(rng),
      customerId: c.id,
      slot: d.slot,
      versionId: conv.versionId,
      arm: d.arm,
      status: d.kind === "real" ? "ativo" : "suprimido",
      origin,
      issuedAt: at,
      issuedDay: day,
      weekKey: weekKeyOfDay(day),
      expiresAt: d.expiresAt,
      usedAt: null,
      sendKey,
    };
    out.invites.push(inv);
    invitesById.set(inv.id, inv);
    c.inviteId = inv.id;
    if (d.kind === "real") {
      const key = `${d.slotId}|${inv.weekKey}`;
      realCount.set(key, (realCount.get(key) ?? 0) + 1);
      scheduleExtra(rng, c, inv);
    }
    return inv;
  };

  const expireIfNeeded = (c: SimCustomer, at: Date) => {
    const inv = c.inviteId ? invitesById.get(c.inviteId) : undefined;
    if (inv && (inv.status === "ativo" || inv.status === "suprimido") && inv.expiresAt.getTime() <= at.getTime()) {
      inv.status = "expirado";
      c.inviteId = null;
      c.state = { ...c.state, activeInvite: null };
    }
  };

  for (let i = 0; i < p.days; i++) {
    const day = addDaysSP(p.startDay, i);
    const rng = mulberry32(hash32(`${p.seed}:${i}`));
    const wd = weekdayOfDay(day);

    // Reativação do plano anterior (antes de abrir): a MESMA função pura do produto (S3, D142, revisão T-B3).
    if (p.reactivation && p.reactivation.day === day) {
      const at = instantSP(day, p.reactivation.minute);
      const send: SimSend = { key: p.reactivation.planKey, at, members: [] };
      const pool: ReactivationCustomer[] = [];
      for (const c of customers.values()) {
        expireIfNeeded(c, at);
        const stamps = c.state.card?.completedDay ? 0 : (c.state.card?.stamps ?? 0);
        const recent = (checkinDays.get(c.id) ?? []).filter((d) => d > addDaysSP(day, -30)).length;
        pool.push({
          id: c.id,
          arm: c.state.arm,
          optIn: c.optIn,
          segments: segmentOf({ visits: c.checkins, lastDay: c.state.lastCheckinDay, stamps, visits30d: recent, hasActiveInvite: !!c.state.activeInvite }, day),
          hasActiveInvite: !!c.state.activeInvite,
          lastDay: c.state.lastCheckinDay,
        });
      }
      for (const { customerId, decision: d } of reactivationPlan(pool, activeSlots(day), remaining(day), { sharePct: REACTIVATION_SHARE_PCT, restaurantId: r.id }, at)) {
        const c = customers.get(customerId)!;
        const inv = issueInvite(rng, c, d, at, day, "reativacao", send.key);
        c.state = { ...c.state, arm: d.arm, activeInvite: { slot: d.slot, arm: d.arm, status: inv.status as "ativo" | "suprimido", issuedDay: day, expiresAt: d.expiresAt } };
        send.members.push({ customerId: c.id, inviteId: inv.id, arm: d.arm });
      }
      out.sends.push(send);
    }

    const visits: Visit[] = [...(extra.get(day) ?? [])];
    for (const c of customers.values()) {
      if (rng() >= c.lambda) continue;
      const minute = pickMinute(rng);
      const inv = c.inviteId ? invitesById.get(c.inviteId) : undefined;
      const treated = inv && inv.status === "ativo" && inv.arm === "convidavel" && day > inv.issuedDay && day <= addDaysSP(inv.issuedDay, 14);
      const idle = r.slots.some((s) => isInSlot(s, instantSP(day, minute)));
      if (treated && !idle && rng() < f) continue; // migração: visita de pico trocada pela faixa vazia
      visits.push({ customerId: c.id, minute, extra: false });
    }
    const newcomers = poisson(rng, (p.weeklyNew / FACTOR_SUM) * WEEKDAY_FACTOR[wd]!);
    for (let n = 0; n < newcomers; n++) {
      const id = uuidFrom(rng);
      const digits = `0090${String(++seq).padStart(7, "0")}`;
      const c: SimCustomer = {
        id,
        name: `${NAMES[Math.floor(rng() * NAMES.length)]} ${SURNAMES[Math.floor(rng() * SURNAMES.length)]}`,
        phoneDigits: digits,
        optIn: rng() < p.optInP,
        createdDay: day,
        lambda: Math.min(0.9, (-(p.baseVisits14 / 14 / 2) * (Math.log(1 - rng()) + Math.log(1 - rng())))),
        device: uuidFrom(rng),
        variant: r.variantTokens.length ? r.variantTokens[Math.floor(rng() * r.variantTokens.length)]! : null,
        state: { lastCheckinDay: null, firstVisitCodeIssued: false, card: null, activeInvite: null, arm: null },
        firstCheckinAt: null,
        inviteId: null,
        checkins: 0,
      };
      customers.set(id, c);
      out.customers.push(c);
      visits.push({ customerId: id, minute: pickMinute(rng), extra: false });
    }
    visits.sort((a, b) => a.minute - b.minute);

    for (const v of visits) {
      const c = customers.get(v.customerId);
      if (!c) continue;
      const at = instantSP(day, v.minute);
      // Leituras: a do próprio cliente + leituras sem check-in de outros aparelhos.
      out.scans.push({ at: new Date(at.getTime() - 120_000), device: c.device, variant: c.variant });
      for (let k = poisson(rng, p.extraScansPerCheckin); k > 0; k--) {
        out.scans.push({ at: new Date(at.getTime() - Math.floor(rng() * 3_600_000)), device: uuidFrom(rng), variant: r.variantTokens.length ? r.variantTokens[Math.floor(rng() * r.variantTokens.length)]! : null });
      }
      expireIfNeeded(c, at);
      const slots = activeSlots(day);
      const decision = decideCheckin({
        at,
        customerId: c.id,
        restaurantId: r.id,
        customer: c.state,
        rule: { active: slots.length > 0, slots, remaining: remaining(day) },
        stampConfig: STAMP_CARD_DEFAULTS,
      });
      if (decision.outcome === "ja_fez_checkin_hoje") continue;
      const checkinId = uuidFrom(rng);
      out.checkins.push({ id: checkinId, customerId: c.id, at, day, turn: turnOfMinutes(v.minute), idle: r.slots.some((s) => isInSlot(s, at)), variant: c.variant, outcome: decision.outcome });
      c.checkins++;
      checkinDays.set(c.id, [...(checkinDays.get(c.id) ?? []), day]);
      c.firstCheckinAt ??= at;

      const activeInv = c.inviteId ? invitesById.get(c.inviteId) : undefined;
      let inviteUsed = false;
      for (const type of decision.codes) {
        let code = generateCode((n) => Math.floor(rng() * n));
        while (usedCodes.has(code)) code = generateCode((n) => Math.floor(rng() * n));
        usedCodes.add(code);
        const satNight = wd === 6 && v.minute >= 1080;
        const validated = rng() < (satNight ? p.validationPSatNight : p.validationP);
        const conv = type === "convite" && activeInv ? r.convites.find((x) => x.versionId === activeInv.versionId) : undefined;
        const src = type === "primeira_visita" ? r.agora : type === "recompensa" ? r.recompensa : null;
        const validatedAt = validated ? new Date(at.getTime() + (5 + Math.floor(rng() * 85)) * 60_000) : null;
        out.codes.push({
          customerId: c.id,
          type,
          code,
          itemId: conv?.itemId ?? src!.itemId,
          versionId: conv?.versionId ?? src!.versionId,
          inviteId: type === "convite" ? (activeInv?.id ?? null) : null,
          checkinId,
          validDay: day,
          issuedAt: at,
          validatedAt,
          costCents: conv?.unitCostCents ?? 0,
        });
        if (type === "convite" && validated && activeInv) {
          activeInv.status = "usado";
          activeInv.usedAt = validatedAt;
          inviteUsed = true;
        }
      }
      if (decision.invite && (decision.invite.kind === "real" || decision.invite.kind === "fantasma")) {
        issueInvite(rng, c, decision.invite, at, day, "mesa", null);
      }
      c.state = applyDecision(c.state, decision);
      if (inviteUsed) {
        c.inviteId = null;
        c.state = { ...c.state, activeInvite: null };
      }
    }
  }

  // Estado final dos convites no fim da simulação.
  const endAt = instantSP(endDay, 0);
  for (const inv of out.invites) if ((inv.status === "ativo" || inv.status === "suprimido") && inv.expiresAt.getTime() <= endAt.getTime()) inv.status = "expirado";
  for (const [key, used] of realCount) {
    const [slotId, weekKey] = key.split("|") as [string, string];
    const conv = r.convites.filter((c) => c.slotId === slotId).at(-1)!;
    out.quotas.push({ slotId, weekKey, cap: conv.cap, used });
  }
  return out;
}

/** Amostras para a estatística: 1º convite (real ou fantasma) de cada cliente = sorteio. */
export function drawsOf(out: SimOutput): Array<{ customerId: string; arm: Arm; drawDay: string }> {
  const seen = new Map<string, { customerId: string; arm: Arm; drawDay: string }>();
  for (const inv of out.invites) if (!seen.has(inv.customerId)) seen.set(inv.customerId, { customerId: inv.customerId, arm: inv.arm, drawDay: inv.issuedDay });
  return [...seen.values()];
}

export type { ActiveInvite };
