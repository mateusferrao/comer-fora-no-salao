import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { customerContacts, customerLoginCodes, customers, restaurantCustomers } from "@/src/db/schema";
import { clearOutbox, memorySender, outbox } from "@/src/modules/contas/adapters/memory-sender";
import {
  confirmCustomerCode,
  deleteCustomerData,
  giveConsent,
  requestCustomerCode,
  saveCustomerProfile,
  customerSession,
  getMyContact,
  updateMyContact,
} from "@/src/modules/salao/application/customer-login";
import { decryptEmail, hmacCustomerEmail } from "@/src/shared/crypto";
import { createRestaurant, resetDb } from "./helpers/db";

const NOW = new Date("2026-11-21T15:00:00Z");
const env = { E2E_LOGIN_TOKEN: "token-e2e-de-teste", PRESENTER_EMAILS: "apresentador@exemplo.com" };
const lastCode = () => /(\d{6})/.exec(outbox().at(-1)!.subject)![1]!;

async function ask(restaurantId: string, email: string, p: { ip?: string; now?: Date; flagOn?: boolean; e2eToken?: string } = {}) {
  return requestCustomerCode(getDb(), {
    restaurantId,
    restaurantName: "Cantina Teste",
    email,
    ip: p.ip ?? "10.0.0.1",
    now: p.now ?? NOW,
    sender: memorySender,
    env,
    e2eToken: p.e2eToken ?? null,
    emailLogin: p.flagOn ?? true,
  });
}

async function loginNew(restaurantId: string, email: string) {
  await ask(restaurantId, email);
  const v = await confirmCustomerCode(getDb(), { restaurantId, email, code: lastCode(), ip: "10.0.0.1", now: NOW });
  if (!v.ok) throw new Error(v.erro);
  return v;
}

