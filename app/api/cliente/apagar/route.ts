import { getDb } from "@/src/db/client";
import { deleteCustomerData } from "@/src/modules/salao/application/customer-login";
import { clearCustomer, readCustomerId } from "@/src/web/customer-session";
import { overLimit, rejectCrossSite } from "@/src/web/guards";

export const dynamic = "force-dynamic";

/** "Apagar meus dados" (D171): some nome, telefone e e-mail; as visitas ficam anônimas nas métricas do restaurante. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req, { requireJson: false });
  if (blocked) return blocked;
  const limited = await overLimit(req, "apagar");
  if (limited) return limited;
  const customerId = await readCustomerId();
  if (customerId) await deleteCustomerData(getDb(), customerId);
  await clearCustomer();
  return Response.json({ ok: true });
}
