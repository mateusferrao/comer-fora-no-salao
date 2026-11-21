/** Revisor no plano da semana (flag `revisor`): convites, justificativas e "o que aprendemos" já renderizados. */
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { weeklyPlans } from "@/src/db/schema";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { runReview } from "@/src/modules/ia/application/review";
import type { StoredReview } from "@/src/modules/ia/tasks/reviewer";
import { getPlanView } from "./plan-view";

async function store(db: Db, planId: string, r: StoredReview) {
  await db
    .update(weeklyPlans)
    .set({ decision: sql`coalesce(${weeklyPlans.decision}, '{}'::jsonb) || jsonb_build_object('reviewer', ${JSON.stringify(r)}::jsonb)` })
    .where(eq(weeklyPlans.id, planId));
}

export async function markPlanReviewing(db: Db, planId: string, now: Date): Promise<void> {
  await store(db, planId, { status: "revisando", reasons: [], at: now.toISOString() });
}

export async function reviewPlan(db: Db, p: { restaurantId: string; planId: string; now: Date; gateway?: AiGateway | null }): Promise<StoredReview | null> {
  const view = await getPlanView(db, p.restaurantId, p.now, p.planId);
  if (!view?.plan || view.plan.id !== p.planId) return null;
  // Só o que chega ao cliente (D148 [C], medido em eval/resultados-revisor.json): justificativa e "o que aprendemos"
  // são para o dono e trazem números escritos pelo código, que o revisor não tem como conferir.
  const texts = view.slots.map((s) => ({ label: `${s.label} · convite ao cliente`, text: s.inviteRendered }));
  const offer = view.slots
    .map((s) => {
      // O convite cita a oferta pelo que o cliente ganha (o prato): o revisor precisa do texto exato, não só do tipo.
      const o = s.options.find((x) => x.id === s.chosenId);
      return `${s.label} (${s.phrase}): ${o ? `${o.gain} (${o.title})` : "oferta da faixa"}`;
    })
    .join("; ");
  const r = await runReview(db, { restaurantId: p.restaurantId, planId: p.planId, offer, texts, now: p.now, gateway: p.gateway });
  // Plano já aprovado ou descartado enquanto revisava: o veredito fica registrado, sem efeito.
  await store(db, p.planId, r);
  return r;
}
