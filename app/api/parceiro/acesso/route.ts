import { z } from "zod";
import { getDb } from "@/src/db/client";
import { openEvaluatorLink } from "@/src/modules/contas/application/evaluator-link";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge, tooMany } from "@/src/web/http";
import { writeOwnerSession } from "@/src/web/owner-session";
import { afterLogin } from "@/src/web/account-bootstrap";

export const dynamic = "force-dynamic";

const input = z.object({ token: z.string().min(1).max(200) });

/** Link do avaliador (D126): POST (não GET), para que robôs de prévia de link não criem contas. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const raw = await readJson(req);
  if (raw.erro === "grande") return tooLarge();
  const body = input.safeParse(raw.value);
  if (!body.success) return Response.json({ erro: "invalido" }, { status: 404 });
  const r = await openEvaluatorLink(getDb(), { token: body.data.token, expected: process.env.EVALUATOR_LINK_TOKEN, now: new Date() });
  if (!r.ok) return r.erro === "limite" ? tooMany(r.retryAfterSec) : Response.json({ erro: "invalido" }, { status: 404 });
  await writeOwnerSession(r.ownerId);
  afterLogin(r.ownerId);
  return Response.json({ ok: true });
}
