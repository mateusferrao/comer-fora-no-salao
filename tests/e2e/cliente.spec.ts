import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

/**
 * Fluxo do cliente (planejamento S1 §7). Roda local, no CI e contra produção (BASE_URL).
 * Check-ins só no restaurante E2E oculto (D109); a vitrine é só lida.
 */
const E2E = "e2e-salao-teste";
const VITRINE = "cantina-nonna-lucia";
const BARRA = "Protótipo de case · não é produto oficial do iFood · dados fictícios";

test.use({ viewport: { width: 390, height: 844 } });

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

function fakePhone() {
  const d = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return `(00) 9${d.slice(0, 4)}-${d.slice(4)}`;
}

/** Cliente novo pela API (rápido): identifica e faz check-in; devolve a resposta do check-in. */
async function apiCheckin(request: APIRequestContext) {
  const id = await request.post(`/api/r/${E2E}/identificacao`, {
    data: { name: "Teste Automático", phone: fakePhone(), optWhatsapp: true, optApp: true, optPush: true, accept: true },
  });
  expect(id.status()).toBe(200);
  const res = await request.post(`/api/r/${E2E}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } });
  expect(res.status()).toBe(200);
  return (await res.json()) as { outcome: string; invite: unknown; codes: Array<{ code: string }> };
}

/** Fluxo completo pela interface, com GPS negado (o padrão do navegador de teste). */
async function uiCheckin(page: Page) {
  await page.goto(`/r/${E2E}/checkin`);
  await page.getByRole("button", { name: "Fazer check-in" }).click();
  const gps = page.getByRole("dialog", { name: "Parece que você não está no restaurante!" });
  await expect(gps).toBeVisible();
  await expect(gps).toContainText("O GPS pode não ser preciso. Se você já está no restaurante, confirme abaixo para tentarmos validar seu benefício novamente.");
  await gps.getByRole("button", { name: "Confirmar localização" }).click();
  const id = page.getByRole("dialog", { name: "Identifique-se para ativar seus benefícios" });
  await expect(id).toBeVisible();
  await expect(id.getByLabel("Telefone (fictício)")).toHaveValue(/^\(00\) 9\d{4}-\d{4}$/);
  await expect(id.getByLabel("Telefone (fictício)")).toHaveAttribute("autocomplete", "off");
  await id.getByRole("checkbox").check();
  await id.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Check-in feito!" })).toBeVisible();
}

/** Repete com clientes novos até cair um convidável (10% caem no holdout). */
async function uiCheckinConvidavel(context: BrowserContext, browserNewContext: () => Promise<BrowserContext>): Promise<Page> {
  let ctx = context;
  for (let i = 0; i < 8; i++) {
    const page = await ctx.newPage();
    await uiCheckin(page);
    const invite = page.getByRole("region", { name: "Seu convite" });
    if (await invite.waitFor({ timeout: 2_500 }).then(() => true, () => false)) return page;
    ctx = await browserNewContext();
  }
  throw new Error("nenhum cliente convidável em 8 tentativas");
}

test.describe("vitrine (só leitura)", () => {
  test("página do restaurante: abas, linha genérica do convite, nada de oferta ou horário antes do check-in", async ({ page }) => {
    const res = await page.goto(`/r/${VITRINE}`);
    expect(res?.status()).toBe(200);
    expect(res?.headers()["x-robots-tag"]).toMatch(/noindex/);
    await expect(page.getByTestId("prototype-bar")).toHaveText(BARRA);
    await expect(page.getByRole("heading", { level: 1, name: "Cantina Nonna Lúcia" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Benefícios" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Faça check-in e você pode ganhar um convite para voltar")).toBeVisible();
    await expect(page.getByText("Doce grátis").first()).toBeVisible();
    const html = await page.content();
    for (const banned of ["Cannoli", "Bruschetta", "15h–18h", "21h–23h"]) expect(html).not.toContain(banned);
    await axe(page);
    await page.getByRole("tab", { name: "Sobre" }).click();
    await expect(page.getByText("Rua das Laranjeiras Fictícias, 120")).toBeVisible();
  });

  test("detalhe do benefício e regras abrem e fecham com Esc", async ({ page }) => {
    await page.goto(`/r/${VITRINE}`);
    await page.getByRole("button", { name: /Doce grátis/ }).click();
    const sheet = page.getByRole("dialog", { name: "Benefícios pra você" });
    await expect(sheet).toContainText("Faça o check-in para ativar o benefício e aproveitar");
    await expect(sheet).toContainText("Recado do Cantina Nonna Lúcia");
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await page.getByRole("button", { name: /Junte Selos e Ganhe/ }).click();
    await expect(page.getByRole("dialog", { name: "Detalhes e regras" })).toContainText("Limitado a 1 check-in por dia");
  });

  test("beacon de leitura com o token da peça responde 204", async ({ page }) => {
    test.skip(Boolean(process.env.BASE_URL), "em produção não grava leituras na vitrine (planejamento S1 §7)");
    const beacon = page.waitForResponse((r) => r.url().includes(`/api/r/${VITRINE}/leitura`));
    await page.goto(`/r/${VITRINE}?p=nl-display-a`);
    expect((await beacon).status()).toBe(204);
  });

  test("slug inexistente → 404 em português", async ({ page }) => {
    const res = await page.goto("/r/nao-existe-xyz");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("Página não encontrada")).toBeVisible();
  });
});

test.describe("check-in no restaurante E2E", () => {
  test("GPS negado → identificação → código + selo 1/6 + 2º card; recarregar mantém o código", async ({ context, browser }) => {
    const page = await uiCheckinConvidavel(context, () => browser.newContext({ viewport: { width: 390, height: 844 } }));
    await expect(page.getByText("Informe este código ao garçom")).toBeVisible();
    await expect(page.getByText("Vale só hoje")).toBeVisible();
    await expect(page.getByRole("list", { name: "Cartela: 1 de 6 selos" })).toBeVisible();
    const invite = page.getByRole("region", { name: "Seu convite" });
    await expect(invite).toContainText("Cannoli grátis");
    await expect(invite).toContainText("Quando voltar, faça check-in nesse horário para receber o código.");
    const code = (await page.getByLabel(/^Código /).first().textContent())!.trim();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
    await axe(page);

    // Recarregar no mesmo dia: abre direto o resultado do dia, com o código, sem refazer o GPS (P-B1; revisão S1).
    await page.reload();
    await expect(page.getByRole("heading", { name: "Você já fez check-in hoje" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fazer check-in" })).toHaveCount(0);
    await expect(page.getByText(code)).toBeVisible();

    // Jornada com o convite ativo e o código de hoje.
    await page.goto("/app/jornada");
    await expect(page.getByText("Restaurante E2E (teste)")).toBeVisible();
    await expect(page.getByText("Convite ativo")).toBeVisible();
    await expect(page.getByText(code)).toBeVisible();
    await axe(page);
  });

  test("2 identidades diferentes no mesmo dia: as duas têm 1ª visita", async ({ playwright, baseURL }) => {
    const a = await playwright.request.newContext({ baseURL });
    const b = await playwright.request.newContext({ baseURL });
    const [ra, rb] = await Promise.all([apiCheckin(a), apiCheckin(b)]);
    expect(ra.outcome).toBe("primeira_visita");
    expect(rb.outcome).toBe("primeira_visita");
    expect(ra.codes[0]!.code).not.toBe(rb.codes[0]!.code);
  });

  test("holdout: sem 2º card, sem menção a convite, e a Jornada sem convite", async ({ playwright, baseURL, browser }) => {
    let holdoutState: Awaited<ReturnType<APIRequestContext["storageState"]>> | null = null;
    for (let i = 0; i < 100 && !holdoutState; i++) {
      const req = await playwright.request.newContext({ baseURL });
      const r = await apiCheckin(req);
      if (r.invite === null) {
        const json = JSON.stringify(r);
        for (const w of ["holdout", "fantasma", "suprimido", "convite"]) expect(json).not.toContain(w);
        holdoutState = await req.storageState();
      }
      await req.dispose();
    }
    expect(holdoutState, "nenhum holdout em 100 clientes").not.toBeNull();
    const ctx = await browser.newContext({ storageState: holdoutState!, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/app/jornada");
    await expect(page.getByText("Restaurante E2E (teste)")).toBeVisible();
    await expect(page.getByText("Convite ativo")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("convite para voltar");
  });

  test("Testar como outro cliente: volta ao restaurante e pede nova identificação", async ({ page }) => {
    await uiCheckin(page);
    await page.getByRole("button", { name: "Testar como outro cliente (fictício)" }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${E2E}$`));
    await page.goto(`/r/${E2E}/checkin`);
    await page.getByRole("button", { name: "Fazer check-in" }).click();
    await page.getByRole("button", { name: "Confirmar localização" }).click();
    await expect(page.getByRole("dialog", { name: "Identifique-se para ativar seus benefícios" })).toBeVisible();
  });

  test("falha de rede no check-in → mensagem e 'Tentar de novo' com a mesma chave", async ({ page }) => {
    let keys: string[] = [];
    let fail = true;
    await page.route(`**/api/r/${E2E}/checkin`, async (route) => {
      keys.push((route.request().postDataJSON() as { idempotencyKey: string }).idempotencyKey);
      if (fail) {
        fail = false;
        return route.abort("failed");
      }
      return route.continue();
    });
    await page.goto(`/r/${E2E}/checkin`);
    await page.getByRole("button", { name: "Fazer check-in" }).click();
    await page.getByRole("button", { name: "Confirmar localização" }).click();
    const id = page.getByRole("dialog", { name: "Identifique-se para ativar seus benefícios" });
    await id.getByRole("checkbox").check();
    await id.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Não conseguimos" })).toContainText("Não conseguimos fazer seu check-in.");
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByRole("heading", { name: "Check-in feito!" })).toBeVisible();
    expect(new Set(keys).size).toBe(1);
    keys = [];
  });

  test("sheets: a barra de protótipo continua visível com o sheet aberto (revisão S1)", async ({ page }) => {
    await page.goto(`/r/${E2E}/checkin`);
    await page.getByRole("button", { name: "Fazer check-in" }).click();
    await page.getByRole("button", { name: "Confirmar localização" }).click();
    const id = page.getByRole("dialog", { name: "Identifique-se para ativar seus benefícios" });
    await expect(id.getByTestId("prototype-bar-sheet")).toHaveText(BARRA);
    await expect(id.getByTestId("prototype-bar-sheet")).toBeInViewport();
    await expect(id.getByRole("button", { name: "Continuar" })).toBeInViewport();
    await expect(id.getByText(/Ao continuar, você ativa: Doce grátis · Panna cotta/)).toBeVisible();
  });

  test("identificação: formato inválido e aceite ausente mostram erro", async ({ page }) => {
    await page.goto(`/r/${E2E}/checkin`);
    await page.getByRole("button", { name: "Fazer check-in" }).click();
    await page.getByRole("button", { name: "Confirmar localização" }).click();
    const id = page.getByRole("dialog", { name: "Identifique-se para ativar seus benefícios" });
    await id.getByLabel("Telefone (fictício)").fill("123");
    await id.getByRole("button", { name: "Continuar" }).click();
    await expect(id.getByText("Use o formato (00) 90000-0000")).toBeVisible();
    await expect(id.getByText("Marque o aceite para continuar")).toBeVisible();
    await axe(page);
  });
});
