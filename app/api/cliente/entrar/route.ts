import { z } from "zod";
import { getDb } from "@/src/db/client";
import { getMailSender } from "@/src/modules/contas/adapters/mail-factory";
import { getFlags } from "@/src/modules/config/application/app-config";
import { requestCustomerCode } from "@/src/modules/salao/application/customer-login";
import { clientIp } from "@/src/shared/rate-limit-memory";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";

export const dynamic = "force-dynamic";

const input = z.object({ email: z.string().max(320) });

/**
 * "Entrar" na Jornada (D257): o cliente que já se cadastrou num check-in entra só com e-mail + código, sem restaurante,
 * sem aceite e sem visita (para ver e corrigir os próprios dados). Mesmos limites e o mesmo token de E2E do check-in.
 */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = input.safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "dados_invalidos" }, { status: 400 });
  const db = getDb();
  const res = await requestCustomerCode(db, {
    restaurantId: null,
    restaurantName: null,
    email: body.data.email,
    ip: clientIp(req.headers),
    now: new Date(),
    sender: getMailSender(),
    env: { E2E_LOGIN_TOKEN: process.env.E2E_LOGIN_TOKEN, PRESENTER_EMAILS: process.env.PRESENTER_EMAILS },
    e2eToken: req.headers.get("x-e2e-token"),
    emailLogin: (await getFlags(db)).login_cliente_email,
  });
  if (res.ok && !("semCodigo" in res)) return Response.json({ ok: true, etapa: "codigo", email: res.email, ...(res.e2eCode ? { codigo: res.e2eCode } : {}) });
  if (!res.ok && res.erro === "limite") return tooMany(res.retryAfterSec);
  if (!res.ok && res.erro === "email_invalido") return Response.json({ erro: res.erro }, { status: 400 });
  return Response.json({ erro: res.ok ? "envio_indisponivel" : res.erro }, { status: !res.ok && res.erro === "envio" ? 502 : 503 });
}
