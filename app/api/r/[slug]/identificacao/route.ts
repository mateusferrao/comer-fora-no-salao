import { getDb } from "@/src/db/client";
import { findRestaurantBySlug } from "@/src/modules/salao/application/context";
import { identifyCustomer, identifyInputSchema, PhoneInUseError } from "@/src/modules/salao/application/identify-customer";
import { safeErr } from "@/src/shared/safe-err";
import { isE2eRestaurant, overLimit, rejectCrossSite } from "@/src/web/guards";
import { writeCustomerId } from "@/src/web/customer-session";
import { log } from "@/src/shared/log";

export const dynamic = "force-dynamic";

/** Identificação do cliente (espec. 3.5.3). O telefone vira HMAC + 4 dígitos; nada de PII em log. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const parsed = identifyInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const campos = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")))];
    return Response.json({ erro: "dados_invalidos", campos }, { status: 400 });
  }
  const db = getDb();
  const r = await findRestaurantBySlug(db, slug);
  if (!r || r.status !== "ativo") return Response.json({ erro: "restaurante_inexistente" }, { status: 404 });
  // Limite por IP + global por restaurante; o restaurante E2E oculto fica de fora (o E2E de produção cria clientes em sequência).
  const limited = (await isE2eRestaurant(r)) ? null : ((await overLimit(req, "identificacao")) ?? (await overLimit(req, "identificacaoRestaurante", `:${r.id}`)));
  if (limited) return limited;
  try {
    const { customerId } = await identifyCustomer(db, r.id, parsed.data);
    await writeCustomerId(customerId);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof PhoneInUseError) return Response.json({ erro: "telefone_em_uso" }, { status: 409 });
    log.error("falhou", { area: "identificacao", err: safeErr(err) });
    return Response.json({ erro: "falha" }, { status: 500 });
  }
}
