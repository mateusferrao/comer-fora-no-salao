/**
 * Bastidores › Configurações do protótipo (D58, D138, D139; planejamento S3 §4.7). Despacho por segmento (build).
 * Tudo exige a senha, exceto entrar; escritas com checagem de origem.
 */
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { getFlags, listPromptVersions, publishPrompt, rollbackPrompt, setFlag } from "@/src/modules/config/application/app-config";
import { recreateMyDemo, recreatePublicVitrine } from "@/src/modules/config/application/reset-demo";
import { testPrompt } from "@/src/modules/config/application/test-prompt";
import { FLAGS, PROMPT_MAX_CHARS, PROMPT_TASKS } from "@/src/modules/config/domain/flags";
import { consume } from "@/src/shared/rate-limit";
import { clientIp } from "@/src/shared/rate-limit-memory";
import { bastidoresEnabled, checkPassword, clearBastidores, isBastidores, writeBastidores } from "@/src/web/bastidores-session";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge, tooMany } from "@/src/web/http";
import { getOwnerSession } from "@/src/web/owner-session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const task = z.enum(PROMPT_TASKS);
const bodies = {
  entrar: z.object({ senha: z.string().max(200) }),
  publicar: z.object({ task, text: z.string().max(PROMPT_MAX_CHARS + 100), note: z.string().max(120).optional() }),
  voltar: z.object({ task, version: z.number().int().min(0) }),
  testar: z.object({ task, text: z.string().max(PROMPT_MAX_CHARS + 100) }),
  flag: z.object({ flag: z.enum(FLAGS), on: z.boolean() }),
  reset: z.object({ alvo: z.enum(["minha", "vitrine"]) }),
};

export async function GET(_req: Request, ctx: { params: Promise<{ acao: string }> }) {
  if ((await ctx.params).acao !== "estado") return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  if (!(await isBastidores())) return Response.json({ erro: "senha" }, { status: 401 });
  const prompts = Object.fromEntries(await Promise.all(PROMPT_TASKS.map(async (t) => [t, await listPromptVersions(getDb(), t)] as const)));
  return Response.json({ prompts, flags: await getFlags(getDb()) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const { acao } = await ctx.params;
  const now = new Date();
  const read = await readJson(req);
  if (read.erro === "grande") return tooLarge();
  const raw = read.value;
  if (acao === "entrar") {
    if (!bastidoresEnabled()) return Response.json({ erro: "desligado" }, { status: 503 });
    const lim = await consume(getDb(), `bastidores:${clientIp(req.headers)}`, 5, 900, now);
    if (!lim.ok) return tooMany(lim.retryAfterSec);
    const b = bodies.entrar.safeParse(raw);
    if (!b.success || !checkPassword(b.data.senha)) return Response.json({ erro: "senha" }, { status: 401 });
    await writeBastidores();
    return Response.json({ ok: true });
  }
  if (acao === "sair") {
    await clearBastidores();
    return Response.json({ ok: true });
  }
  if (!(await isBastidores())) return Response.json({ erro: "senha" }, { status: 401 });
  switch (acao) {
    case "publicar": {
      const b = bodies.publicar.safeParse(raw);
      if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
      const r = await publishPrompt(getDb(), b.data.task, b.data.text, b.data.note);
      return Response.json(r, { status: r.ok ? 200 : 400 });
    }
    case "voltar": {
      const b = bodies.voltar.safeParse(raw);
      if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
      const r = await rollbackPrompt(getDb(), b.data.task, b.data.version);
      return Response.json(r, { status: r.ok ? 200 : 404 });
    }
    case "testar": {
      const b = bodies.testar.safeParse(raw);
      if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
      const lim = await consume(getDb(), `bastidores-testar:${clientIp(req.headers)}`, 20, 3600, now);
      if (!lim.ok) return tooMany(lim.retryAfterSec);
      return Response.json(await testPrompt(getDb(), { task: b.data.task, instructions: b.data.text, now }));
    }
    case "flag": {
      const b = bodies.flag.safeParse(raw);
      if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
      return Response.json({ ok: true, flags: await setFlag(getDb(), b.data.flag, b.data.on) });
    }
    case "reset": {
      const b = bodies.reset.safeParse(raw);
      if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
      if (b.data.alvo === "vitrine") return Response.json(await recreatePublicVitrine(getDb(), { now }));
      const s = await getOwnerSession();
      if (!s) return Response.json({ erro: "sem_conta" }, { status: 409 });
      return Response.json(await recreateMyDemo(getDb(), { ownerId: s.owner.id, now }));
    }
    default:
      return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  }
}
