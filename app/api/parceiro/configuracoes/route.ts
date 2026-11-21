import { z } from "zod";
import { getFlags } from "@/src/modules/config/application/app-config";
import { createToken, revokeTokens } from "@/src/modules/mcp/tokens";
import { getDb } from "@/src/db/client";
import { MENU_CATEGORIES } from "@/src/modules/beneficios/domain/menu";
import { OFFER_KINDS } from "@/src/modules/beneficios/domain/offers";
import { INTENSITIES, openingBlockSchema } from "@/src/modules/beneficios/domain/slots";
import {
  addMenuItem,
  addSlot,
  deactivateSlot,
  getSettingsView,
  setMenuItemActive,
  updateMenuItem,
  updateOffer,
  updateRestaurantInfo,
  updateSlot,
  updateTone,
  previewTone,
  updateNotifySettings,
  setItemOfferAllowed,
  deleteMenuItem,
  updateAiProfile,
} from "@/src/modules/config/application/update-settings";
import { notifySettingsInput } from "@/src/modules/config/domain/notify-settings";
import { consume } from "@/src/shared/rate-limit";
import { rejectCrossSite } from "@/src/web/guards";
import { readJson, tooMany } from "@/src/web/http";
import { requireStore } from "@/src/web/portal-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const offer = z.object({ kind: z.enum(OFFER_KINDS), itemId: z.string().uuid(), pct: z.number().int().min(1).max(100).optional() });
const slot = z.object({ days: z.array(z.number().int().min(0).max(6)).min(1), startMin: z.number().int().min(0).max(1440), endMin: z.number().int().min(0).max(1440), intensity: z.enum(INTENSITIES), extraTables: z.number().int().min(1).max(200) });
const body = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("oferta"), role: z.enum(["agora", "recompensa", "convite"]), slotId: z.string().uuid().optional(), offer, weeklyCap: z.number().int().min(1).max(999).optional(), inviteText: z.string().max(300).optional() }),
  z.object({ acao: z.literal("item_editar"), itemId: z.string().uuid(), name: z.string().max(120), priceCents: z.number().int().min(0).max(1_000_000), category: z.enum(MENU_CATEGORIES) }),
  z.object({ acao: z.literal("item_ativo"), itemId: z.string().uuid(), active: z.boolean() }),
  z.object({ acao: z.literal("item_novo"), name: z.string().max(120), priceCents: z.number().int().min(0).max(1_000_000), category: z.enum(MENU_CATEGORIES) }),
  slot.extend({ acao: z.literal("faixa_editar"), slotId: z.string().uuid() }),
  slot.extend({ acao: z.literal("faixa_nova") }),
  z.object({ acao: z.literal("faixa_desativar"), slotId: z.string().uuid() }),
  z.object({ acao: z.literal("tom"), tone: z.string().max(400) }),
  z.object({ acao: z.literal("agente_gerar") }),
  // S6.1 (D196): "Avisos e automação" — objeto inteiro validado.
  z.object({ acao: z.literal("avisos"), settings: notifySettingsInput }),
  z.object({ acao: z.literal("agente_revogar") }),
  z.object({ acao: z.literal("tom_previa"), tone: z.string().max(400), slotId: z.string().uuid(), about: z.string().max(800).optional(), avoid: z.string().max(400).optional() }),
  // S6.3a (D197): IA do restaurante e cardápio.
  z.object({ acao: z.literal("ia_perfil"), about: z.string().max(800), avoid: z.string().max(400), features: z.object({ agente: z.boolean(), aprende: z.boolean() }).strict() }),
  z.object({ acao: z.literal("item_oferta"), itemId: z.string().uuid(), allowed: z.boolean() }),
  z.object({ acao: z.literal("item_excluir"), itemId: z.string().uuid() }),
  z.object({
    acao: z.literal("restaurante"),
    name: z.string().max(80),
    ticketCents: z.number().int().min(100).max(1_000_000).nullable(),
    marginPct: z.number().int().min(1).max(95).nullable(),
    tables: z.number().int().min(1).max(500).nullable(),
    weeklyCustomers: z.number().int().min(0).max(100_000).nullable(),
    description: z.string().max(400).nullable(),
    address: z.string().max(160).nullable(),
    opening: z.array(openingBlockSchema).min(1).max(7),
  }),
]);

export async function GET() {
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  return Response.json(await getSettingsView(getDb(), auth.r.id), { headers: { "cache-control": "no-store" } });
}

