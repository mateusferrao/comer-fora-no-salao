import { expect, test } from "@playwright/test";
import { axe, loginCustomer, loginE2E, S5_ON, waitExampleReady } from "./helpers";

/**
 * Volta com convite pelas Ferramentas do avaliador (D153) e grupo de controle visível só ao dono (D172).
 * Restaurante E2E oculto (faixa o dia todo, teto alto — D109) e a cópia do restaurante de exemplo. Local e produção.
 */
const E2E = "e2e-salao-teste";
test.use({ viewport: { width: 390, height: 844 } });

type Ck = { outcome: string; invite: unknown; codes: Array<{ code: string; type: string }> };

test("Avançar 1 dia (Bastidores) → novo check-in → código do convite; o cliente não vê nada de teste", async ({ browser }) => {
  test.setTimeout(150_000);
  let found: import("@playwright/test").BrowserContext | null = null;
  for (let i = 0; i < 15 && !found; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await loginCustomer(ctx.request, `/api/r/${E2E}`, "Volta Automática");
    const ck = (await (await ctx.request.post(`/api/r/${E2E}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } })).json()) as Ck;
    if (ck.invite) found = ctx;
    else await ctx.close();
  }
  expect(found, "nenhum cliente convidável em 15 tentativas").not.toBeNull();
  const ctx = found!;
  const page = await ctx.newPage();
  await page.goto(`/r/${E2E}/checkin`);
  await expect(page.getByRole("region", { name: "Seu convite" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/antecipar|Só no teste|restaurante de teste/i);

  // O avaliador (dono) usa a ferramenta nos Bastidores; a conta do E2E pode agir no restaurante E2E fixo.
  await loginE2E(ctx.request, 7);
  const adv = await ctx.request.post("/api/avaliador/avancar", { data: { slug: E2E } });
  expect(adv.status(), await adv.text()).toBe(200);
  expect(((await adv.json()) as { advanced: number }).advanced).toBeGreaterThanOrEqual(1);

  const back = (await (await ctx.request.post(`/api/r/${E2E}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } })).json()) as Ck;
  expect(back.outcome).toBe("volta_com_convite");
  expect(back.codes.map((c) => c.type)).toContain("convite");
  await page.goto(`/r/${E2E}/checkin`);
  await expect(page.getByText("Informe este código ao garçom").first()).toBeVisible();
  await axe(page);
  await ctx.close();
});

test("Ferramentas do avaliador: página pede login; logado, mostra os restaurantes do dono", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/bastidores/avaliador");
  await expect(page.getByText("Entre no Portal para usar as ferramentas.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Como testar sozinho" })).toBeVisible();
  await loginE2E(page.request, 7);
  await page.goto("/bastidores/avaliador");
  await expect(page.getByRole("heading", { name: "Avançar 1 dia" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver como cliente reativado" })).toBeVisible();
  await axe(page);
});

test("grupo de controle: o cliente não vê nada; o dono vê a marca em 'Últimos check-ins de hoje'", async ({ browser, page }) => {
  test.setTimeout(240_000);
  await loginE2E(page.request, 8);
  await page.goto("/parceiro/salao");
  await waitExampleReady(page);
  await page.reload();
  const href = (await page.getByRole("link", { name: "Ver minha página" }).getAttribute("href"))!;
  let holdout = false;
  for (let i = 0; i < 80 && !holdout; i++) {
    const ctx = await browser.newContext();
    await loginCustomer(ctx.request, `/api${href}`, "Controle Automático");
    const ck = (await (await ctx.request.post(`/api${href}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } })).json()) as Ck & Record<string, unknown>;
    expect(Object.keys(ck)).not.toContain("testNote");
    if (!ck.invite && ck.outcome === "primeira_visita") holdout = true;
    await ctx.close();
  }
  expect(holdout, "nenhum cliente no grupo de controle em 80 tentativas").toBe(true);
  await page.reload();
  // Com `painel_valor` (S5.1), a lista vira "Hoje no salão", com a mesma marca.
  await expect(page.getByTestId(S5_ON ? "hoje-no-salao" : "ultimos-checkins")).toContainText("grupo de controle · sem convite (mede o efeito)", { timeout: 10_000 });
});
