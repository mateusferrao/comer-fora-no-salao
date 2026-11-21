/**
 * "Adicionar à agenda" (S5.2): `.ics` de 1 evento do convite real, pelo link assinado (vale no app e no e-mail,
 * que abre sem o cookie). Qualquer falha → o mesmo 404 (o grupo de controle nunca descobre o fantasma).
 */
import { getDb } from "@/src/db/client";
import { inviteCalendar } from "@/src/modules/salao/application/agenda";
import { overLimit } from "@/src/web/guards";
import { publicBaseUrl } from "@/src/web/qr";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = await overLimit(req, "agenda");
  if (limited) return limited;
  const t = new URL(req.url).searchParams.get("t");
  const cal = t && t.length <= 200 ? await inviteCalendar(getDb(), { token: t, now: new Date(), baseUrl: publicBaseUrl() }) : null;
  if (!cal) return new Response("Convite não encontrado.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  return new Response(cal.body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${cal.filename}"`,
      "cache-control": "no-store",
    },
  });
}
