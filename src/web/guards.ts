/**
 * Guardas das rotas públicas do cliente (revisão S1): mesma origem + JSON (CSRF) e limite de uso por IP.
 * Navegadores modernos enviam `Sec-Fetch-Site`; sem ele (ex.: testes de API), vale só a checagem de JSON.
 * Desde a S2 os limites são persistidos no Postgres (`consume`), no lugar dos em memória da D115.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { owners } from "@/src/db/schema";
import { E2E_SLUG } from "@/src/db/seed/e2e";
import { consume } from "@/src/shared/rate-limit";
import { clientIp } from "@/src/shared/rate-limit-memory";

export const LIMITS = {
  identificacao: { max: 10, windowMs: 60_000 },
  identificacaoRestaurante: { max: 120, windowMs: 60_000 },
  checkin: { max: 20, windowMs: 60_000 },
  leitura: { max: 60, windowMs: 60_000 },
  trocar: { max: 20, windowMs: 60_000 },
} as const;

export function rejectCrossSite(req: Request, { requireJson = true } = {}): Response | null {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return Response.json({ erro: "origem" }, { status: 403 });
  if (requireJson && !(req.headers.get("content-type") ?? "").includes("application/json")) return Response.json({ erro: "formato" }, { status: 415 });
  return null;
}

export async function overLimit(req: Request, name: keyof typeof LIMITS, extraKey = ""): Promise<Response | null> {
  const l = LIMITS[name];
  const r = await consume(getDb(), `${name}:${clientIp(req.headers)}${extraKey}`, l.max, Math.ceil(l.windowMs / 1000));
  return r.ok ? null : Response.json({ erro: "limite" }, { status: 429, headers: { "retry-after": String(r.retryAfterSec) } });
}

/** Restaurante E2E fixo e restaurantes das contas de teste do E2E (D123): fora dos limites das rotas públicas. */
export async function isE2eRestaurant(r: { slug: string; ownerId: string }): Promise<boolean> {
  if (r.slug === E2E_SLUG) return true;
  const [o] = await getDb().select({ via: owners.via }).from(owners).where(eq(owners.id, r.ownerId));
  return o?.via === "e2e";
}
