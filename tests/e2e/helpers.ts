import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { E2E_LOGIN_TOKEN_LOCAL } from "../../playwright.config";

export const BARRA = "Protótipo de case · não é produto oficial do iFood";
export const PROD = !!process.env.BASE_URL;
/** Flags da S5 (D160: corte por flag). */
export const S5_FLAGS = ["painel_valor", "copy_v2", "explica_ia"] as const;
/**
 * Estado das flags da S5 que a spec deve esperar. Local: a passada `chromium` roda sempre com elas desligadas.
 * Produção: `E2E_FLAGS=on` depois de ligá-las pelos Bastidores.
 */
export const S5_ON = PROD && process.env.E2E_FLAGS === "on";
/** Flags da S6 ligadas na passada `flags-on` (o `agendador` nunca: provado por integração; `plano_agente` só se ganhar — D159). */
export const S6_FLAGS = ["resumo_email", "modo_garcom", "porta_conta", "mcp"] as const;
/** Flags da S8 ligadas na passada `flags-on` (copiloto e MCP sobre o catálogo). */
export const S8_FLAGS = ["copiloto", "mcp_clientes", "mcp_edicao"] as const;

export async function axe(page: Page) {
  // Durante router.refresh() o Next 16 reinsere os metadados por streaming: espera o <title> voltar. Se o título sumir
  // de novo no meio da análise (só `document-title`, transitório), repete — no máximo 3 vezes.
  let ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    await expect.poll(() => page.title(), { timeout: 5_000 }).not.toBe("");
    const r = await new AxeBuilder({ page }).analyze();
    ids = r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    if (!(r.violations.length === 1 && r.violations[0]!.id === "document-title")) break;
    await page.waitForTimeout(300);
  }
  expect(ids).toEqual([]);
}

/**
 * Confirmação do design system (`confirmDialog`, ajuste de 21/11): se o modal aparecer depois de uma ação, confirma.
 * Algumas ações só pedem confirmação em certo estado (ex.: "Gerar plano" com proposta já aberta).
 */
export async function confirmIfAsked(
  page: Page,
  timeout = 2_000,
): Promise<boolean> {
  const d = page.getByRole("alertdialog");
  try {
    await d.waitFor({ state: "visible", timeout });
  } catch {
    return false;
  }
  await d.getByRole("button").last().click();
  await expect(d).toBeHidden();
  return true;
}

/**
 * Espera a cópia do restaurante de exemplo da conta ficar pronta (D255). Primeiro a tela real ("Visão geral"): com o
 * esqueleto do loading.tsx (D235), o aviso "Preparando…" ainda não chegou e "não visível" passava na hora — o teste
 * seguia antes de a cópia existir (falha intermitente sob carga, sempre numa conta nova).
 */
export async function waitExampleReady(page: Page, timeout = 120_000): Promise<void> {
  await expect(page.getByRole("heading", { name: "Visão geral", level: 1 })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout });
}

/**
 * Cadastra um restaurante pela Visão geral (D256): no 1º cadastro, o botão "Cadastrar meu restaurante"; com loja já
 * cadastrada, a opção "+ Nova loja" do seletor "Trocar loja" (o card "Cadastre outro restaurante" saiu).
 */
export async function startNewStore(page: Page): Promise<void> {
  const first = page.getByRole("button", { name: "Cadastrar meu restaurante" });
  if (await first.isVisible()) await first.click();
  else await pickOption(page, "Trocar loja", /Nova loja/);
}

/** Login de teste (D123): pede o código com o token e confere — o cookie fica no contexto da página. */
export async function loginE2E(request: APIRequestContext, n: number): Promise<void> {
  // O secret colado no GitHub pode vir com quebra de linha ou aspas em volta (revisão da S2: "Invalid character
  // in header content"); limpa como `cleanApiKey` faz com as chaves de IA.
  const token = e2eToken();
  const email = `e2e-dono+${n}@exemplo.invalid`;
  const r = await request.post("/api/parceiro/entrar", { data: { email }, headers: { "x-e2e-token": token } });
  expect(r.status()).toBe(200);
  const { codigo } = (await r.json()) as { codigo: string };
  const v = await request.post("/api/parceiro/entrar/codigo", { data: { email, codigo } });
  expect(v.status()).toBe(200);
}

