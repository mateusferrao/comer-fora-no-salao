import { z } from "zod";
import { getDb } from "@/src/db/client";
import { updateMyContact } from "@/src/modules/salao/application/customer-login";
import { readCustomerId } from "@/src/web/customer-session";
import { overLimit, rejectCrossSite } from "@/src/web/guards";
import { readJson } from "@/src/web/http";

export const dynamic = "force-dynamic";

const body = z.object({ name: z.string().max(200), phone: z.string().max(40).nullable() });

/** "Seus dados" na Jornada (D250): o cliente logado corrige o próprio nome e telefone. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const limited = await overLimit(req, "identificacao");
  if (limited) return limited;
  const customerId = await readCustomerId();
  if (!customerId) return Response.json({ erro: "identificacao" }, { status: 401 });
  const b = body.safeParse(await readJson(req));
  if (!b.success) return Response.json({ erro: "dados_invalidos", campos: [] }, { status: 400 });
  const r = await updateMyContact(getDb(), { customerId, name: b.data.name, phone: b.data.phone, now: new Date() });
  if (r.ok) return Response.json({ ok: true });
  return r.erro === "sem_cliente" ? Response.json({ erro: "identificacao" }, { status: 401 }) : Response.json(r, { status: 400 });
}
