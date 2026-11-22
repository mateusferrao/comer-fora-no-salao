import { z } from "zod";
import { getDb } from "@/src/db/client";
import { unsubscribe } from "@/src/modules/salao/application/deliver-messages";
import { verifySigned } from "@/src/shared/crypto";
import { overLimit, rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge } from "@/src/web/http";

export const dynamic = "force-dynamic";

const body = z.object({ t: z.string().max(400) });

/** Descadastro pelo link do e-mail (S4.4, revisão de produto I1): token assinado; só por POST (scanners de e-mail fazem GET). */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const limited = await overLimit(req, "trocar");
  if (limited) return limited;
  const raw = await readJson(req);
  if (raw.erro === "grande") return tooLarge();
  const b = body.safeParse(raw.value);
  const v = b.success ? verifySigned(b.data.t) : null;
  const m = v ? /^descadastro:([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(v) : null;
  if (!m) return Response.json({ erro: "link_invalido" }, { status: 400 });
  await unsubscribe(getDb(), { customerId: m[1]!, restaurantId: m[2]! });
  return Response.json({ ok: true });
}
