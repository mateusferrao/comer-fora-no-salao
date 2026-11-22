import { z } from "zod";
import { getDb } from "@/src/db/client";
import { confirmCustomerCode } from "@/src/modules/salao/application/customer-login";
import { clientIp } from "@/src/shared/rate-limit-memory";
import { writeCustomerId } from "@/src/web/customer-session";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge, tooMany } from "@/src/web/http";

export const dynamic = "force-dynamic";

const input = z.object({ email: z.string().max(320), code: z.string().max(12) });

/** "Entrar" na Jornada, passo 2 (D257): confere o código e grava o cookie; e-mail sem cadastro de cliente não entra. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const raw = await readJson(req);
  if (raw.erro === "grande") return tooLarge();
  const body = input.safeParse(raw.value);
  if (!body.success) return Response.json({ erro: "dados_invalidos" }, { status: 400 });
  const v = await confirmCustomerCode(getDb(), { restaurantId: null, email: body.data.email, code: body.data.code, ip: clientIp(req.headers), now: new Date(), createIfMissing: false });
  if (!v.ok) {
    if (v.erro === "limite") return tooMany(v.retryAfterSec);
    return Response.json({ erro: v.erro, ...(v.restantes !== undefined ? { restantes: v.restantes } : {}) }, { status: v.erro === "sem_cadastro" ? 404 : 400 });
  }
  await writeCustomerId(v.customerId);
  return Response.json({ ok: true });
}
