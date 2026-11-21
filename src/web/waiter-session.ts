/**
 * Sessão do garçom (S6.2 — D190): cookie `cf_garcom` assinado com finalidade própria (`garcom:<id do token>`),
 * httpOnly, SameSite=Lax, 30 dias renovados a cada uso, separado dos cookies do dono e do cliente. O token do link
 * nunca vai para o cookie; a revogação é conferida no banco a cada chamada (`resolveWaiterSession`).
 */
import { cookies, headers } from "next/headers";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { resolveWaiterSession } from "@/src/modules/salao/application/waiter-tokens";
import { signValue, verifySigned } from "@/src/shared/crypto";

export const WAITER_COOKIE = "cf_garcom";
const PURPOSE = "garcom:";
const MAX_AGE = 30 * 24 * 60 * 60;

async function isHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto");
  return proto ? proto.split(",")[0]!.trim() === "https" : process.env.NODE_ENV === "production" && !h.get("host")?.startsWith("localhost");
}

export async function writeWaiterSession(tokenId: string): Promise<void> {
  const jar = await cookies();
  jar.set(WAITER_COOKIE, signValue(`${PURPOSE}${tokenId}`), { httpOnly: true, sameSite: "lax", secure: await isHttps(), path: "/", maxAge: MAX_AGE });
}

/** Sessão válida agora (cookie + token não revogado + flag `modo_garcom` + restaurante ativo) ou null. */
export async function readWaiterSession() {
  const jar = await cookies();
  const v = verifySigned(jar.get(WAITER_COOKIE)?.value);
  if (!v?.startsWith(PURPOSE)) return null;
  const db = getDb();
  if (!(await getFlags(db)).modo_garcom) return null;
  return resolveWaiterSession(db, v.slice(PURPOSE.length));
}
