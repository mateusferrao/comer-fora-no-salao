/** Conferir código de login (D118): 5 tentativas, 10 min, uso único; cria a conta no 1º acesso. */
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { loginCodes, owners } from "@/src/db/schema";
import { encryptEmail, hmacEmail, hmacLoginCode, safeEqual } from "@/src/shared/crypto";
import { consume, consumeAll } from "@/src/shared/rate-limit";
import { E2E_EMAIL_RE, isLoginCodeFormat, LOGIN_CODE_MAX_ATTEMPTS, loginCodeState, maskEmail, parseEmail } from "../domain/login-code";

export type VerifyCodeResult =
  | { ok: true; ownerId: string; created: boolean }
  | { ok: false; erro: "email_invalido" | "formato" | "incorreto" | "expirado" | "bloqueado" | "sem_codigo" | "limite"; restantes?: number; retryAfterSec?: number };

export const NEW_ACCOUNTS_PER_IP_DAY = 10;
export const NEW_ACCOUNTS_PER_DAY = 100;

export async function verifyLoginCode(db: Db, p: { email: string; code: string; ip: string; now: Date }): Promise<VerifyCodeResult> {
  const email = parseEmail(p.email);
  if (!email) return { ok: false, erro: "email_invalido" };
  const code = p.code.replace(/\s/g, "");
  if (!isLoginCodeFormat(code)) return { ok: false, erro: "formato" };
  const e2e = E2E_EMAIL_RE.test(email);
  if (!e2e) {
    const lim = await consume(db, `login:verificar:${p.ip}`, 20, 3600, p.now);
    if (!lim.ok) return { ok: false, erro: "limite", retryAfterSec: lim.retryAfterSec };
  }
  const emailHmac = hmacEmail(email);
  // S6 (D187): e-mail cifrado só para o resumo semanal; contas E2E nunca guardam (o agendador as ignora).
  const emailEnc = e2e ? null : encryptEmail(email);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(loginCodes)
      .where(eq(loginCodes.emailHmac, emailHmac))
      .orderBy(desc(loginCodes.createdAt))
      .limit(1)
      .for("update");
    const state = loginCodeState(row ?? null, p.now);
    if (state === "ausente" || state === "usado") return { ok: false as const, erro: "sem_codigo" as const };
    if (state === "bloqueado") return { ok: false as const, erro: "bloqueado" as const };
    if (state === "expirado") return { ok: false as const, erro: "expirado" as const };
    if (!safeEqual(hmacLoginCode(emailHmac, code), row!.codeHmac)) {
      const attempts = row!.attempts + 1;
      await tx.update(loginCodes).set({ attempts }).where(eq(loginCodes.id, row!.id));
      return { ok: false as const, erro: "incorreto" as const, restantes: Math.max(0, LOGIN_CODE_MAX_ATTEMPTS - attempts) };
    }
    const [existing] = await tx.select({ id: owners.id }).from(owners).where(eq(owners.emailHmac, emailHmac));
    if (existing) {
      await tx.update(loginCodes).set({ usedAt: p.now }).where(eq(loginCodes.id, row!.id));
      await tx.update(owners).set({ lastSeenAt: p.now, ...(emailEnc ? { emailEnc } : {}) }).where(eq(owners.id, existing.id));
      return { ok: true as const, ownerId: existing.id, created: false };
    }
    // Conta nova = cópia da vitrine (~15 mil linhas): 10/dia por IP e 100/dia no total (revisão da S2, plano §6.5).
    // O código só é gasto se a conta puder ser criada (o dono tenta de novo depois, com o mesmo código).
    if (!e2e) {
      const lim = await consumeAll(tx, [
        { key: `conta:nova:ip:${p.ip}`, max: NEW_ACCOUNTS_PER_IP_DAY, windowSec: 86_400 },
        { key: "conta:nova:global", max: NEW_ACCOUNTS_PER_DAY, windowSec: 86_400 },
      ], p.now);
      if (!lim.ok) return { ok: false as const, erro: "limite" as const, retryAfterSec: lim.retryAfterSec };
    }
    await tx.update(loginCodes).set({ usedAt: p.now }).where(eq(loginCodes.id, row!.id));
    const [created] = await tx
      .insert(owners)
      .values({ kind: "teste", emailHmac, emailHint: maskEmail(email), emailEnc, via: e2e ? "e2e" : "email", lastSeenAt: p.now, createdAt: p.now })
      .onConflictDoNothing()
      .returning({ id: owners.id });
    if (created) return { ok: true as const, ownerId: created.id, created: true };
    const [again] = await tx.select({ id: owners.id }).from(owners).where(and(eq(owners.emailHmac, emailHmac)));
    return { ok: true as const, ownerId: again!.id, created: false };
  });
}
