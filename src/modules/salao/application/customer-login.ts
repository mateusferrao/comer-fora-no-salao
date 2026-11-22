/**
 * Login do cliente (S4 — D154, D171, D173): e-mail real + código de 6 dígitos; quem é novo completa o perfil
 * (nome, telefone opcional, interruptores) no 2º passo. Sem apagamento automático; "Apagar meus dados" sempre
 * disponível. O e-mail é a identidade (HMAC `cliente-email:`) e fica criptografado só para enviar convites.
 * Mesmo desenho do login do dono (contas/application/request-code, verify-code).
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/src/db/client";
import { customerContacts, customerLoginCodes, customers, restaurantCustomers } from "@/src/db/schema";
import type { MailSender } from "@/src/modules/contas/adapters/mail-sender";
import { noteSendResult } from "@/src/modules/contas/adapters/mail-factory";
import { generateLoginCode, isLoginCodeFormat, LOGIN_CODE_MAX_ATTEMPTS, LOGIN_CODE_TTL_MIN, loginCodeState } from "@/src/modules/contas/domain/login-code";
import { decryptEmail, decryptPhone, encryptEmail, encryptPhone, hmacCustomerEmail, hmacLoginCode, hmacPhone, safeEqual, secureRandInt } from "@/src/shared/crypto";
import { log } from "@/src/shared/log";
import { consume, consumeAll } from "@/src/shared/rate-limit";
import { safeErr } from "@/src/shared/safe-err";
import { CUSTOMER_E2E_EMAIL_RE, maskEmail, parseCustomerEmail } from "../domain/customer-email";
import { isPhoneFormat, last4, phoneDigits } from "../domain/phone";

export { PROTOTYPE_FOOTER } from "@/src/shared/prototype";
import { PROTOTYPE_FOOTER } from "@/src/shared/prototype";

export type CustomerLoginEnv = { E2E_LOGIN_TOKEN?: string; PRESENTER_EMAILS?: string };

export type RequestCustomerCodeResult =
  | { ok: true; email: string; e2eCode?: string }
  | { ok: true; email: string; semCodigo: true; customerId: string; needsProfile: true }
  | { ok: false; erro: "email_invalido" | "limite" | "envio_indisponivel" | "envio"; retryAfterSec?: number };

function isPresenter(email: string, env: CustomerLoginEnv): boolean {
  return (env.PRESENTER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export function customerCodeEmail(code: string, restaurantName: string | null): { subject: string; text: string; html: string } {
  // D257: sem restaurante, é o login pela Jornada (ver e corrigir os próprios dados), sem check-in.
  // S9: "código de acesso" (para entrar) × "código do benefício" (para o garçom); marca "Comer Fora" para o cliente.
  const what = restaurantName ? `entrar e fazer check-in no restaurante ${restaurantName}` : "entrar em Sua jornada no Comer Fora";
  const subject = (restaurantName ? `Seu código de acesso: ${code} · ${restaurantName}` : `Seu código de acesso: ${code} · Comer Fora`).replace(/[\r\n]+/g, " ");
  const validity = `Ele vale por ${LOGIN_CODE_TTL_MIN} minutos e só pode ser usado uma vez. Se não foi você que pediu, ignore este e-mail.`;
  const notWaiter = restaurantName ? "Não mostre este código ao garçom. O código do benefício aparece na tela depois do check-in." : null;
  const lines = [`Use este código de acesso para ${what}: ${code}`, "", validity, ...(notWaiter ? [notWaiter] : []), "", PROTOTYPE_FOOTER];
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#151515">
<p>Use este código de acesso para ${esc(what)}:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
<p>${validity}</p>
${notWaiter ? `<p>${notWaiter}</p>` : ""}
<p style="color:#666;font-size:12px">${PROTOTYPE_FOOTER}</p>
</div>`;
  return { subject, text: lines.join("\n"), html };
}

/**
 * Passo 1: pede o código. Limites: 3/15 min e 6/dia por e-mail (o simulador do SES fica fora deste), 30/h por IP
 * (Wi-Fi do salão é compartilhado), 500/dia global (apresentador isento). Com `emailLogin` desligado (flag de
 * emergência), entra sem código, sempre como cliente novo e sem gravar o e-mail (nunca casa pelo e-mail sem prova).
 */
