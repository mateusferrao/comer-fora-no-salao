import { z } from "zod";
import { getDb } from "@/src/db/client";
import { getMailSender } from "@/src/modules/contas/adapters/mail-factory";
import { requestLoginCode } from "@/src/modules/contas/application/request-code";
import { clientIp } from "@/src/shared/rate-limit-memory";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";

export const dynamic = "force-dynamic";

const input = z.object({ email: z.string().max(320) });

/** Pedir código de login (D118). Com `x-e2e-token` válido, e-mails de teste recebem o código na resposta (D123). */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = input.safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "email_invalido" }, { status: 400 });
  const r = await requestLoginCode(getDb(), {
    email: body.data.email,
    ip: clientIp(req.headers),
    now: new Date(),
    sender: getMailSender(),
    env: { E2E_LOGIN_TOKEN: process.env.E2E_LOGIN_TOKEN, PRESENTER_EMAILS: process.env.PRESENTER_EMAILS },
    e2eToken: req.headers.get("x-e2e-token"),
  });
  if (r.ok) return Response.json({ ok: true, dica: r.hint, ...(r.e2eCode ? { codigo: r.e2eCode } : {}) });
  if (r.erro === "limite") return tooMany(r.retryAfterSec);
  if (r.erro === "email_invalido") return Response.json({ erro: r.erro }, { status: 400 });
  return Response.json({ erro: r.erro }, { status: r.erro === "envio_indisponivel" ? 503 : 502 });
}
