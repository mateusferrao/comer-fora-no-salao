import { z } from "zod";
import { getDb } from "@/src/db/client";
import { getMailSender } from "@/src/modules/contas/adapters/mail-factory";
import { getFlags } from "@/src/modules/config/application/app-config";
import { findRestaurantBySlug } from "@/src/modules/salao/application/context";
import { requestCustomerCode } from "@/src/modules/salao/application/customer-login";
import { clientIp } from "@/src/shared/rate-limit-memory";
import { writeCustomerId } from "@/src/web/customer-session";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";

export const dynamic = "force-dynamic";

const input = z.object({ email: z.string().max(320), accept: z.literal(true) });

/** Login do cliente, passo 1 (S4 — D154, D173): e-mail + aceite → código por e-mail. Com `x-e2e-token`, e-mails de teste recebem o código na resposta (padrão D123). */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const body = input.safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "dados_invalidos" }, { status: 400 });
  const db = getDb();
  const r = await findRestaurantBySlug(db, slug);
  if (!r || r.status !== "ativo") return Response.json({ erro: "restaurante_inexistente" }, { status: 404 });
  const flags = await getFlags(db);
  const res = await requestCustomerCode(db, {
    restaurantId: r.id,
    restaurantName: r.name,
    email: body.data.email,
    ip: clientIp(req.headers),
    now: new Date(),
    sender: getMailSender(),
    env: { E2E_LOGIN_TOKEN: process.env.E2E_LOGIN_TOKEN, PRESENTER_EMAILS: process.env.PRESENTER_EMAILS },
    e2eToken: req.headers.get("x-e2e-token"),
    emailLogin: flags.login_cliente_email,
  });
  if (res.ok && "semCodigo" in res) {
    await writeCustomerId(res.customerId);
    return Response.json({ ok: true, etapa: "perfil" });
  }
  if (res.ok) return Response.json({ ok: true, etapa: "codigo", email: res.email, ...(res.e2eCode ? { codigo: res.e2eCode } : {}) });
  if (res.erro === "limite") return tooMany(res.retryAfterSec);
  if (res.erro === "email_invalido") return Response.json({ erro: res.erro }, { status: 400 });
  return Response.json({ erro: res.erro }, { status: res.erro === "envio_indisponivel" ? 503 : 502 });
}