export async function requestCustomerCode(
  db: Db,
  p: {
    /** `null` = login pela Jornada (D257): só para quem já é cliente; nada de cliente novo sem código. */
    restaurantId: string | null;
    restaurantName: string | null;
    email: string;
    ip: string;
    now: Date;
    sender: MailSender | null;
    env: CustomerLoginEnv;
    e2eToken?: string | null;
    emailLogin: boolean;
    randInt?: (n: number) => number;
  },
): Promise<RequestCustomerCodeResult> {
  const email = parseCustomerEmail(p.email);
  if (!email) return { ok: false, erro: "email_invalido" };
  const isE2eAddress = CUSTOMER_E2E_EMAIL_RE.test(email);
  const e2e = isE2eAddress && !!p.env.E2E_LOGIN_TOKEN && !!p.e2eToken && safeEqual(p.e2eToken, p.env.E2E_LOGIN_TOKEN);
  if (isE2eAddress && !e2e) return { ok: false, erro: "email_invalido" };

  if (!p.emailLogin) {
    if (p.restaurantId === null) return { ok: false, erro: "envio_indisponivel" };
    const [c] = await db.insert(customers).values({}).returning({ id: customers.id });
    await db.insert(customerContacts).values({ customerId: c!.id, lastSeenAt: p.now });
    return { ok: true, email, semCodigo: true, customerId: c!.id, needsProfile: true };
  }
  if (!e2e && !p.sender) return { ok: false, erro: "envio_indisponivel" };

  const emailHmac = hmacCustomerEmail(email);
  if (!e2e) {
    const simulator = email.endsWith("@simulator.amazonses.com");
    const rules = [
      ...(simulator
        ? []
        : [
            { key: `cliente:email15:${emailHmac}`, max: 3, windowSec: 900 },
            { key: `cliente:emaildia:${emailHmac}`, max: 6, windowSec: 86_400 },
          ]),
      { key: `cliente:ip:${p.ip}`, max: 30, windowSec: 3600 },
    ];
    if (!isPresenter(email, p.env)) rules.push({ key: "cliente:global", max: 500, windowSec: 86_400 });
    const lim = await consumeAll(db, rules, p.now);
    if (!lim.ok) return { ok: false, erro: "limite", retryAfterSec: lim.retryAfterSec };
  }

  const code = generateLoginCode(p.randInt ?? secureRandInt);
  await db.transaction(async (tx) => {
    await tx.update(customerLoginCodes).set({ usedAt: p.now }).where(and(eq(customerLoginCodes.emailHmac, emailHmac), isNull(customerLoginCodes.usedAt)));
    await tx.insert(customerLoginCodes).values({
      emailHmac,
      codeHmac: hmacLoginCode(emailHmac, code),
      restaurantId: p.restaurantId,
      payload: {},
      expiresAt: new Date(p.now.getTime() + LOGIN_CODE_TTL_MIN * 60_000),
      createdAt: p.now,
    });
  });
  if (e2e) return { ok: true, email, e2eCode: code };
  try {
    await p.sender!.send({ to: email, ...customerCodeEmail(code, p.restaurantName) });
    noteSendResult(true);
  } catch (err) {
    log.error("falha no envio do código do cliente", { area: "login_cliente", err: safeErr(err) });
    noteSendResult(false);
    return { ok: false, erro: "envio" };
  }
  return { ok: true, email };
}

export type ConfirmCustomerCodeResult =
  | { ok: true; customerId: string; created: boolean; needsProfile: boolean }
  | { ok: false; erro: "email_invalido" | "formato" | "incorreto" | "expirado" | "bloqueado" | "sem_codigo" | "limite" | "sem_cadastro"; restantes?: number; retryAfterSec?: number };

