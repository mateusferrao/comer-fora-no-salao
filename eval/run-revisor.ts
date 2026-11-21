/**
 * Taxa de bloqueio do revisor (revisão de aderência S3, achado 3): gera N planos com a IA real na vitrine do banco
 * local e roda o revisor em cada um. Rodar: DATABASE_URL=… NODE_USE_ENV_PROXY=1 npx tsx eval/run-revisor.ts 8
 */
import { sql } from "drizzle-orm";
import { writeFileSync } from "node:fs";
import { closeDb, getDb } from "@/src/db/client";
import { VITRINE_ID, VITRINE_OWNER_ID } from "@/src/db/seed/vitrine";
import { setFlag } from "@/src/modules/config/application/app-config";
import { generateWeeklyPlan } from "@/src/modules/planos/application/generate-plan";
import { reviewPlan } from "@/src/modules/planos/application/review-plan";

async function main() {
  const n = Number(process.argv[2] ?? 8);
  const db = getDb();
  await setFlag(db, "revisor", false); // o revisor roda aqui, de forma síncrona
  const out: Array<{ i: number; origem: string; status: string; reasons: string[] }> = [];
  for (let i = 1; i <= n; i++) {
    await db.execute(sql`delete from rate_limits where key like ${"plano:%"}`);
    const now = new Date();
    const g = await generateWeeklyPlan(db, { restaurantId: VITRINE_ID, ownerId: VITRINE_OWNER_ID, now });
    if (!g.ok) { out.push({ i, origem: g.erro, status: "-", reasons: [] }); continue; }
    const r = g.generatedBy === "ia" ? await reviewPlan(db, { restaurantId: VITRINE_ID, planId: g.planId, now }) : null;
    out.push({ i, origem: g.generatedBy, status: r?.status ?? "-", reasons: r?.reasons ?? [] });
    process.stdout.write(`${i}: ${g.generatedBy} → ${r?.status ?? "-"} ${(r?.reasons ?? []).join(" | ")}\n`);
  }
  await setFlag(db, "revisor", true);
  const ia = out.filter((x) => x.origem === "ia");
  const blocked = ia.filter((x) => x.status === "bloquear").length;
  process.stdout.write(`\nbloqueados: ${blocked} de ${ia.length} planos da IA\n`);
  writeFileSync("eval/resultados-revisor.json", JSON.stringify({ when: new Date().toISOString(), runs: out, blocked, total: ia.length }, null, 2));
  await closeDb();
}
void main();
