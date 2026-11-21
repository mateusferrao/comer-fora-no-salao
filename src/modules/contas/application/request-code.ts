/**
 * Pedir código de login (D118). Limites: 3/15 min e 5/dia por e-mail, 10/h por IP, 300/dia global
 * (e-mails de `PRESENTER_EMAILS` isentos do global). E2E (D123): com o token certo, e-mails de teste
 * recebem o código na resposta, sem envio e sem limites.
 */
import { noteSendResult } from "../adapters/mail-factory";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { loginCodes } from "@/src/db/schema";
import { hmacEmail, hmacLoginCode, safeEqual, secureRandInt } from "@/src/shared/crypto";
import { consumeAll } from "@/src/shared/rate-limit";
import { safeErr } from "@/src/shared/safe-err";
import { E2E_EMAIL_RE, generateLoginCode, LOGIN_CODE_TTL_MIN, maskEmail, parseEmail } from "../domain/login-code";
import type { MailSender } from "../adapters/mail-sender";
import { log } from "@/src/shared/log";

export type LoginEnv = { E2E_LOGIN_TOKEN?: string; PRESENTER_EMAILS?: string };

export type RequestCodeResult =
  | { ok: true; hint: string; e2eCode?: string }
  | { ok: false; erro: "email_invalido" | "limite" | "envio_indisponivel" | "envio"; retryAfterSec?: number };

export function isPresenter(email: string, env: LoginEnv): boolean {
  return (env.PRESENTER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export function isE2eRequest(email: string, token: string | null | undefined, env: LoginEnv): boolean {
  return E2E_EMAIL_RE.test(email) && !!env.E2E_LOGIN_TOKEN && !!token && safeEqual(token, env.E2E_LOGIN_TOKEN);
}

export function loginEmail(code: string): { subject: string; text: string; html: string } {
  const subject = `Seu código de acesso: ${code} · Comer Fora no Salão (protótipo de case)`;
  const text = [
    `Seu código de acesso ao Portal do protótipo "Comer Fora no Salão" é: ${code}`,
    "",
    `Ele vale por ${LOGIN_CODE_TTL_MIN} minutos e só pode ser usado uma vez.`,
    "",
    "Este é um protótipo de case, não é produto oficial do iFood. Se não foi você que pediu, ignore este e-mail.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#151515">
<p>Seu código de acesso ao Portal do protótipo "Comer Fora no Salão" é:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
<p>Ele vale por ${LOGIN_CODE_TTL_MIN} minutos e só pode ser usado uma vez.</p>
<p style="color:#666">Este é um protótipo de case, não é produto oficial do iFood. Se não foi você que pediu, ignore este e-mail.</p>
</div>`;
  return { subject, text, html };
}

export async function requestLoginCode(
  db: Db,
  p: { email: string; ip: string; now: Date; sender: MailSender | null; env: LoginEnv; e2eToken?: string | null; randInt?: (n: number) => number },
): Promise<RequestCodeResult> {
  const email = parseEmail(p.email);
  if (!email) return { ok: false, erro: "email_invalido" };
  const e2e = isE2eRequest(email, p.e2eToken, p.env);
  if (E2E_EMAIL_RE.test(email) && !e2e) return { ok: false, erro: "email_invalido" };
  if (!e2e && !p.sender) return { ok: false, erro: "envio_indisponivel" };

  const emailHmac = hmacEmail(email);
  if (!e2e) {
    // O simulador do SES (E2E de produção a cada deploy) não entrega a ninguém: sem limite por e-mail, só IP e global.
    const simulator = email.endsWith("@simulator.amazonses.com");
    const rules = [
      ...(simulator
        ? []
        : [
            { key: `login:email15:${emailHmac}`, max: 3, windowSec: 900 },
            { key: `login:emaildia:${emailHmac}`, max: 5, windowSec: 86_400 },
          ]),
      { key: `login:ip:${p.ip}`, max: 10, windowSec: 3600 },
    ];
    if (!isPresenter(email, p.env)) rules.push({ key: "login:global", max: 300, windowSec: 86_400 });
    const lim = await consumeAll(db, rules, p.now);
    if (!lim.ok) return { ok: false, erro: "limite", retryAfterSec: lim.retryAfterSec };
  }

  const code = generateLoginCode(p.randInt ?? secureRandInt);
  await db.transaction(async (tx) => {
    await tx.update(loginCodes).set({ usedAt: p.now }).where(and(eq(loginCodes.emailHmac, emailHmac), isNull(loginCodes.usedAt)));
    await tx.insert(loginCodes).values({
      emailHmac,
      codeHmac: hmacLoginCode(emailHmac, code),
      expiresAt: new Date(p.now.getTime() + LOGIN_CODE_TTL_MIN * 60_000),
      createdAt: p.now,
    });
  });
  if (e2e) return { ok: true, hint: maskEmail(email), e2eCode: code };

  try {
    await p.sender!.send({ to: email, ...loginEmail(code) });
    noteSendResult(true);
  } catch (err) {
    log.error("falha no envio do código", { area: "login", err: safeErr(err) });
    noteSendResult(false);
    return { ok: false, erro: "envio" };
  }
  return { ok: true, hint: maskEmail(email) };
}