export function e2eToken(): string {
  const raw = process.env.E2E_LOGIN_TOKEN ?? (PROD ? "" : E2E_LOGIN_TOKEN_LOCAL);
  const token = raw.trim().replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, "").trim();
  expect(token, "E2E_LOGIN_TOKEN ausente (secret do GitHub)").not.toBe("");
  return token;
}

let seq = 0;
/** E-mail de cliente do E2E (padrão D123, S4): id largo para não repetir entre execuções em produção. */
export function e2eCustomerEmail(): string {
  seq = (seq + 1) % 1000;
  return `e2e-cliente+${Date.now()}${String(seq).padStart(3, "0")}@exemplo.invalid`;
}

/**
 * Login do cliente pela API (S4 — D154, D173): e-mail de teste + token → código na resposta → confirmar → perfil.
 * `apiBase` é "/api/r/<slug>". O cookie do cliente fica no contexto do `request`.
 */
export async function loginCustomer(request: APIRequestContext, apiBase: string, name = "Cliente Automático", email = e2eCustomerEmail()): Promise<string> {
  const r = await request.post(`${apiBase}/entrar`, { data: { email, accept: true }, headers: { "x-e2e-token": e2eToken() } });
  expect(r.status(), await r.text()).toBe(200);
  const { codigo } = (await r.json()) as { codigo: string };
  const v = await request.post(`${apiBase}/entrar/confirmar`, { data: { email, code: codigo } });
  expect(v.status()).toBe(200);
  const { etapa } = (await v.json()) as { etapa: string };
  if (etapa === "perfil") {
    const pf = await request.post(`${apiBase}/perfil`, { data: { name, phone: "", optEmail: true, optApp: true } });
    expect(pf.status()).toBe(200);
  } else if (etapa === "consentir") {
    const c = await request.post(`${apiBase}/consentimento`, { data: { optEmail: true, optApp: true } });
    expect(c.status()).toBe(200);
  }
  return email;
}

/**
 * Seletor do design system (`Select`, ajuste de 21/11): abre pelo rótulo e escolhe a opção pelo nome (ou pela
 * posição). A lista fica dentro do componente (lista suspensa ou BottomSheet), então o escopo pode ser uma região.
 * Devolve o texto da opção escolhida.
 */
export async function pickOption(scope: Page | Locator, label: string | RegExp, option: string | RegExp | { index: number }): Promise<string> {
  const trigger = scope.getByLabel(label).and(scope.getByRole("button"));
  await trigger.click();
  const box = scope.getByRole("listbox");
  await expect(box).toBeVisible();
  const opt = typeof option === "object" && "index" in option ? box.getByRole("option").nth(option.index) : box.getByRole("option", { name: option });
  const text = ((await opt.locator("span > span").first().textContent()) ?? "").trim();
  await opt.click();
  await expect(box).toBeHidden();
  return text;
}

/** Valores das opções de um `Select` (abre e fecha com Esc). */
export async function optionValues(scope: Page | Locator, label: string | RegExp): Promise<Array<{ value: string; text: string }>> {
  const trigger = scope.getByLabel(label).and(scope.getByRole("button"));
  await trigger.click();
  const box = scope.getByRole("listbox");
  await expect(box).toBeVisible();
  const out = await box.getByRole("option").evaluateAll((els) => els.map((e) => ({ value: e.getAttribute("data-value") ?? "", text: e.textContent ?? "" })));
  await box.press("Escape");
  await expect(box).toBeHidden();
  return out;
}

/**
 * Restaurantes cadastrados da conta (todos menos a cópia do exemplo), lidos no seletor "Trocar loja". Sem seletor (1
 * loja só) → lista vazia. Limpeza das specs que cadastram restaurantes (o rótulo deixou de ter "teste" na S4, e a
 * limpeza antiga não apagava nada — as contas de E2E de produção chegavam ao limite de 3).
 */
export async function storeIds(page: Page): Promise<string[]> {
  const picker = page.getByLabel("Trocar loja").and(page.getByRole("button"));
  if (!(await picker.count())) return [];
  // D256: "+ Nova loja" é uma opção do seletor, não uma loja.
  return (await optionValues(page, "Trocar loja")).filter((o) => !o.text.includes("exemplo") && o.value !== "__nova_loja__").map((o) => o.value);
}