/** Configurações (D120): cada ação vira versão nova ou atualização registrada. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const auth = await requireStore();
  if (auth instanceof Response) return auth;
  if (auth.r.status !== "ativo") return Response.json({ erro: "rascunho" }, { status: 409 });
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ erro: "formato" }, { status: 400 });
  const db = getDb();
  const now = new Date();
  const lim = await consume(db, `config:${auth.r.id}`, 120, 3600, now);
  if (!lim.ok) return tooMany(lim.retryAfterSec);
  const d = parsed.data;
  const rid = auth.r.id;
  if (d.acao === "avisos") return Response.json(await updateNotifySettings(db, { restaurantId: rid, input: d.settings, now }));
  if (d.acao === "ia_perfil") {
    // Limite próprio das instruções do dono (30/h): além do limite geral das Configurações.
    const l = await consume(db, `config:ia:${rid}`, 30, 3600, now);
    if (!l.ok) return tooMany(l.retryAfterSec);
    const r = await updateAiProfile(db, { restaurantId: rid, about: d.about, avoid: d.avoid, features: d.features, now });
    return r.ok ? Response.json(r) : Response.json(r, { status: 422 });
  }
  if (d.acao === "item_oferta" || d.acao === "item_excluir") {
    const r = d.acao === "item_oferta" ? await setItemOfferAllowed(db, { restaurantId: rid, itemId: d.itemId, allowed: d.allowed, now }) : await deleteMenuItem(db, { restaurantId: rid, itemId: d.itemId, now });
    return r.ok ? Response.json(r) : Response.json(r, { status: 422 });
  }
  // Agente (MCP; flag): token mostrado uma vez; guardado só o hash.
  if (d.acao === "agente_gerar" || d.acao === "agente_revogar") {
    if (!(await getFlags(db)).mcp) return Response.json({ erro: "desligado" }, { status: 404 });
    if (d.acao === "agente_revogar") {
      await revokeTokens(db, rid, now);
      return Response.json({ ok: true });
    }
    const t = await createToken(db, rid, now);
    return Response.json({ ok: true, token: t.token, hint: t.hint }, { headers: { "cache-control": "no-store" } });
  }
  const r =
    d.acao === "oferta"
      ? await updateOffer(db, { restaurantId: rid, role: d.role, slotId: d.slotId, offer: d.offer, weeklyCap: d.weeklyCap, inviteText: d.inviteText, now })
      : d.acao === "item_editar"
        ? await updateMenuItem(db, { restaurantId: rid, itemId: d.itemId, name: d.name, priceCents: d.priceCents, category: d.category, now })
        : d.acao === "item_ativo"
          ? await setMenuItemActive(db, { restaurantId: rid, itemId: d.itemId, active: d.active, now })
          : d.acao === "item_novo"
            ? await addMenuItem(db, { restaurantId: rid, name: d.name, priceCents: d.priceCents, category: d.category, now })
            : d.acao === "faixa_editar"
              ? await updateSlot(db, { restaurantId: rid, slotId: d.slotId, days: d.days, startMin: d.startMin, endMin: d.endMin, intensity: d.intensity, extraTables: d.extraTables, now })
              : d.acao === "faixa_nova"
                ? await addSlot(db, { restaurantId: rid, ownerId: auth.s.owner.id, days: d.days, startMin: d.startMin, endMin: d.endMin, intensity: d.intensity, extraTables: d.extraTables, now })
                : d.acao === "faixa_desativar"
                  ? await deactivateSlot(db, { restaurantId: rid, slotId: d.slotId, now })
                  : d.acao === "tom"
                    ? await updateTone(db, { restaurantId: rid, tone: d.tone, now })
                    : d.acao === "tom_previa"
                      ? await previewTone(db, { restaurantId: rid, ownerId: auth.s.owner.id, slotId: d.slotId, tone: d.tone, about: d.about, avoid: d.avoid, now })
                      : d.acao === "restaurante"
                        ? await updateRestaurantInfo(db, { restaurantId: rid, name: d.name, ticketCents: d.ticketCents, marginPct: d.marginPct, tables: d.tables, weeklyCustomers: d.weeklyCustomers, description: d.description, address: d.address, opening: d.opening, now })
                        : ({ ok: false, erro: "formato" } as const);
  return r.ok ? Response.json(r) : Response.json(r, { status: 422 });
}
