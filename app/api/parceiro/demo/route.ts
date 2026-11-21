import { getOwnerSession } from "@/src/web/owner-session";
import { rejectCrossSite } from "@/src/web/guards";
import { ensureVitrineCopy } from "@/src/web/account-bootstrap";

export const dynamic = "force-dynamic";

/** "Tentar de novo": refaz a vitrine de demonstração da conta, se ela falhou. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: false });
  if (blocked) return blocked;
  const s = await getOwnerSession();
  if (!s) return Response.json({ erro: "sessao" }, { status: 401 });
  ensureVitrineCopy(s.owner.id);
  return Response.json({ ok: true });
}
