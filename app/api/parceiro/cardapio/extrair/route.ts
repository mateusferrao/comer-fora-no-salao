import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { isExampleId } from "@/src/modules/onboarding/adapters/example-source";
import { startAiExtraction, startCachedExtraction } from "@/src/modules/onboarding/application/extract-menu";
import { recordStep } from "@/src/modules/onboarding/application/wizard";
import { clientIp } from "@/src/shared/rate-limit-memory";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooLarge, tooMany } from "@/src/web/http";
import { requireStore, sniffImage } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 5;
/** Teto do corpo antes de ler o multipart (revisão da S2): o navegador manda JPEGs de 1600 px (~0,3–2 MB cada). */
const MAX_BODY = 24 * 1024 * 1024;
const cached = z.object({ source: z.literal("exemplo"), exampleId: z.string().max(20) });

/**
 * Passo 1: exemplo (pronto na hora) ou foto/PDF (multipart, já convertidos em JPEG no navegador —
 * D127). A IA roda depois da resposta (`after`); a imagem fica só em memória e é descartada (D50).
 */
export async function POST(req: Request) {
  const ctype = req.headers.get("content-type") ?? "";
  const blocked = rejectCrossSite(req, { requireJson: false });
  if (blocked) return blocked;
  const auth = await requireStore({ draft: true });
  if (auth instanceof Response) return auth;
  const db = getDb();
  const now = new Date();

  if (ctype.includes("application/json")) {
    const raw = await readJson(req);
    if (raw.erro === "grande") return tooLarge();
    const body = cached.safeParse(raw.value);
    if (!body.success || (body.data.source === "exemplo" && !isExampleId(body.data.exampleId ?? ""))) return Response.json({ erro: "formato" }, { status: 400 });
    const id = await startCachedExtraction(db, { restaurantId: auth.r.id, source: body.data.source, exampleId: body.data.exampleId as never, now });
    await recordStep(db, auth.r.id, 1, "concluiu", now);
    return Response.json({ ok: true, extractionId: id, status: "pronto" });
  }
  if (!ctype.includes("multipart/form-data")) return Response.json({ erro: "formato" }, { status: 415 });
  const len = Number(req.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(len)) return Response.json({ erro: "formato" }, { status: 411 });
  if (len > MAX_BODY) return Response.json({ erro: "tamanho" }, { status: 413 });
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ erro: "formato" }, { status: 400 });
  const files = form.getAll("paginas").filter((f): f is File => f instanceof File);
  if (!files.length || files.length > MAX_PAGES) return Response.json({ erro: "paginas" }, { status: 400 });
  const images: Array<{ data: Uint8Array; mediaType: string }> = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) return Response.json({ erro: "tamanho" }, { status: 413 });
    const data = new Uint8Array(await f.arrayBuffer());
    const mediaType = sniffImage(data);
    if (!mediaType) return Response.json({ erro: "tipo" }, { status: 415 });
    images.push({ data, mediaType });
  }
  const source = form.get("origem") === "pdf" ? "pdf" : "foto";
  const r = await startAiExtraction(db, { restaurantId: auth.r.id, ownerId: auth.s.owner.id, ip: clientIp(req.headers), source, images, now });
  if (!r.ok) return tooMany(r.retryAfterSec);
  after(r.run);
  await recordStep(db, auth.r.id, 1, "concluiu", now);
  return Response.json({ ok: true, extractionId: r.extractionId, status: "lendo" });
}
