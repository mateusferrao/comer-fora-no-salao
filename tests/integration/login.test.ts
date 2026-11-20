import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { loginCodes, owners } from "@/src/db/schema";
import { clearOutbox, memorySender, outbox } from "@/src/modules/contas/adapters/memory-sender";
import { requestLoginCode } from "@/src/modules/contas/application/request-code";
import { verifyLoginCode } from "@/src/modules/contas/application/verify-code";
import { openEvaluatorLink } from "@/src/modules/contas/application/evaluator-link";
import { hmacEmail } from "@/src/shared/crypto";
import { resetDb } from "./helpers/db";

const NOW = new Date("2026-11-21T12:00:00Z");
const env = { E2E_LOGIN_TOKEN: "token-e2e-de-teste", PRESENTER_EMAILS: "apresentador@exemplo.com" };
const codeFromOutbox = () => /(\d{6})/.exec(outbox().at(-1)!.subject)![1]!;

async function ask(email: string, ip = "10.0.0.1", now = NOW) {
  return requestLoginCode(getDb(), { email, ip, now, sender: memorySender, env });
}

describe("login do dono por e-mail + código (D118)", () => {
  beforeEach(async () => {
    await resetDb();
    clearOutbox();
  });
  afterAll(closeDb);

  it("envia o código, cria a conta no 1º acesso e guarda só o HMAC do e-mail", async () => {
    const r = await ask("  Dono@Exemplo.com ");
    expect(r).toEqual({ ok: true, hint: "d•••@e•••.com" });
    const msg = outbox().at(-1)!;
    expect(msg.to).toBe("dono@exemplo.com");
    expect(msg.subject).toMatch(/^Seu código de acesso: \d{6} · Comer Fora no Salão \(protótipo de case\)$/);
    expect(msg.text).toContain("não é produto oficial do iFood");
    expect(msg.html).not.toMatch(/<a |<img /);
    const v = await verifyLoginCode(getDb(), { email: "dono@exemplo.com", code: codeFromOutbox(), ip: "10.0.0.1", now: NOW });
    expect(v.ok && v.created).toBe(true);
    const [o] = await getDb().select().from(owners);
    expect(o!.emailHmac).toBe(hmacEmail("dono@exemplo.com"));
    expect(o!.emailHint).toBe("d•••@e•••.com");
    expect(o!.via).toBe("email");
    expect(JSON.stringify(o)).not.toContain("dono@exemplo.com");
    // 2º acesso: mesma conta
    await ask("dono@exemplo.com", "10.0.0.1", new Date(NOW.getTime() + 20 * 60_000));
    const v2 = await verifyLoginCode(getDb(), { email: "dono@exemplo.com", code: codeFromOutbox(), ip: "10.0.0.1", now: new Date(NOW.getTime() + 21 * 60_000) });
    expect(v2.ok && !v2.created && v2.ownerId).toBe(o!.id);
  });

  it("código errado 5× bloqueia; o certo depois disso não entra", async () => {
    await ask("a@exemplo.com");
    const certo = codeFromOutbox();
    const errado = certo === "000000" ? "111111" : "000000";
    for (let i = 4; i >= 0; i--) {
      const r = await verifyLoginCode(getDb(), { email: "a@exemplo.com", code: errado, ip: "10.0.0.2", now: NOW });
      expect(r).toEqual({ ok: false, erro: "incorreto", restantes: i });
    }
    expect(await verifyLoginCode(getDb(), { email: "a@exemplo.com", code: certo, ip: "10.0.0.2", now: NOW })).toEqual({ ok: false, erro: "bloqueado" });
  });

  it("código vence em 10 min e um novo invalida o anterior", async () => {
    await ask("b@exemplo.com");
    const c1 = codeFromOutbox();
    expect(await verifyLoginCode(getDb(), { email: "b@exemplo.com", code: c1, ip: "x", now: new Date(NOW.getTime() + 10 * 60_000 + 1000) })).toEqual({ ok: false, erro: "expirado" });
    await ask("b@exemplo.com", "10.0.0.1", new Date(NOW.getTime() + 11 * 60_000));
    const c2 = codeFromOutbox();
    const rows = await getDb().select().from(loginCodes).where(eq(loginCodes.emailHmac, hmacEmail("b@exemplo.com")));
    expect(rows.filter((r) => r.usedAt === null)).toHaveLength(1);
    expect((await verifyLoginCode(getDb(), { email: "b@exemplo.com", code: c2, ip: "x", now: new Date(NOW.getTime() + 12 * 60_000) })).ok).toBe(true);
  });

  it("limites: 3 envios por e-mail em 15 min; e-mail inválido; sem transporte", async () => {
    for (let i = 0; i < 3; i++) expect((await ask("c@exemplo.com")).ok).toBe(true);
    const r = await ask("c@exemplo.com");
    expect(r.ok === false && r.erro).toBe("limite");
    expect(await ask("nao-e-email")).toEqual({ ok: false, erro: "email_invalido" });
    const semEnvio = await requestLoginCode(getDb(), { email: "d@exemplo.com", ip: "x", now: NOW, sender: null, env });
    expect(semEnvio).toEqual({ ok: false, erro: "envio_indisponivel" });
  });

  it("E2E: com o token devolve o código sem enviar; sem token o e-mail de teste é recusado", async () => {
    const r = await requestLoginCode(getDb(), { email: "e2e-dono+1@exemplo.invalid", ip: "x", now: NOW, sender: memorySender, env, e2eToken: "token-e2e-de-teste" });
    expect(r.ok && r.e2eCode).toMatch(/^\d{6}$/);
    expect(outbox()).toHaveLength(0);
    const v = await verifyLoginCode(getDb(), { email: "e2e-dono+1@exemplo.invalid", code: r.ok ? r.e2eCode! : "", ip: "x", now: NOW });
    expect(v.ok).toBe(true);
    const [o] = await getDb().select().from(owners);
    expect(o!.via).toBe("e2e");
    expect(await requestLoginCode(getDb(), { email: "e2e-dono+1@exemplo.invalid", ip: "x", now: NOW, sender: memorySender, env, e2eToken: "errado" })).toEqual({ ok: false, erro: "email_invalido" });
  });

  it("link do avaliador: token certo cria conta nova a cada abertura; errado → inválido; 20/dia", async () => {
    const a = await openEvaluatorLink(getDb(), { token: "link-certo", expected: "link-certo", now: NOW });
    const b = await openEvaluatorLink(getDb(), { token: "link-certo", expected: "link-certo", now: NOW });
    expect(a.ok && b.ok && a.ownerId !== b.ownerId).toBe(true);
    expect(await openEvaluatorLink(getDb(), { token: "outro", expected: "link-certo", now: NOW })).toEqual({ ok: false, erro: "invalido" });
    expect(await openEvaluatorLink(getDb(), { token: "x", expected: undefined, now: NOW })).toEqual({ ok: false, erro: "invalido" });
    const os = await getDb().select().from(owners);
    expect(os.every((o) => o.via === "link" && o.emailHint === "acesso por link")).toBe(true);
    for (let i = 0; i < 18; i++) await openEvaluatorLink(getDb(), { token: "link-certo", expected: "link-certo", now: NOW });
    expect(await openEvaluatorLink(getDb(), { token: "link-certo", expected: "link-certo", now: NOW })).toMatchObject({ ok: false, erro: "limite" });
  });
});