describe("login do cliente por e-mail + código (S4, D154, D173)", () => {
  beforeEach(async () => {
    await resetDb();
    clearOutbox();
  });
  afterAll(closeDb);

  it("envia o código com o nome do restaurante, sem link e com o rodapé de protótipo", async () => {
    const r = await createRestaurant();
    const res = await ask(r.restaurantId, "  Ana@Exemplo.com ");
    expect(res).toEqual({ ok: true, email: "ana@exemplo.com" });
    const msg = outbox().at(-1)!;
    expect(msg.to).toBe("ana@exemplo.com");
    expect(msg.subject).toMatch(/^Seu código: \d{6} · Cantina Teste$/);
    expect(msg.text).toContain("Protótipo de case · não é produto oficial do iFood");
    expect(msg.html).not.toMatch(/<a |<img /);
    const [row] = await getDb().select().from(customerLoginCodes);
    expect(JSON.stringify(row)).not.toContain("ana@exemplo.com");
  });

  it("cliente novo: confirma, fica sem perfil até o 2º passo, e o perfil grava nome, telefone e interruptores", async () => {
    const r = await createRestaurant();
    const v = await loginNew(r.restaurantId, "ana@exemplo.com");
    expect(v).toMatchObject({ ok: true, created: true, needsProfile: true });
    const [c] = await getDb().select().from(customerContacts).where(eq(customerContacts.customerId, v.customerId));
    expect(c!.emailHmac).toBe(hmacCustomerEmail("ana@exemplo.com"));
    expect(decryptEmail(c!.emailEnc)).toBe("ana@exemplo.com");
    expect(c!.name).toBeNull();
    const saved = await saveCustomerProfile(getDb(), { restaurantId: r.restaurantId, customerId: v.customerId, name: "Ana Souza", phone: "(11) 91234-5678", optEmail: false, optApp: true, now: NOW });
    expect(saved).toEqual({ ok: true });
    const [c2] = await getDb().select().from(customerContacts).where(eq(customerContacts.customerId, v.customerId));
    expect(c2).toMatchObject({ name: "Ana Souza", phoneLast4: "5678" });
    expect(JSON.stringify(c2)).not.toContain("912345678");
    const [rc] = await getDb().select().from(restaurantCustomers);
    expect(rc).toMatchObject({ optEmail: false, optApp: true, optWhatsapp: false, optPush: false });
  });

  it("telefone é opcional no perfil", async () => {
    const r = await createRestaurant();
    const v = await loginNew(r.restaurantId, "bia@exemplo.com");
    expect(await saveCustomerProfile(getDb(), { restaurantId: r.restaurantId, customerId: v.customerId, name: "Bia", phone: "", optEmail: true, optApp: true, now: NOW })).toEqual({ ok: true });
    const [c] = await getDb().select().from(customerContacts);
    expect(c).toMatchObject({ name: "Bia", phoneHmac: null, phoneLast4: null });
  });

  it("quem volta (mesmo e-mail) é o mesmo cliente e não precisa de perfil", async () => {
    const r = await createRestaurant();
    const a = await loginNew(r.restaurantId, "ana@exemplo.com");
    await saveCustomerProfile(getDb(), { restaurantId: r.restaurantId, customerId: a.customerId, name: "Ana", phone: "", optEmail: true, optApp: true, now: NOW });
    const b = await loginNew(r.restaurantId, "ANA@exemplo.com");
    expect(b).toMatchObject({ customerId: a.customerId, created: false, needsProfile: false });
    expect(await getDb().select().from(customers)).toHaveLength(1);
  });

  it("código errado gasta tentativas até bloquear; expirado e usado são recusados", async () => {
    const r = await createRestaurant();
    await ask(r.restaurantId, "ana@exemplo.com");
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    const tries = [];
    for (let i = 0; i < 5; i++) tries.push(await confirmCustomerCode(getDb(), { restaurantId: r.restaurantId, email: "ana@exemplo.com", code: wrong, ip: "10.0.0.1", now: NOW }));
    expect(tries.map((t) => (t.ok ? "ok" : `${t.erro}:${t.restantes ?? ""}`))).toEqual(["incorreto:4", "incorreto:3", "incorreto:2", "incorreto:1", "incorreto:0"]);
    expect(await confirmCustomerCode(getDb(), { restaurantId: r.restaurantId, email: "ana@exemplo.com", code, ip: "10.0.0.1", now: NOW })).toMatchObject({ ok: false, erro: "bloqueado" });
    await ask(r.restaurantId, "bia@exemplo.com");
    const late = new Date(NOW.getTime() + 11 * 60_000);
    expect(await confirmCustomerCode(getDb(), { restaurantId: r.restaurantId, email: "bia@exemplo.com", code: lastCode(), ip: "10.0.0.1", now: late })).toMatchObject({ ok: false, erro: "expirado" });
  });

  it("um código novo invalida o anterior do mesmo e-mail", async () => {
    const r = await createRestaurant();
    await ask(r.restaurantId, "ana@exemplo.com");
    const first = lastCode();
    await ask(r.restaurantId, "ana@exemplo.com", { now: new Date(NOW.getTime() + 60_000) });
    const second = lastCode();
    if (first !== second) {
      expect(await confirmCustomerCode(getDb(), { restaurantId: r.restaurantId, email: "ana@exemplo.com", code: first, ip: "10.0.0.1", now: NOW })).toMatchObject({ ok: false });
    }
    expect(await confirmCustomerCode(getDb(), { restaurantId: r.restaurantId, email: "ana@exemplo.com", code: second, ip: "10.0.0.1", now: NOW })).toMatchObject({ ok: true });
  });

  it("duas confirmações ao mesmo tempo criam um único cliente", async () => {
    const r = await createRestaurant();
    await ask(r.restaurantId, "ana@exemplo.com");
    const code = lastCode();
    const [a, b] = await Promise.all([
      confirmCustomerCode(getDb(), { restaurantId: r.restaurantId, email: "ana@exemplo.com", code, ip: "10.0.0.1", now: NOW }),
      confirmCustomerCode(getDb(), { restaurantId: r.restaurantId, email: "ana@exemplo.com", code, ip: "10.0.0.1", now: NOW }),
    ]);
    const oks = [a, b].filter((x) => x.ok);
    expect(oks.length).toBeGreaterThanOrEqual(1);
    expect(await getDb().select().from(customers)).toHaveLength(1);
  });

  it("limite por e-mail: 3 pedidos em 15 min; o apresentador escapa do global", async () => {
    const r = await createRestaurant();
    for (let i = 0; i < 3; i++) expect((await ask(r.restaurantId, "ana@exemplo.com", { ip: `10.0.0.${i}` })).ok).toBe(true);
    expect(await ask(r.restaurantId, "ana@exemplo.com", { ip: "10.0.0.9" })).toMatchObject({ ok: false, erro: "limite" });
  });

  it("E2E: com o token, o e-mail de teste recebe o código na resposta, sem envio", async () => {
    const r = await createRestaurant();
    const res = await ask(r.restaurantId, "e2e-cliente+1732200000001@exemplo.invalid", { e2eToken: env.E2E_LOGIN_TOKEN });
    expect(res).toMatchObject({ ok: true, e2eCode: expect.stringMatching(/^\d{6}$/) });
    expect(outbox()).toHaveLength(0);
    expect(await ask(r.restaurantId, "e2e-cliente+1@exemplo.invalid")).toMatchObject({ ok: false, erro: "email_invalido" });
  });

  it("flag de emergência desligada: entra sem código, sempre como cliente novo (nunca casa pelo e-mail)", async () => {
    const r = await createRestaurant();
    const a = await loginNew(r.restaurantId, "ana@exemplo.com");
    const res = await ask(r.restaurantId, "ana@exemplo.com", { flagOn: false });
    expect(res).toMatchObject({ ok: true, semCodigo: true, customerId: expect.any(String), needsProfile: true });
    if (!res.ok || !("customerId" in res)) throw new Error("esperava cliente");
    expect(res.customerId).not.toBe(a.customerId);
    const [c] = await getDb().select().from(customerContacts).where(eq(customerContacts.customerId, res.customerId));
    expect(c!.emailHmac).toBeNull();
  });

  it("consentimento por restaurante: cliente logado num restaurante novo precisa aceitar ali", async () => {
    const r1 = await createRestaurant();
    const r2 = await createRestaurant();
    const v = await loginNew(r1.restaurantId, "ana@exemplo.com");
    await saveCustomerProfile(getDb(), { restaurantId: r1.restaurantId, customerId: v.customerId, name: "Ana", phone: "", optEmail: true, optApp: true, now: NOW });
    expect(await customerSession(getDb(), r2.restaurantId, v.customerId)).toEqual({ state: "consentir", firstName: "Ana" });
    await giveConsent(getDb(), { restaurantId: r2.restaurantId, customerId: v.customerId, optEmail: true, optApp: false, now: NOW });
    expect(await customerSession(getDb(), r2.restaurantId, v.customerId)).toEqual({ state: "pronto", firstName: "Ana" });
    expect(await customerSession(getDb(), r2.restaurantId, "00000000-0000-0000-0000-000000000000")).toEqual({ state: "entrar" });
  });

  it("Apagar meus dados: some a PII e o cliente vira anônimo; a sessão volta para entrar", async () => {
    const r = await createRestaurant();
    const v = await loginNew(r.restaurantId, "ana@exemplo.com");
    await saveCustomerProfile(getDb(), { restaurantId: r.restaurantId, customerId: v.customerId, name: "Ana", phone: "(11) 91234-5678", optEmail: true, optApp: true, now: NOW });
    await deleteCustomerData(getDb(), v.customerId);
    expect(await getDb().select().from(customerContacts)).toHaveLength(0);
    expect(await getDb().select().from(customers)).toHaveLength(1);
    expect(await customerSession(getDb(), r.restaurantId, v.customerId)).toEqual({ state: "entrar" });
    const [rc] = await getDb().select().from(restaurantCustomers);
    expect(rc).toMatchObject({ optEmail: false, optApp: false });
  });

  it("Seus dados: o cliente vê e corrige nome e telefone; número antigo (só 4 dígitos) pede o completo; null mantém", async () => {
    const r = await createRestaurant();
    const v = await loginNew(r.restaurantId, "ana@exemplo.com");
    await saveCustomerProfile(getDb(), { restaurantId: r.restaurantId, customerId: v.customerId, name: "Ana", phone: "", optEmail: true, optApp: true, now: NOW });
    // Cadastro antigo: só os 4 últimos dígitos, sem o número cifrado.
    await getDb().update(customerContacts).set({ phoneLast4: "1420", phoneEnc: null }).where(eq(customerContacts.customerId, v.customerId));
    expect(await getMyContact(getDb(), v.customerId)).toEqual({ name: "Ana", phone: "", oldPhoneLast4: "1420", email: "ana@exemplo.com" });
    // Telefone não informado (null) mantém o antigo.
    expect(await updateMyContact(getDb(), { customerId: v.customerId, name: "Ana Souza", phone: null, now: NOW })).toEqual({ ok: true });
    expect(await getMyContact(getDb(), v.customerId)).toMatchObject({ name: "Ana Souza", oldPhoneLast4: "1420" });
    expect(await updateMyContact(getDb(), { customerId: v.customerId, name: "Ana Souza", phone: "(00) 91234-1420", now: NOW })).toEqual({ ok: true });
    expect(await getMyContact(getDb(), v.customerId)).toEqual({ name: "Ana Souza", phone: "(00) 91234-1420", oldPhoneLast4: null, email: "ana@exemplo.com" });
    // Apagar o telefone (""), formato inválido e nome curto.
    expect(await updateMyContact(getDb(), { customerId: v.customerId, name: "Ana Souza", phone: "", now: NOW })).toEqual({ ok: true });
    expect(await getMyContact(getDb(), v.customerId)).toMatchObject({ phone: "", oldPhoneLast4: null });
    expect(await updateMyContact(getDb(), { customerId: v.customerId, name: "Ana", phone: "1234", now: NOW })).toEqual({ ok: false, erro: "dados_invalidos", campos: ["phone"] });
    expect(await updateMyContact(getDb(), { customerId: v.customerId, name: "A", phone: null, now: NOW })).toEqual({ ok: false, erro: "dados_invalidos", campos: ["name"] });
  });

  it("Entrar pela Jornada (D257): sem restaurante; só quem já é cliente; código de uso único; nada de cliente novo", async () => {
    const r = await createRestaurant();
    const v = await loginNew(r.restaurantId, "ana@exemplo.com");
    const jornada = (email: string) =>
      requestCustomerCode(getDb(), { restaurantId: null, restaurantName: null, email, ip: "10.0.0.2", now: NOW, sender: memorySender, env, e2eToken: null, emailLogin: true });
    expect(await jornada("ana@exemplo.com")).toMatchObject({ ok: true });
    expect(outbox().at(-1)!.subject).toMatch(/· Comer Fora no Salão$/);
    expect(outbox().at(-1)!.text).not.toMatch(/check-in/);
    const code = lastCode();
    expect(await confirmCustomerCode(getDb(), { restaurantId: null, email: "ana@exemplo.com", code, ip: "10.0.0.2", now: NOW, createIfMissing: false })).toMatchObject({ ok: true, customerId: v.customerId, created: false });
    expect(await confirmCustomerCode(getDb(), { restaurantId: null, email: "ana@exemplo.com", code, ip: "10.0.0.2", now: NOW, createIfMissing: false })).toMatchObject({ ok: false, erro: "sem_codigo" });
    // E-mail sem cadastro: recebe o código, mas não vira cliente.
    const before = (await getDb().select().from(customers)).length;
    await jornada("novo@exemplo.com");
    expect(await confirmCustomerCode(getDb(), { restaurantId: null, email: "novo@exemplo.com", code: lastCode(), ip: "10.0.0.2", now: NOW, createIfMissing: false })).toEqual({ ok: false, erro: "sem_cadastro" });
    expect((await getDb().select().from(customers)).length).toBe(before);
    // Login de emergência sem código (flag desligada) não vale pela Jornada.
    expect(await requestCustomerCode(getDb(), { restaurantId: null, restaurantName: null, email: "ana@exemplo.com", ip: "10.0.0.2", now: NOW, sender: memorySender, env, emailLogin: false })).toEqual({ ok: false, erro: "envio_indisponivel" });
  });
});
