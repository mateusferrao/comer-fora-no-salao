import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_LOGIN_TOKEN_LOCAL } from "../../playwright.config";

export const BARRA = "Protótipo de case · não é produto oficial do iFood · dados fictícios";
export const PROD = !!process.env.BASE_URL;

export async function axe(page: Page) {
  // Durante router.refresh() o Next 16 reinsere os metadados por streaming: espera o <title> voltar.
  await expect.poll(() => page.title(), { timeout: 5_000 }).not.toBe("");
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** Login de teste (D123): pede o código com o token e confere — o cookie fica no contexto da página. */
export async function loginE2E(request: APIRequestContext, n: number): Promise<void> {
  // O secret colado no GitHub pode vir com quebra de linha ou aspas em volta (revisão da S2: "Invalid character
  // in header content"); limpa como `cleanApiKey` faz com as chaves de IA.
  const raw = process.env.E2E_LOGIN_TOKEN ?? (PROD ? "" : E2E_LOGIN_TOKEN_LOCAL);
  const token = raw.trim().replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, "").trim();
  expect(token, "E2E_LOGIN_TOKEN ausente (secret do GitHub)").not.toBe("");
  const email = `e2e-dono+${n}@exemplo.invalid`;
  const r = await request.post("/api/parceiro/entrar", { data: { email }, headers: { "x-e2e-token": token } });
  expect(r.status()).toBe(200);
  const { codigo } = (await r.json()) as { codigo: string };
  const v = await request.post("/api/parceiro/entrar/codigo", { data: { email, codigo } });
  expect(v.status()).toBe(200);
}