/** Passo 1b: confere o código (10 min, 5 tentativas, uso único) e cria ou reconhece o cliente pelo e-mail. */
export async function confirmCustomerCode(db: Db, p: { restaurantId: string | null; email: string; code: string; ip: string; now: Date; createIfMissing?: boolean }): Promise<ConfirmCustomerCodeResult> {
  const email = parseCustomerEmail(p.email);
  if (!email) return { ok: false, erro: "email_invalido" };
  const code = p.code.replace(/\s/g, "");
  if (!isLoginCodeFormat(code)) return { ok: false, erro: "formato" };
  if (!CUSTOMER_E2E_EMAIL_RE.test(email)) {
    const lim = await consume(db, `cliente:confirmar:${p.ip}`, 30, 3600, p.now);
    if (!lim.ok) return { ok: false, erro: "limite", retryAfterSec: lim.retryAfterSec };
  }
  const emailHmac = hmacCustomerEmail(email);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(customerLoginCodes)
      .where(eq(customerLoginCodes.emailHmac, emailHmac))
      .orderBy(desc(customerLoginCodes.createdAt))
      .limit(1)
      .for("update");
    const state = loginCodeState(row ?? null, p.now);
    if (state === "ausente" || state === "usado") return { ok: false as const, erro: "sem_codigo" as const };
    if (state === "bloqueado") return { ok: false as const, erro: "bloqueado" as const };
    if (state === "expirado") return { ok: false as const, erro: "expirado" as const };
    if (!safeEqual(hmacLoginCode(emailHmac, code), row!.codeHmac)) {
      const attempts = row!.attempts + 1;
      await tx.update(customerLoginCodes).set({ attempts }).where(eq(customerLoginCodes.id, row!.id));
      return { ok: false as const, erro: "incorreto" as const, restantes: Math.max(0, LOGIN_CODE_MAX_ATTEMPTS - attempts) };
    }
    await tx.update(customerLoginCodes).set({ usedAt: p.now }).where(eq(customerLoginCodes.id, row!.id));
    const [existing] = await tx.select({ id: customerContacts.customerId, name: customerContacts.name }).from(customerContacts).where(eq(customerContacts.emailHmac, emailHmac));
    if (existing) {
      await tx.update(customerContacts).set({ lastSeenAt: p.now }).where(eq(customerContacts.customerId, existing.id));
      return { ok: true as const, customerId: existing.id, created: false, needsProfile: existing.name === null };
    }
    // D257: pela Jornada só entra quem já é cliente (o cadastro nasce no check-in, com o aceite do restaurante).
    if (p.createIfMissing === false) return { ok: false as const, erro: "sem_cadastro" as const };
    const [c] = await tx.insert(customers).values({}).returning({ id: customers.id });
    const inserted = await tx
      .insert(customerContacts)
      .values({ customerId: c!.id, emailHmac, emailEnc: encryptEmail(email), emailHint: maskEmail(email), lastSeenAt: p.now })
      .onConflictDoNothing({ target: customerContacts.emailHmac })
      .returning({ id: customerContacts.customerId });
    if (inserted.length === 0) {
      await tx.delete(customers).where(eq(customers.id, c!.id));
      const [winner] = await tx.select({ id: customerContacts.customerId, name: customerContacts.name }).from(customerContacts).where(eq(customerContacts.emailHmac, emailHmac));
      return { ok: true as const, customerId: winner!.id, created: false, needsProfile: winner!.name === null };
    }
    return { ok: true as const, customerId: c!.id, created: true, needsProfile: true };
  });
}

export const profileInputSchema = z.object({
  name: z.string().trim().min(2, "nome").max(60, "nome"),
  phone: z.string().refine((v) => v === "" || isPhoneFormat(v), "telefone"),
  optEmail: z.boolean(),
  optApp: z.boolean(),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

/** Passo 2 (só quem é novo): nome, telefone opcional e os interruptores deste restaurante (D173, D165). */
export async function saveCustomerProfile(db: Db, p: { restaurantId: string; customerId: string; now: Date } & ProfileInput): Promise<{ ok: true } | { ok: false; erro: "dados_invalidos" | "sem_cliente" }> {
  const parsed = profileInputSchema.safeParse({ name: p.name, phone: p.phone, optEmail: p.optEmail, optApp: p.optApp });
  if (!parsed.success) return { ok: false, erro: "dados_invalidos" };
  const { name, phone, optEmail, optApp } = parsed.data;
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(customerContacts)
      .set({ name, phoneHmac: phone ? hmacPhone(phoneDigits(phone)) : null, phoneLast4: phone ? last4(phone) : null, phoneEnc: phone ? encryptPhone(phone) : null, lastSeenAt: p.now })
      .where(eq(customerContacts.customerId, p.customerId))
      .returning({ id: customerContacts.customerId });
    if (updated.length === 0) return { ok: false as const, erro: "sem_cliente" as const };
    await upsertConsent(tx, p.restaurantId, p.customerId, optEmail, optApp);
    return { ok: true as const };
  });
}

/**
 * "Seus dados" (D250): o próprio cliente vê e corrige nome e telefone. Cadastro antigo sem o número inteiro (só os 4
 * últimos, antes da D237) volta com `phone` vazio e `oldPhoneLast4`, para a tela pedir o número completo.
 */
export type MyContact = { name: string; phone: string; oldPhoneLast4: string | null; email: string };

