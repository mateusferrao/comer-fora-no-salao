/**
 * Modelos de tela montados por LISTA DE CAMPOS PERMITIDOS (P-I7): nada de grupo, fantasma ou status interno
 * sai para o navegador. O holdout recebe exatamente o mesmo formato de quem não tem convite.
 */
import { z } from "zod";
import { describeOffer, type Offer, type Role } from "@/src/modules/beneficios/domain/offers";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import type { CodeType } from "@/src/modules/beneficios/domain/codes";
import type { CheckinOutcome } from "@/src/modules/salao/domain/decide-checkin";

export type OfferView = { title: string; subtitle: string; itemName: string; gain: string; category: string | null };

export function offerView(offer: Offer | undefined | null, menu: readonly MenuItem[], role: Role): OfferView | null {
  if (!offer) return null;
  const d = describeOffer(offer, menu, role);
  const category = menu.find((i) => i.id === offer.params.itemId)?.category ?? null;
  return { ...d, category };
}

export type CodeView = { type: CodeType; code: string; title: string; itemName: string };

/** Convite REAL visível ao cliente (nunca o fantasma). */
export type InviteView = {
  state: "novo" | "lembrete" | "usar_hoje";
  days: number[];
  startMin: number;
  endMin: number;
  /** Último dia de validade (SP). */
  untilDay: string;
  offer: OfferView | null;
  /** Recado do restaurante no convite (D122): texto aprovado pelo dono, já renderizado pelo código. */
  message: string | null;
  /** S4 (D153): liberado hoje fora da faixa pelas Ferramentas do avaliador. */
  liberatedToday?: boolean;
  /** S5.2: link assinado do `.ics` (só convite real com janela válida pela frente). */
  agendaUrl?: string | null;
  /** S5.2: a próxima janela em que o código pode nascer é hoje. */
  validToday?: boolean;
};

export type CheckinView = {
  outcome: CheckinOutcome;
  stamps: number;
  required: number;
  codes: CodeView[];
  invite: InviteView | null;
  firstVisitAlreadyUsed: boolean;
};

export const CHECKIN_VIEW_KEYS = ["outcome", "stamps", "required", "codes", "invite", "firstVisitAlreadyUsed"] as const;

/** Copia só os campos permitidos (defesa contra vazamento se alguém acrescentar algo ao objeto). */
export function sanitizeCheckinView(v: CheckinView): CheckinView {
  return {
    outcome: v.outcome,
    stamps: v.stamps,
    required: v.required,
    codes: v.codes.map((c) => ({ type: c.type, code: c.code, title: c.title, itemName: c.itemName })),
    invite: v.invite
      ? {
          state: v.invite.state,
          days: [...v.invite.days],
          startMin: v.invite.startMin,
          endMin: v.invite.endMin,
          untilDay: v.invite.untilDay,
          offer: v.invite.offer,
          message: v.invite.message ?? null,
          liberatedToday: v.invite.liberatedToday ?? false,
          agendaUrl: v.invite.agendaUrl ?? null,
          validToday: v.invite.validToday ?? false,
        }
      : null,
    firstVisitAlreadyUsed: v.firstVisitAlreadyUsed,
  };
}

const offerViewSchema = z.object({ title: z.string(), subtitle: z.string(), itemName: z.string(), gain: z.string(), category: z.string().nullable() });

/** Contrato de saída do check-in (Zod na saída — regras; `object` descarta qualquer campo extra). */
export const checkinViewSchema = z.object({
  outcome: z.enum(["ja_fez_checkin_hoje", "primeira_visita", "volta_com_convite", "volta_lembrete", "volta"]),
  stamps: z.number().int().min(0),
  required: z.number().int().positive(),
  codes: z.array(z.object({ type: z.enum(["primeira_visita", "convite", "recompensa"]), code: z.string(), title: z.string(), itemName: z.string() })),
  invite: z
    .object({
      state: z.enum(["novo", "lembrete", "usar_hoje"]),
      days: z.array(z.number().int()),
      startMin: z.number().int(),
      endMin: z.number().int(),
      untilDay: z.string(),
      offer: offerViewSchema.nullable(),
      message: z.string().nullable().optional(),
      liberatedToday: z.boolean().optional(),
      agendaUrl: z.string().nullable().optional(),
      validToday: z.boolean().optional(),
    })
    .nullable(),
  firstVisitAlreadyUsed: z.boolean(),
});
