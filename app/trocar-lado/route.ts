/**
 * "Trocar de lado" da barra (S3; revisão P-I16): do Portal vai para a página do restaurante atual no app; do app vai
 * para o Portal (que abre a cópia da conta, não a vitrine original). Sem sessão de dono: tela de login.
 */
import { getOwnerSession } from "@/src/web/owner-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const s = await getOwnerSession();
  const to = u.searchParams.get("de") === "portal" && s?.current ? `/r/${s.current.slug}` : s ? "/parceiro/salao" : "/parceiro/entrar";
  return new Response(null, { status: 303, headers: { location: to } });
}
