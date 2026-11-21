import { clearCustomer } from "@/src/web/customer-session";
import { rejectCrossSite } from "@/src/web/guards";

export const dynamic = "force-dynamic";

/** "Sair" na Jornada (D156): tira o cliente deste aparelho; o próximo check-in pede o e-mail de novo. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: false });
  if (blocked) return blocked;
  await clearCustomer();
  return Response.json({ ok: true });
}
