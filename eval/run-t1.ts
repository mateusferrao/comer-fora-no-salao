/**
 * Mini-avaliação T1 — estruturar cardápio (D51, D117, D128, D129). Roda à mão (custa crédito; fora do CI):
 *   OPENROUTER_KEY_DEMO=... GOOGLE_VISION_CREDENTIALS_FILE=... npx tsx eval/run-t1.ts
 * 3 cardápios fictícios com gabarito × 7 modelos de visão × 2 repetições + 3 linhas de base de OCR.
 * Saída: eval/resultados-t1.json e eval/relatorio-t1.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createOpenRouterGateway } from "@/src/modules/ia/openrouter-gateway";
import { noopTracer } from "@/src/modules/ia/gateway";
import { runTask } from "@/src/modules/ia/run-task";
import { buildMenuTask, menuInput, menuSystem, MENU_PROMPT_VERSION } from "@/src/modules/ia/tasks/menu";
import { cleanExtraction } from "@/src/modules/onboarding/domain/menu-extraction";
import { systemClock } from "@/src/shared/clock";
import { composite, score, type Item, type Score } from "./score";
import { parseOcr } from "./ocr-rules";
import { visionText, visionToken } from "./google-vision";
import { tesseractText } from "./tesseract";

import { HYBRID_TEXT_MODEL, T1_MODELS, type Entry } from "./models-t1";
const REPS = 2;

const MENUS = [
  { id: "boteco", files: ["boteco.jpg"], nota: "foto torta, 2 colunas, com ruído" },
  { id: "burger", files: ["burger.jpg"], nota: "limpo, 1 coluna, fundo escuro" },
  { id: "sushi", files: ["sushi-1.jpg", "sushi-2.jpg"], nota: "PDF de 2 páginas convertido em imagens" },
  // Foto real enviada pelo candidato (manuscrita, em ângulo, 338×450, com desenhos): mede invenção de itens.
  { id: "real", files: ["../../eval/privado/real-1.jpg"], nota: "foto real manuscrita (privada, fora do produto)" },
] as const;

type Run = { entrant: string; kind: "visao" | "ocr" | "hibrido"; menu: string; rep: number; ok: boolean; reason?: string; latencyMs: number; costUsd: number; score: Score; nota: number; items?: Item[] };

const load = (f: string) => new Uint8Array(readFileSync(`public/exemplos/${f}`));
const gabarito = (id: string) =>
  (JSON.parse(readFileSync(id === "real" ? "eval/privado/real.gabarito.json" : `eval/cardapios/${id}.gabarito.json`, "utf8")) as { itens: Item[] }).itens;
const ZERO: Score = { f1: 0, precision: 0, recall: 0, priceExact: 0, category: 0, matched: 0, expected: 0, got: 0 };

async function main() {
  const key = process.env.OPENROUTER_KEY_DEMO;
  if (!key) throw new Error("OPENROUTER_KEY_DEMO ausente");
  const gateway = createOpenRouterGateway(key);
  const runs: Run[] = [];
  const ctx = { gateway, clock: systemClock, trace: noopTracer };

  async function visionModel(e: Entry) {
    for (const m of MENUS) {
      const images = m.files.map((f) => ({ data: load(f), mediaType: "image/jpeg" }));
      for (let rep = 1; rep <= REPS; rep++) {
        const t0 = Date.now();
        const r = await runTask(buildMenuTask([e.ref]), menuSystem(), menuInput(images), ctx);
        const latencyMs = Date.now() - t0;
        const cost = r.attempts.reduce((a, x) => a + (x.costUsd ?? 0), 0);
        if (r.status === "ok") {
          const items = cleanExtraction(r.data).itens;
          const s = score(gabarito(m.id), items);
          runs.push({ entrant: e.label, kind: "visao", menu: m.id, rep, ok: true, latencyMs, costUsd: cost, score: s, nota: composite(s), items });
        } else {
          runs.push({ entrant: e.label, kind: "visao", menu: m.id, rep, ok: false, reason: `${r.reason}: ${r.attempts.map((a) => a.error + (a.detail ? ` (${a.detail})` : "")).join("; ")}`, latencyMs, costUsd: cost, score: { ...ZERO, expected: gabarito(m.id).length }, nota: 0 });
        }
        console.log(`${e.label} · ${m.id} #${rep}: ${runs.at(-1)!.ok ? `nota ${runs.at(-1)!.nota.toFixed(3)}` : `falhou ${runs.at(-1)!.reason}`} · ${latencyMs} ms · US$ ${cost.toFixed(5)}`);
      }
    }
  }

  // Modelos em paralelo (cada um em sequência nos cardápios), para medir latência sem fila do mesmo modelo.
  await Promise.all(T1_MODELS.map(visionModel));

  // Linhas de base de OCR (1 rodada: são determinísticas).
  const saFile = process.env.GOOGLE_VISION_CREDENTIALS_FILE;
  const token = saFile ? await visionToken(JSON.parse(readFileSync(saFile, "utf8"))) : null;
  for (const m of MENUS) {
    const imgs = m.files.map(load);
    let t0 = Date.now();
    const tess = await tesseractText(imgs);
    const st = score(gabarito(m.id), parseOcr(tess));
    runs.push({ entrant: "Tesseract + regras", kind: "ocr", menu: m.id, rep: 1, ok: true, latencyMs: Date.now() - t0, costUsd: 0, score: st, nota: composite(st) });
    if (!token) continue;
    t0 = Date.now();
    const vtexts: string[] = [];
    for (const img of imgs) vtexts.push(await visionText(token, img));
    const vText = vtexts.join("\n");
    const vLatency = Date.now() - t0;
    // Preço de tabela do Vision (DOCUMENT_TEXT_DETECTION): US$ 1,50 por 1.000 imagens (as 1.000 primeiras do mês são grátis).
    const vCost = 0.0015 * imgs.length;
    const sv = score(gabarito(m.id), parseOcr(vText));
    runs.push({ entrant: "Google Vision + regras", kind: "ocr", menu: m.id, rep: 1, ok: true, latencyMs: vLatency, costUsd: vCost, score: sv, nota: composite(sv) });
    for (let rep = 1; rep <= REPS; rep++) {
      const t1 = Date.now();
      const r = await runTask(
        buildMenuTask([HYBRID_TEXT_MODEL]),
        menuSystem() + "\n- A entrada é o TEXTO de um OCR do cardápio (pode vir fora de ordem: nomes e preços em linhas separadas, colunas misturadas).",
        { text: `Texto do OCR:\n<<<\n${vText}\n>>>` },
        ctx,
      );
      const cost = vCost + r.attempts.reduce((a, x) => a + (x.costUsd ?? 0), 0);
      const lat = vLatency + (Date.now() - t1);
      if (r.status === "ok") {
        const items = cleanExtraction(r.data).itens;
        const s = score(gabarito(m.id), items);
        runs.push({ entrant: "Google Vision + LLM de texto (gemini-2.5-flash-lite)", kind: "hibrido", menu: m.id, rep, ok: true, latencyMs: lat, costUsd: cost, score: s, nota: composite(s), items });
      } else runs.push({ entrant: "Google Vision + LLM de texto (gemini-2.5-flash-lite)", kind: "hibrido", menu: m.id, rep, ok: false, reason: r.reason, latencyMs: lat, costUsd: cost, score: { ...ZERO, expected: gabarito(m.id).length }, nota: 0 });
    }
    console.log(`OCR ${m.id}: tesseract ${st.f1.toFixed(2)} · vision ${sv.f1.toFixed(2)}`);
  }

  // A foto real fica fora dos resultados públicos (só a pontuação; os itens extraídos não são gravados).
  const publicRuns = runs.map((r) => (r.menu === "real" ? { ...r, items: undefined } : r));
  writeFileSync("eval/resultados-t1.json", JSON.stringify({ promptVersion: MENU_PROMPT_VERSION, at: new Date().toISOString(), runs: publicRuns }, null, 2) + "\n");
  console.log("resultados em eval/resultados-t1.json");
}

main().catch((e) => {
  console.error("erro:", (e as Error).message);
  process.exit(1);
});
