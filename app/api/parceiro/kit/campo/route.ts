import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/src/db/client";
import { editVersionField, newKitVersion, promoteWinner, regenerateField } from "@/src/modules/kit/application/kit";
import { getFlags } from "@/src/modules/config/application/app-config";
import { VERSION_FIELDS } from "@/src/modules/kit/domain/templates";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const target = z.object({ label: z.enum(["A", "B"]), field: z.enum(VERSION_FIELDS) });

/** Editar um campo (texto do dono). */
export async function PUT(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const body = target.extend({ value: z.string().max(200) }).safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  const r = await editVersionField(getDb(), { restaurantId: auth.r.id, ...body.data, now: new Date() });
  return r.ok ? Response.json(r) : Response.json(r, { status: r.erro === "texto" ? 422 : r.erro === "travado" ? 409 : 404 });
}

/** "Criar nova versão" (versão com leituras fica travada): QR novo, a antiga é aposentada. */
export async function PATCH(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const body = z.union([z.object({ label: z.enum(["A", "B"]) }), z.object({ promover: z.enum(["display", "cartaz"]) })]).safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  if ("promover" in body.data) {
    if (!(await getFlags(getDb())).ab) return Response.json({ erro: "desligado" }, { status: 404 });
    const pr = await promoteWinner(getDb(), { restaurantId: auth.r.id, piece: body.data.promover, now: new Date() });
    return pr.ok ? Response.json(pr) : Response.json(pr, { status: 409 });
  }
  const r = await newKitVersion(getDb(), { restaurantId: auth.r.id, label: body.data.label, now: new Date() });
  return r.ok ? Response.json(r) : Response.json(r, { status: r.erro === "sem_leituras" ? 409 : 404 });
}

/** "Regenerar" um campo com a IA. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  const body = target.safeParse(await readJson(req));
  if (!body.success) return Response.json({ erro: "formato" }, { status: 400 });
  const r = await regenerateField(getDb(), { restaurantId: auth.r.id, ownerId: auth.s.owner.id, ...body.data, now: new Date(), schedule: (fn) => after(fn) });
  if (!r.ok) return r.erro === "limite" ? tooMany(r.retryAfterSec) : Response.json(r, { status: r.erro === "travado" ? 409 : 404 });
  return Response.json(r);
}
