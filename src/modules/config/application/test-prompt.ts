/**
 * "Testar com exemplo" (D58; planejamento S3 §4.7): roda a tarefa com um bloco de instruções candidato sobre uma
 * entrada FIXA e fictícia, mostra a saída renderizada e o resultado das regras, e não grava nada além do resumo em
 * `ai_calls` (custo). Chave de demo. O cardápio (imagem) não tem exemplo de texto.
 */
import type { Db } from "@/src/db/client";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import { describeOffer } from "@/src/modules/beneficios/domain/offers";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import { recordAiCall } from "@/src/modules/ia/ai-calls";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { gatewayFor } from "@/src/modules/ia/gateway-factory";
import { MODELS } from "@/src/modules/ia/models";
import { runTask } from "@/src/modules/ia/run-task";
import { langfuseTracer } from "@/src/modules/ia/tracing";
import { buildKitPrompt, buildKitTask, KIT_PROMPT_VERSION, resolveKit } from "@/src/modules/ia/tasks/kit";
import { buildPackagePrompt, buildPackageTask, resolveLearned, resolvePackage } from "@/src/modules/ia/tasks/package";
import { buildCandidates } from "@/src/modules/onboarding/domain/candidates";
import { declaredFacts } from "@/src/modules/onboarding/domain/facts";
import { slotPhrase } from "@/src/modules/beneficios/domain/slot-text";
import { renderReferences } from "@/src/modules/textos/domain/references";
import { systemClock } from "@/src/shared/clock";
import type { PromptTask } from "../domain/flags";

const MENU: MenuItem[] = [
  { id: "x-bruschetta", category: "entrada", name: "Bruschetta de tomate", priceCents: 2600 },
  { id: "x-arancini", category: "porcao", name: "Arancini", priceCents: 3400 },
  { id: "x-fritto", category: "porcao", name: "Fritto misto", priceCents: 4800 },
  { id: "x-lasanha", category: "prato", name: "Lasanha da casa", priceCents: 6200 },
  { id: "x-cannoli", category: "sobremesa", name: "Cannoli", priceCents: 2200 },
  { id: "x-panna", category: "sobremesa", name: "Panna cotta", priceCents: 1800 },
  { id: "x-limonada", category: "bebida", name: "Limonada siciliana", priceCents: 1400 },
];
const SLOTS: Slot[] = [
  { id: "x-tarde", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 4 },
  { id: "x-noite", days: [1, 2, 3], startMin: 1260, endMin: 1380, intensity: "um_pouco", extraTables: 2 },
];

export type TestPromptResult = { ok: true; status: "ok" | "sem_ia"; reasons: string[]; texts: Array<{ label: string; text: string }>; model: string | null } | { ok: false; erro: "sem_exemplo" | "sem_chave" };

export async function testPrompt(db: Db, p: { task: PromptTask; instructions: string; now: Date; gateway?: AiGateway | null }): Promise<TestPromptResult> {
  if (p.task === "cardapio") return { ok: false, erro: "sem_exemplo" };
  const gw = p.gateway !== undefined ? { gateway: p.gateway, keyKind: "demo" as const } : await gatewayFor(db, "demo", p.now);
  if (!gw.gateway) return { ok: false, erro: "sem_chave" };
  const items = Object.fromEntries(MENU.map((m) => [m.id, m.name]));
  const slots = Object.fromEntries(SLOTS.map((s) => [s.id, slotPhrase(s)]));
  if (p.task === "kit") {
    const kp = buildKitPrompt({ restaurantName: "Cantina de Exemplo", cuisine: "Italiana", beneficio: "Panna cotta grátis", recompensa: "Cannoli grátis", menu: MENU, inviteItemIds: ["x-fritto"], instructions: p.instructions });
    const r = await runTask(buildKitTask(kp, MODELS.kit), kp.system, { text: kp.text }, { gateway: gw.gateway, clock: systemClock, trace: langfuseTracer });
    await recordAiCall(db, { task: "teste:kit", promptVersion: `${KIT_PROMPT_VERSION}@teste`, restaurantId: null, result: r, keyKind: gw.keyKind });
    if (r.status !== "ok") return { ok: true, status: "sem_ia", reasons: reasonsOf(r), texts: [], model: null };
    const t = resolveKit(kp, r.data);
    const ctx = { ...kp.ctx, items };
    const out = [
      ["Versão A · título", t.A.titulo],
      ["Versão A · subtítulo", t.A.subtitulo],
      ["Versão A · ação", t.A.acao],
      ["Versão B · título", t.B.titulo],
      ["Versão B · subtítulo", t.B.subtitulo],
      ["Versão B · ação", t.B.acao],
      ["Recado", t.recado],
    ].map(([label, text]) => ({ label: label!, text: renderReferences(text!, ctx) }));
    return { ok: true, status: "ok", reasons: [], texts: out, model: r.model ?? null };
  }
  const cands = buildCandidates(SLOTS, MENU, { ticketCents: 8500, marginPct: 65, exclude: ["x-panna", "x-cannoli"] });
  const facts = { ...declaredFacts({ tables: 15, weeklyCustomers: 300, ticketCents: 8500, marginPct: 65 }, SLOTS, MENU), uso7d_A_pct: 12, convites7d_A: 40 };
  const learned = p.task === "plano" ? [{ key: "x-tarde:v1", slotId: "x-tarde", verdict: "trocar" as const, gain: "Panna cotta grátis", title: "Doce grátis" }] : undefined;
  const pp = buildPackagePrompt({ restaurantName: "Cantina de Exemplo", cuisine: "Italiana", slots: SLOTS, cands, menu: MENU, facts, learned, instructions: p.instructions });
  const r = await runTask(buildPackageTask(pp, MODELS.pacote), pp.system, { text: pp.text }, { gateway: gw.gateway, clock: systemClock, trace: langfuseTracer });
  await recordAiCall(db, { task: `teste:${p.task}`, promptVersion: `${p.task}@teste`, restaurantId: null, result: r, keyKind: gw.keyKind });
  if (r.status !== "ok") return { ok: true, status: "sem_ia", reasons: reasonsOf(r), texts: [], model: null };
  const out: Array<{ label: string; text: string }> = [];
  for (const c of resolvePackage(pp, r.data)) {
    const opt = cands.find((x) => x.slotId === c.slotId)?.options.find((o) => o.id === c.candidateId);
    const gain = opt ? describeOffer(opt.offer, MENU, "convite").gain : undefined;
    const ctx = { facts, items, slots, oferta: gain };
    out.push({ label: `Convite · ${slots[c.slotId]}`, text: renderReferences(c.textoConvite, ctx) }, { label: "Justificativa", text: renderReferences(c.justificativa, ctx) });
  }
  for (const l of resolveLearned(pp, r.data)) out.push({ label: "O que aprendemos", text: renderReferences(l.texto, { facts, items, slots, oferta: "Panna cotta grátis" }) });
  return { ok: true, status: "ok", reasons: [], texts: out, model: r.model ?? null };
}

function reasonsOf(r: { attempts?: Array<{ error?: string; notes?: string[] }> }): string[] {
  return (r.attempts ?? []).flatMap((a) => [...(a.notes ?? []), ...(a.error ? [a.error] : [])]).slice(0, 8);
}
