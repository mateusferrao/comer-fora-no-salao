import { z } from "zod";
import { getDb } from "@/src/db/client";
import { verifyLoginCode } from "@/src/modules/contas/application/verify-code";
import { clientIp } from "@/src/shared/rate-limit-memory";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge, tooMany } from "@/src/web/http";
import { writeOwnerSession } from "@/src/web/owner-session";
import { afterLogin } from "@/src/web/account-bootstrap";

export const dynamic = "force-dynamic";

const input = z.object({ email: z.string().max(320), codigo: z.string().max(12) });
const STATUS = { email_invalido: 400, formato: 400, incorreto: 401, expirado: 410, sem_codigo: 410, bloqueado: 423 } as const;

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const raw = await readJson(req);
  if (raw.erro === "grande") return tooLarge();
  const body = input.safeParse(raw.value);
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  const r = await verifyLoginCode(getDb(), { email: body.data.email, code: body.data.codigo, ip: clientIp(req.headers), now: new Date() });
  if (r.ok) {
    await writeOwnerSession(r.ownerId);
    afterLogin(r.ownerId);
    return Response.json({ ok: true, novo: r.created });
  }
  if (r.erro === "limite") return tooMany(r.retryAfterSec);
  return Response.json({ erro: r.erro, ...(r.restantes !== undefined ? { restantes: r.restantes } : {}) }, { status: STATUS[r.erro] });
}
