/**
 * Sessão do cliente no aparelho (espec. 3.5, 4.6): cookie `cf_cliente` assinado (httpOnly, SameSite=Lax,
 * Secure em HTTPS), separado do cookie do dono (S2). `cf_aparelho` identifica o aparelho para as leituras.
 * Só para rotas e páginas do servidor (usa next/headers).
 */
import { cookies, headers } from "next/headers";
import { signValue, verifySigned } from "@/src/shared/crypto";

export const CUSTOMER_COOKIE = "cf_cliente";
export const DEVICE_COOKIE = "cf_aparelho";
const MAX_AGE = 180 * 24 * 60 * 60;

/** A assinatura inclui a finalidade ("cliente:"): o cookie do dono (S2) usa outra e não se confunde (revisão S1). */
const PURPOSE = "cliente:";

export async function readCustomerId(): Promise<string | null> {
  const jar = await cookies();
  const v = verifySigned(jar.get(CUSTOMER_COOKIE)?.value);
  return v?.startsWith(PURPOSE) ? v.slice(PURPOSE.length) : null;
}

async function isHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto");
  return proto ? proto.split(",")[0]!.trim() === "https" : process.env.NODE_ENV === "production" && !h.get("host")?.startsWith("localhost");
}

export async function writeCustomerId(customerId: string): Promise<void> {
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, signValue(`${PURPOSE}${customerId}`), { httpOnly: true, sameSite: "lax", secure: await isHttps(), path: "/", maxAge: MAX_AGE });
}

export async function clearCustomer(): Promise<void> {
  const jar = await cookies();
  jar.delete(CUSTOMER_COOKIE);
}

export async function readDeviceId(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(DEVICE_COOKIE)?.value;
  return v && /^[0-9a-f-]{36}$/.test(v) ? v : null;
}
