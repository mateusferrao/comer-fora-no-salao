import { rejectCrossSite } from "@/src/web/guards";
import { clearOwnerSession } from "@/src/web/owner-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: false });
  if (blocked) return blocked;
  await clearOwnerSession();
  return Response.json({ ok: true });
}
