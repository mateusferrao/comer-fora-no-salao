/**
 * Sessão do dono (D118): cookie `cf_dono` assinado com a finalidade "dono:" (não se confunde com o do
 * cliente) e `cf_loja` com o restaurante atual ("loja:"), sempre conferido contra o dono.
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getDb } from "@/src/db/client";
import { signValue, verifySigned } from "@/src/shared/crypto";
import { findOwner, listOwnerRestaurants, touchOwner, type OwnedRestaurant, type OwnerRow } from "@/src/modules/contas/application/owner-access";

export const OWNER_COOKIE = "cf_dono";
export const STORE_COOKIE = "cf_loja";
const MAX_AGE = 30 * 24 * 60 * 60;

async function isHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto");
  return proto ? proto.split(",")[0]!.trim() === "https" : process.env.NODE_ENV === "production" && !h.get("host")?.startsWith("localhost");
}

async function readPurpose(name: string, purpose: string): Promise<string | null> {
  const jar = await cookies();
  const v = verifySigned(jar.get(name)?.value);
  return v?.startsWith(purpose) ? v.slice(purpose.length) : null;
}

export async function writeOwnerSession(ownerId: string): Promise<void> {
  const jar = await cookies();
  const secure = await isHttps();
  // Data de emissão no valor assinado: a sessão vence em 30 dias também no servidor (revisão da S2).
  jar.set(OWNER_COOKIE, signValue(`dono:${ownerId}:${Date.now()}`), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: MAX_AGE });
  jar.delete(STORE_COOKIE);
}

export async function setCurrentRestaurant(restaurantId: string): Promise<void> {
  const jar = await cookies();
  jar.set(STORE_COOKIE, signValue(`loja:${restaurantId}`), { httpOnly: true, sameSite: "lax", secure: await isHttps(), path: "/", maxAge: MAX_AGE });
}

export async function clearOwnerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(OWNER_COOKIE);
  jar.delete(STORE_COOKIE);
}

export type OwnerSession = { owner: OwnerRow; restaurants: OwnedRestaurant[]; current: OwnedRestaurant | null };

/** `dono:<id>:<emitidoEmMs>` → id, se ainda dentro dos 30 dias. Formato antigo (sem data) não vale mais. */
export function parseOwnerValue(v: string | null, now: Date): string | null {
  const m = v ? /^([0-9a-f-]{36}):(\d{13})$/.exec(v) : null;
  if (!m) return null;
  const age = now.getTime() - Number(m[2]);
  return age >= -60_000 && age <= MAX_AGE * 1000 ? m[1]! : null;
}

/** `null` = sem sessão válida (cookie ausente, adulterado, vencido ou dono apagado pela limpeza). */
export const getOwnerSession = cache(async (now: Date = new Date()): Promise<OwnerSession | null> => {
  const ownerId = parseOwnerValue(await readPurpose(OWNER_COOKIE, "dono:"), now);
  if (!ownerId) return null;
  const db = getDb();
  const owner = await findOwner(db, ownerId);
  if (!owner) return null;
  await touchOwner(db, owner.id, now);
  const list = await listOwnerRestaurants(db, owner.id);
  const wanted = await readPurpose(STORE_COOKIE, "loja:");
  const current = list.find((r) => r.id === wanted) ?? list.find((r) => r.copiedFrom === null && r.kind === "teste") ?? list[0] ?? null;
  return { owner, restaurants: list, current };
});
