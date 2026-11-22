import { z } from "zod";
import { getDb } from "@/src/db/client";
import { recordStep } from "@/src/modules/onboarding/application/wizard";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
const input = z.object({ step: z.number().int().min(1).max(5) });

/** Entrada em cada passo do assistente (abandono por passo — H5). */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore({ draft: true });
  if (auth instanceof Response) return auth;
  const raw = await readJson(req);
  if (raw.erro === "grande") return tooLarge();
  const body = input.safeParse(raw.value);
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  await recordStep(getDb(), auth.r.id, body.data.step, "entrou", new Date());
  return Response.json({ ok: true });
}
