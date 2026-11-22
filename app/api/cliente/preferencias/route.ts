/**
 * Central de preferências do cliente (S6.1 — D198). Duas portas:
 * - Jornada: sessão do cliente (cookie) — GET lista, POST grava `{ restaurantId, patch }`;
 * - link do e-mail: token assinado `descadastro:<cliente>:<restaurante>` — POST grava `{ t, patch }` (só aquele par) e
 *   só DESLIGA (revisão S4–S6, segurança 5): o link não expira e pode ser encaminhado; ligar (consentir) exige a sessão.
 * Só POST grava (robôs de e-mail fazem GET); mesma origem + JSON; limite por IP.
 */
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { linkPatchAllowed, listCustomerPrefs, prefsTarget, setCustomerPrefs } from "@/src/modules/salao/application/preferences";
import { readCustomerId } from "@/src/web/customer-session";
import { overLimit, rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge } from "@/src/web/http";

export const dynamic = "force-dynamic";

const patch = z.object({ email: z.boolean().optional(), convites: z.boolean().optional(), lembretes: z.boolean().optional(), app: z.boolean().optional() }).strict();
const body = z.union([z.object({ t: z.string().min(10).max(400), patch }), z.object({ restaurantId: z.string().uuid(), patch })]);

export async function GET() {
  const customerId = await readCustomerId();
  if (!customerId) return Response.json({ erro: "sem_sessao" }, { status: 401 });
  return Response.json({ prefs: await listCustomerPrefs(getDb(), customerId) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const limited = await overLimit(req, "resumo");
  if (limited) return limited;
  const raw = await readJson(req);
  if (raw.erro === "grande") return tooLarge();
  const b = body.safeParse(raw.value);
  if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
  let target: { customerId: string; restaurantId: string } | null;
  if ("t" in b.data) {
    if (!linkPatchAllowed(b.data.patch)) return Response.json({ erro: "religar_na_jornada" }, { status: 403 });
    target = prefsTarget(b.data.t);
  }
  else {
    const customerId = await readCustomerId();
    target = customerId ? { customerId, restaurantId: b.data.restaurantId } : null;
  }
  if (!target) return Response.json({ erro: "link_invalido" }, { status: 400 });
  const r = await setCustomerPrefs(getDb(), { ...target, patch: b.data.patch });
  return r ? Response.json({ ok: true, prefs: { email: r.email, convites: r.convites, lembretes: r.lembretes, app: r.app } }) : Response.json({ erro: "nao_encontrado" }, { status: 404 });
}
