/**
 * Link do garçom no Portal (S6.2 — D190): criar (mostra o link e o QR UMA vez; revoga o anterior) e revogar.
 * Restaurante sempre da sessão; flag `modo_garcom` desligada → 404.
 */
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { createWaiterToken, revokeWaiterTokens } from "@/src/modules/salao/application/waiter-tokens";
import { consume } from "@/src/shared/rate-limit";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";
import { publicBaseUrl, qrDataUri } from "@/src/web/qr";

export const dynamic = "force-dynamic";
const body = z.object({ acao: z.enum(["criar", "revogar"]) });

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const db = getDb();
  if (!(await getFlags(db)).modo_garcom) return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  const b = body.safeParse(await readJson(req));
  if (!b.success) return Response.json({ erro: "entrada" }, { status: 400 });
  const now = new Date();
  const lim = await consume(db, `garcom:link:${auth.r.id}`, 20, 3600, now);
  if (!lim.ok) return tooMany(lim.retryAfterSec);
  if (b.data.acao === "revogar") {
    await revokeWaiterTokens(db, auth.r.id, now);
    return Response.json({ ok: true });
  }
  const t = await createWaiterToken(db, { restaurantId: auth.r.id, now });
  const url = `${publicBaseUrl()}/garcom/${t.token}`;
  return Response.json({ ok: true, url, qr: await qrDataUri(url), createdAt: t.createdAt.toISOString() }, { headers: { "cache-control": "no-store" } });
}