export async function getMyContact(db: Db, customerId: string): Promise<MyContact | null> {
  const [c] = await db.select().from(customerContacts).where(eq(customerContacts.customerId, customerId));
  if (!c) return null;
  const phone = decryptPhone(c.phoneEnc) ?? "";
  return { name: c.name ?? "", phone, oldPhoneLast4: phone ? null : (c.phoneLast4 ?? null), email: decryptEmail(c.emailEnc) ?? "" };
}

const myContactSchema = z.object({
  name: z.string().trim().min(2).max(60),
  phone: z.string().refine((v) => v === "" || isPhoneFormat(v)).nullable(),
});

/** `phone`: null mantém o atual; "" apaga; número no formato `(DD) 9XXXX-XXXX` grava cifrado (como no cadastro). */
export async function updateMyContact(
  db: Db,
  p: { customerId: string; name: string; phone: string | null; now: Date },
): Promise<{ ok: true } | { ok: false; erro: "dados_invalidos"; campos: string[] } | { ok: false; erro: "sem_cliente" }> {
  const parsed = myContactSchema.safeParse({ name: p.name, phone: p.phone });
  if (!parsed.success) return { ok: false, erro: "dados_invalidos", campos: [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")))] };
  const { name, phone } = parsed.data;
  const phoneFields = phone === null ? {} : { phoneHmac: phone ? hmacPhone(phoneDigits(phone)) : null, phoneLast4: phone ? last4(phone) : null, phoneEnc: phone ? encryptPhone(phone) : null };
  const updated = await db
    .update(customerContacts)
    .set({ name, ...phoneFields, lastSeenAt: p.now })
    .where(eq(customerContacts.customerId, p.customerId))
    .returning({ id: customerContacts.customerId });
  return updated.length ? { ok: true } : { ok: false, erro: "sem_cliente" };
}

/** Consentimento por restaurante (revisão S4 I1): cliente já logado aceita este restaurante com 1 toque. */
export async function giveConsent(db: Db, p: { restaurantId: string; customerId: string; optEmail: boolean; optApp: boolean; now: Date }): Promise<void> {
  await upsertConsent(db, p.restaurantId, p.customerId, p.optEmail, p.optApp);
}

async function upsertConsent(ex: Db | Parameters<Parameters<Db["transaction"]>[0]>[0], restaurantId: string, customerId: string, optEmail: boolean, optApp: boolean) {
  await ex
    .insert(restaurantCustomers)
    .values({ restaurantId, customerId, optEmail, optApp, optWhatsapp: false, optPush: false })
    .onConflictDoUpdate({ target: [restaurantCustomers.restaurantId, restaurantCustomers.customerId], set: { optEmail, optApp, optWhatsapp: false, optPush: false } });
}

export type CustomerSession = { state: "entrar" } | { state: "perfil" } | { state: "consentir"; firstName: string } | { state: "pronto"; firstName: string };

/** Em que passo o cliente do cookie está neste restaurante. */
export async function customerSession(db: Db, restaurantId: string, customerId: string | null): Promise<CustomerSession> {
  if (!customerId) return { state: "entrar" };
  const [c] = await db.select({ name: customerContacts.name }).from(customerContacts).where(eq(customerContacts.customerId, customerId)).limit(1);
  if (!c) return { state: "entrar" };
  if (!c.name) return { state: "perfil" };
  const firstName = c.name.split(" ")[0] ?? c.name;
  const [rc] = await db
    .select({ id: restaurantCustomers.customerId })
    .from(restaurantCustomers)
    .where(and(eq(restaurantCustomers.restaurantId, restaurantId), eq(restaurantCustomers.customerId, customerId)))
    .limit(1);
  return rc ? { state: "pronto", firstName } : { state: "consentir", firstName };
}

/** "Apagar meus dados" (D171): some a PII (nome, telefone, e-mail) e os envios; o cliente vira linha anônima das métricas. */
export async function deleteCustomerData(db: Db, customerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [c] = await tx.select({ emailHmac: customerContacts.emailHmac }).from(customerContacts).where(eq(customerContacts.customerId, customerId));
    if (c?.emailHmac) await tx.delete(customerLoginCodes).where(eq(customerLoginCodes.emailHmac, c.emailHmac));
    await tx.delete(customerContacts).where(eq(customerContacts.customerId, customerId));
    await tx.update(restaurantCustomers).set({ optEmail: false, optApp: false, optWhatsapp: false, optPush: false }).where(eq(restaurantCustomers.customerId, customerId));
  });
}
