/**
 * Passo 5 — ativar (espec. 3.2): grava benefício agora, recompensa e um convite por faixa (versão 1, com
 * teto e texto aprovado), aprova o 1º plano e liga o restaurante. Idempotente: `FOR UPDATE` no restaurante;
 * já ativo → devolve sem refazer. Os ajustes do dono vão para `owner_edits` (qualidade da IA — H4).
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/src/db/client";
import { benefits, benefitVersions, ownerEdits, restaurants, weeklyPlans } from "@/src/db/schema";
import { planContentFromRow } from "@/src/modules/planos/domain/plan-content";
import { OFFER_KINDS, MAX_DISCOUNT_PCT, describeOffer, validateOffer, type Offer, type OfferError, offerFromInput, type OfferKind } from "@/src/modules/beneficios/domain/offers";
import { guardText } from "@/src/modules/ia/guardrails";
import { slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import { loadDraft, type PlanDecision } from "./package";
import { recordStep } from "./wizard";
import { log } from "@/src/shared/log";

const offerInput = z.object({ kind: z.enum(OFFER_KINDS), itemId: z.string().max(64), pct: z.number().int().min(1).max(100).optional() });
export const finalPackageSchema = z.object({
  agora: offerInput,
  recompensa: offerInput,
  slots: z.array(z.object({ slotId: z.string().uuid(), offer: offerInput, weeklyCap: z.number().int().min(1).max(999), inviteText: z.string().max(300) })).min(1),
});
export type FinalPackage = z.infer<typeof finalPackageSchema>;

export type ActivateResult =
  | { ok: true; already: boolean }
  | { ok: false; erro: "sem_pacote" | "faixas" | "oferta"; detalhe?: { alvo: string; erros: OfferError[] } }
  | { ok: false; erro: "texto"; detalhe: { slotId: string; motivos: string[] } };

const toOffer = (o: { kind: OfferKind; itemId: string; pct?: number }): Offer => offerFromInput(o);

export async function activate(db: Db, p: { restaurantId: string; final: FinalPackage; now: Date }): Promise<ActivateResult> {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(restaurants).where(eq(restaurants.id, p.restaurantId)).for("update");
    if (!r) return { ok: false as const, erro: "sem_pacote" as const };
    if (r.status === "ativo") return { ok: true as const, already: true };
    const [plan] = await tx
      .select()
      .from(weeklyPlans)
      .where(and(eq(weeklyPlans.restaurantId, p.restaurantId), eq(weeklyPlans.status, "proposto")))
      .orderBy(desc(weeklyPlans.createdAt))
      .limit(1);
    if (!plan) return { ok: false as const, erro: "sem_pacote" as const };
    const draft = (await loadDraft(tx, p.restaurantId))!;
    const slotIds = new Set(draft.slots.map((s) => s.id));
    if (p.final.slots.length !== slotIds.size || !p.final.slots.every((s) => slotIds.has(s.slotId))) return { ok: false as const, erro: "faixas" as const };

    const check = (alvo: string, o: Offer) => {
      const errs = validateOffer(o, draft.menu);
      if (o.kind === "desconto" && (o.params.pct ?? 0) > MAX_DISCOUNT_PCT && !errs.includes("desconto_acima_do_teto")) errs.push("desconto_acima_do_teto");
      return errs.length ? { ok: false as const, erro: "oferta" as const, detalhe: { alvo, erros: errs } } : null;
    };
    const agora = toOffer(p.final.agora);
    const recompensa = toOffer(p.final.recompensa);
    const bad = check("agora", agora) ?? check("recompensa", recompensa);
    if (bad) return bad;
    const items = Object.fromEntries(draft.menu.map((m) => [m.id, m.name]));
    const slotsCtx = Object.fromEntries(draft.slots.map((s) => [s.id, slotPhrase(s)]));
    const convites: Array<{ slotId: string; offer: Offer; weeklyCap: number; inviteText: string }> = [];
    for (const s of p.final.slots) {
      const offer = toOffer(s.offer);
      const b = check(`convite:${s.slotId}`, offer);
      if (b) return b;
      const g = guardText(s.inviteText, { items, slots: slotsCtx, oferta: describeOffer(offer, draft.menu, "convite").gain }, { allowed: ["prato", "horario", "oferta"], maxLen: 160, field: "textoConvite", mode: "dono" });
      if (!g.ok) return { ok: false as const, erro: "texto" as const, detalhe: { slotId: s.slotId, motivos: g.reasons } };
      convites.push({ slotId: s.slotId, offer, weeklyCap: s.weeklyCap, inviteText: s.inviteText.trim() });
    }

    const version = async (role: "agora" | "convite" | "recompensa", offer: Offer, slotId: string | null, weeklyCap: number | null, inviteText: string | null) => {
      const [b] = await tx.insert(benefits).values({ restaurantId: p.restaurantId, role, slotId, createdAt: p.now }).returning({ id: benefits.id });
      await tx.insert(benefitVersions).values({ benefitId: b!.id, restaurantId: p.restaurantId, version: 1, kind: offer.kind, params: offer.params, weeklyCap, planId: plan.id, validFrom: p.now, inviteText, createdAt: p.now });
    };
    await version("agora", agora, null, null, null);
    await version("recompensa", recompensa, null, null, null);
    for (const c of convites) await version("convite", c.offer, c.slotId, c.weeklyCap, c.inviteText);

    const decision = plan.decision as PlanDecision;
    const proposed = plan.choices as Array<{ slotId: string; candidateId: string; textoConvite: string; justificativa: string }>;
    const candidates = plan.candidates as Array<{ slotId: string; options: Array<{ id: string; offer: { kind: string; itemId: string; pct?: number }; weeklyCap: number }> }>;
    const finalChoices = convites.map((c) => {
      const opts = candidates.find((x) => x.slotId === c.slotId)?.options ?? [];
      const match = opts.find((o) => o.offer.kind === c.offer.kind && o.offer.itemId === c.offer.params.itemId && (o.offer.pct ?? null) === (c.offer.params.pct ?? null));
      const prev = proposed.find((x) => x.slotId === c.slotId);
      return { slotId: c.slotId, candidateId: match?.id ?? `manual:${c.offer.kind}:${c.offer.params.itemId}`, textoConvite: c.inviteText, justificativa: prev?.justificativa ?? "" };
    });
    // Contrato do plano que a S3 lê (planContentSchema — revisão da S2): conferido antes de aprovar.
    const content = planContentFromRow({ ...plan, choices: finalChoices });
    if (!content.success) log.error("plano fora do contrato", { area: "ativar", err: content.error.issues.map((i) => i.path.join(".")).join(", ") });
    await tx
      .update(weeklyPlans)
      .set({ status: "aprovado", approvedAt: p.now, approvedVia: "portal", choices: finalChoices, decision: { ...decision, agora, recompensa, caps: Object.fromEntries(convites.map((c) => [c.slotId, c.weeklyCap])) } })
      .where(eq(weeklyPlans.id, plan.id));
    await tx.update(restaurants).set({ status: "ativo", activatedAt: p.now, onboardingStep: 6 }).where(eq(restaurants.id, p.restaurantId));

    const sameOffer = (a: Offer, b: Offer) => a.kind === b.kind && a.params.itemId === b.params.itemId && (a.params.pct ?? null) === (b.params.pct ?? null);
    const proposedCaps = Object.fromEntries(candidates.map((c) => [c.slotId, c.options[0]?.weeklyCap ?? null]));
    const edits = [
      ...(!sameOffer(agora, decision.agora) ? [{ kind: "pacote:agora", ref: null, suggested: decision.agora, final: agora }] : []),
      ...(!sameOffer(recompensa, decision.recompensa) ? [{ kind: "pacote:recompensa", ref: null, suggested: decision.recompensa, final: recompensa }] : []),
      ...finalChoices.flatMap((f, i) => {
        const prev = proposed.find((x) => x.slotId === f.slotId);
        const out = [];
        if (prev?.candidateId !== f.candidateId) out.push({ kind: "pacote:convite_oferta", ref: f.slotId, suggested: prev?.candidateId ?? null, final: f.candidateId });
        if ((prev?.textoConvite ?? "") !== f.textoConvite) out.push({ kind: "pacote:convite_texto", ref: f.slotId, suggested: prev?.textoConvite ?? null, final: f.textoConvite });
        if (proposedCaps[f.slotId] !== convites[i]!.weeklyCap) out.push({ kind: "pacote:teto", ref: f.slotId, suggested: proposedCaps[f.slotId], final: convites[i]!.weeklyCap });
        return out;
      }),
    ];
    // Uma linha "aceito sem edição" quando nada mudou (métrica da qualidade da IA — espec. 2).
    await tx.insert(ownerEdits).values(
      (edits.length ? edits : [{ kind: "pacote:sem_edicao", ref: null, suggested: null, final: null }]).map((e) => ({ restaurantId: p.restaurantId, ...e, at: p.now })),
    );
    await recordStep(tx, p.restaurantId, 5, "concluiu", p.now);
    return { ok: true as const, already: false };
  });
}
