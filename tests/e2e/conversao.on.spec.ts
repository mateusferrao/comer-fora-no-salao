import { expect, test, type Page } from "@playwright/test";
import { axe, loginCustomer, PROD, S5_ON } from "./helpers";

/**
 * S5.2 com a flag `copy_v2` (passada `flags-on`; em produção só com E2E_FLAGS=on): landing de venda ao dono,
 * página do QR de conversão (sem nada do convite antes do check-in) e "Adicionar à agenda" (.ics).
 */
test.skip(PROD && !S5_ON, "em produção, só depois de ligar as flags (E2E_FLAGS=on)");
const E2E = "e2e-salao-teste";
const PROIBIDO = /simulad|fictíci|ficticio|de teste|para testar|\btestar\b|demonstra[çc][ãa]o|\bdemo\b|protótipo/i;

async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[aria-label="Aviso de protótipo"], [data-testid="prototype-bar-sheet"], script, style').forEach((n) => n.remove());
    return clone.innerText;
  });
}

for (const width of [390, 1280]) {
  test(`landing do dono em ${width} px: herói, 3 passos, 63% com fonte, controle de custo e FAQ`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Seu salão cheio divulga seu horário vazio", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ativar meu salão" }).first()).toHaveAttribute("href", "/parceiro/entrar");
    await expect(page.getByRole("link", { name: "Veja o que seu cliente vê" })).toHaveAttribute("href", "/r/cantina-nonna-lucia");
    await expect(page.getByRole("heading", { name: /Segundo o iFood, 63% de quem usou o Comer Fora no Rio/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Fonte" })).toHaveAttribute("href", "/bastidores/como-funciona#fontes");
    await page.getByText("Quanto custa?").click();
    await expect(page.getByText("Você paga só os benefícios que aprovar, até o teto semanal que você define.")).toBeVisible();
    expect(PROIBIDO.exec(await visibleText(page))).toBeNull();
    await axe(page);
  });
}

test("página do QR: faixa do benefício de agora, 3 passos, botão fixo; nada do convite antes do check-in", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/r/cantina-nonna-lucia");
  const band = page.getByTestId("faixa-conversao");
  await expect(band).toContainText("na sua 1ª visita");
  await expect(band).toContainText("Diga o código ao garçom");
  await expect(page.getByRole("link", { name: "Fazer check-in e ativar o benefício" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Volte .* e ganhe|Seu convite/);
  expect(PROIBIDO.exec(await visibleText(page))).toBeNull();
  await axe(page);
});

test("convite real: 'Adicionar à agenda' baixa um .ics; na Jornada também", async ({ browser }) => {
  test.setTimeout(150_000);
  let found: { ctx: import("@playwright/test").BrowserContext; url: string } | null = null;
  for (let i = 0; i < 15 && !found; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await loginCustomer(ctx.request, `/api/r/${E2E}`, "Agenda Automática");
    const ck = (await (await ctx.request.post(`/api/r/${E2E}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } })).json()) as { invite: { agendaUrl?: string | null } | null };
    if (ck.invite?.agendaUrl) found = { ctx, url: ck.invite.agendaUrl };
    else await ctx.close();
  }
  expect(found, "nenhum convite em 15 tentativas").not.toBeNull();
  const { ctx, url } = found!;
  const ics = await ctx.request.get(url);
  expect(ics.status()).toBe(200);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  const body = await ics.text();
  expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(body).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  expect((await ctx.request.get(`${url}x`)).status()).toBe(404);
  const page = await ctx.newPage();
  await page.goto("/app/jornada");
  await expect(page.getByRole("link", { name: "Adicionar à agenda" })).toBeVisible();
  await axe(page);
  await ctx.close();
});
