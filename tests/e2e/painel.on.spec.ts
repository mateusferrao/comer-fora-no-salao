import { expect, test } from "@playwright/test";
import { axe, loginCustomer, loginE2E, PROD, S5_ON } from "./helpers";

/**
 * S5.1 com a flag `painel_valor` ligada (passada `flags-on`; em produção só com E2E_FLAGS=on): topo em R$,
 * metas desta semana e "Hoje no salão" na cópia do restaurante de exemplo. Conta própria (e2e-dono+11).
 */
test.skip(PROD && !S5_ON, "em produção, só depois de ligar as flags (E2E_FLAGS=on)");
test.describe.configure({ mode: "serial" });

async function openCopy(page: import("@playwright/test").Page) {
  await loginE2E(page.request, 11);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 60_000 });
  await page.reload();
}

for (const width of [1280, 390]) {
  test(`topo em R$ e metas da semana em ${width} px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await openCopy(page);
    const top = page.getByTestId("valor-topo");
    await expect(top).toHaveAttribute("data-kind", "causal_positivo");
    await expect(top).toContainText(/R\$\s?[\d.]+ a mais em margem entre [\d.]+ convidados até agora/);
    await expect(page.getByRole("heading", { name: "Metas desta semana" })).toBeVisible();
    await expect(page.getByTestId("metas").getByRole("progressbar").first()).toHaveAttribute("aria-label", /mesas? a mais por semana/);
    // A métrica em visitas continua, abaixo.
    await expect(page.getByTestId("metric-state")).toHaveAttribute("data-state", "positivo");
    await axe(page);
  });
}

test("check-in de um cliente aparece em 'Hoje no salão' em até 5 s", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await openCopy(page);
  await expect(page.getByRole("heading", { name: "Hoje no salão" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Últimos check-ins de hoje" })).toHaveCount(0);
  const href = (await page.getByRole("link", { name: "Ver minha página" }).getAttribute("href"))!;
  const ctx = await browser.newContext();
  await loginCustomer(ctx.request, `/api${href}`, "Lia Moraes");
  const ck = await ctx.request.post(`/api${href}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } });
  expect(ck.ok()).toBe(true);
  await ctx.close();
  await expect(page.getByTestId("hoje-no-salao")).toContainText("Lia M. fez check-in", { timeout: 5_000 });
  await expect(page.getByTestId("hoje-contagens")).toContainText(/Hoje: \d+ leituras? · [1-9]\d* check-ins/);
  await axe(page);
});
