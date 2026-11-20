/**
 * Sessão dos Bastidores (D139; planejamento S3 §4.7): senha em `BASTIDORES_PASSWORD`, comparada por hash em tempo
 * constante; cookie assinado próprio (separado do dono), 8 h, SameSite=Strict. Sem a variável, a área fica desligada.
 */
import { cookies, headers } from "next/headers";
import { safeEqual, signValue, verifySigned } from "@/src/shared/crypto";

const COOKIE = "cf_bastidores";
const TTL_MS = 8 * 3600_000;

export function bastidoresEnabled(): boolean {
  return (process.env.BASTIDORES_PASSWORD ?? "").trim().length >= 8;
}

export function checkPassword(given: string): boolean {
  const expected = (process.env.BASTIDORES_PASSWORD ?? "").trim();
  return expected.length >= 8 && safeEqual(given.trim(), expected);
}

export async function isBastidores(now = Date.now()): Promise<boolean> {
  if (!bastidoresEnabled()) return false;
  const v = verifySigned((await cookies()).get(COOKIE)?.value);
  const m = v ? /^bastidores:(\d{13})$/.exec(v) : null;
  return !!m && now - Number(m[1]) <= TTL_MS && Number(m[1]) <= now + 60_000;
}

export async function writeBastidores(): Promise<void> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto");
  const secure = proto ? proto.split(",")[0]!.trim() === "https" : process.env.NODE_ENV === "production" && !h.get("host")?.startsWith("localhost");
  (await cookies()).set(COOKIE, signValue(`bastidores:${Date.now()}`), { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: TTL_MS / 1000 });
}

export async function clearBastidores(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
