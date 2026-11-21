/**
 * Cache das extrações dos 3 exemplos (espec. 4.4: "rotuladas 'processado anteriormente'"), gerado com o
 * modelo escolhido pela T1 pelo mesmo caminho do produto (runTask + conferência do código).
 * Uso: npx tsx scripts/gerar-cache-exemplos.ts (precisa de OPENROUTER_KEY_DEMO).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createOpenRouterGateway } from "../src/modules/ia/openrouter-gateway";
import { noopTracer } from "../src/modules/ia/gateway";
import { runTask } from "../src/modules/ia/run-task";
import { MODELS } from "../src/modules/ia/models";
import { buildMenuTask, menuInput, menuSystem, MENU_PROMPT_VERSION } from "../src/modules/ia/tasks/menu";
import { cleanExtraction } from "../src/modules/onboarding/domain/menu-extraction";
import { systemClock } from "../src/shared/clock";

const EXEMPLOS = { boteco: ["boteco.jpg"], burger: ["burger.jpg"], sushi: ["sushi-1.jpg", "sushi-2.jpg"] } as const;

async function main() {
  const gateway = createOpenRouterGateway(process.env.OPENROUTER_KEY_DEMO ?? "");
  for (const [id, files] of Object.entries(EXEMPLOS)) {
    const imgs = files.map((f) => new Uint8Array(readFileSync(`public/exemplos/${f}`)));
    const hash = createHash("sha256");
    imgs.forEach((i) => hash.update(i));
    const r = await runTask(buildMenuTask(MODELS.cardapio), menuSystem(), menuInput(imgs.map((data) => ({ data, mediaType: "image/jpeg" }))), { gateway, clock: systemClock, trace: noopTracer });
    if (r.status !== "ok") throw new Error(`${id}: ${r.reason}`);
    const out = { id, inputHash: hash.digest("hex"), model: r.model, promptVersion: MENU_PROMPT_VERSION, at: new Date().toISOString(), extraction: cleanExtraction(r.data) };
    writeFileSync(`src/modules/onboarding/adapters/exemplos/${id}.json`, JSON.stringify(out, null, 2) + "\n");
    console.log(`${id}: ${out.extraction.itens.length} itens · ${r.model}`);
  }
}
main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
