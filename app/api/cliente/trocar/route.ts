import { clearCustomer } from "@/src/web/customer-session";
import { overLimit, rejectCrossSite } from "@/src/web/guards";

export const dynamic = "force-dynamic";

/** "Testar como outro cliente (fictício)" (D113): troca só o cookie deste aparelho; a pessoa anterior continua no banco. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: false }) ?? (await overLimit(req, "trocar"));
  if (blocked) return blocked;
  await clearCustomer();
  return Response.json({ ok: true });
}
