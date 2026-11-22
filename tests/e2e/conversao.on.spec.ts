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
  test(`landing do dono em ${width} px: herói com prints, 4 blocos de valor, 63% com fonte, custo com teto e FAQ`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Encha a terça à tarde com quem lotou seu sábado à noite", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ativar meu salão" }).first()).toHaveAttribute("href", "/parceiro/entrar");
    await expect(page.getByRole("link", { name: "Veja o que seu cliente vê" })).toHaveAttribute("href", "/r/cantina-nonna-lucia");
    await expect(page.getByRole("heading", { name: "63% voltaram em menos de 1 mês", level: 2 })).toBeVisible();
    await expect(page.getByText(/Segundo o iFood, 63% de quem usou o Comer Fora no Rio/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Fonte" })).toHaveAttribute("href", "/bastidores/como-funciona#fontes");
    await expect(page.getByText("Comer Fora no salão · para restaurantes com horário sobrando")).toBeVisible();
    const print = page.getByRole("img", { name: /Visão geral do restaurante de exemplo: Quanto os convites renderam/ });
    await expect(print).toBeVisible();
    // S9: abaixo de 640 px, o recorte só do cartão em R$ (legível); acima, o print inteiro.
    await expect.poll(() => print.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(width < 640 ? /visao-geral-topo\.webp$/ : /visao-geral\.webp$/);
    const phone = page.getByRole("img", { name: /Celular do cliente/ });
    await expect(phone).toBeVisible();
    expect((await phone.boundingBox())!.width).toBeGreaterThanOrEqual(140);
    await expect(page.getByText(/^Restaurante de exemplo: histórico gerado, com o efeito do convite fixado em \+0,2 visita .* Não é resultado medido\.$/)).toBeVisible();
    for (const t of ["Do cardápio ao kit para imprimir em 5 passos.", "O cliente da mesa deixa de ser anônimo.", "Um plano por semana, aprovado por você.", "Só conta a volta a mais."]) {
      await expect(page.getByRole("heading", { name: t, level: 3 })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Você vê o custo antes de aprovar, e os convites têm teto semanal" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByText("O que a IA decide?").click();
    await expect(page.getByText(/escolhe entre ofertas que o sistema calculou/)).toBeVisible();
    await page.getByText("Quanto custa?").click();
    await expect(page.getByText(/^Você paga só os benefícios que aprovar\. Os convites têm um teto por semana, que você ajusta\./)).toBeVisible();
    await page.getByText("Preciso de equipe?").click();
    await expect(page.getByText("Não. O garçom confere o código no celular ou no computador do caixa.")).toBeVisible();
    expect(PROIBIDO.exec(await visibleText(page))).toBeNull();
    await axe(page);
  });
}

test("página do QR: faixa do benefício de agora, 3 passos, botão fixo; nada do convite antes do check-in", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/r/cantina-nonna-lucia");
  const band = page.getByTestId("faixa-conversao");
  await expect(band).toContainText("na sua 1ª visita");
  await expect(band).toContainText("Mostre o código ao garçom");
  await expect(page.getByRole("link", { name: "Fazer check-in" })).toBeVisible();
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
