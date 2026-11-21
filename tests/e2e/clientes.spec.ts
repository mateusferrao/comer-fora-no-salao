import { expect, test } from "@playwright/test";
import { axe, loginE2E } from "./helpers";

/**
 * Ajustes de 21/11 (sem flag): Clientes mostra todos do grupo (20 por página), busca por nome e ordena ao clicar no
 * título da coluna; no celular, o cabeçalho do Portal acompanha a rolagem. Conta própria (e2e-dono+27), cópia do exemplo.
 */
test("clientes: 20 por página, página 2, ordenar por Selos (aria-sort), buscar por nome", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginE2E(page.request, 27);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 60_000 });
  await page.goto("/parceiro/salao/clientes?segmento=sumiu");
  const rows = page.getByRole("region", { name: "Lista de clientes (rolável)" }).locator("tbody tr");
  await expect(rows).toHaveCount(20);
  await expect(page.getByTestId("clientes-total")).toContainText("clientes neste grupo");
  const nav = page.getByRole("navigation", { name: "Páginas da lista de clientes" });
  await expect(nav).toContainText("Página 1 de");
  await nav.getByRole("link", { name: "Próxima →" }).click();
  await expect(nav).toContainText("Página 2 de");

  await page.getByRole("link", { name: /^Selos/ }).click();
  await expect(page.getByRole("columnheader", { name: /Selos/ })).toHaveAttribute("aria-sort", "descending");
  const stamps = await rows.locator("td:nth-child(5)").allTextContents();
  const n = stamps.map((t) => Number(t.split("/")[0]));
  expect(n).toEqual([...n].sort((a, b) => b - a));
  await page.getByRole("link", { name: /^Selos/ }).click();
  await expect(page.getByRole("columnheader", { name: /Selos/ })).toHaveAttribute("aria-sort", "ascending");

  const first = (await rows.first().locator("td").first().textContent())!.trim();
  const term = first.split(" ")[0]!;
  await page.getByLabel("Buscar por nome").fill(term.toUpperCase());
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByTestId("clientes-total")).toContainText(`para “${term.toUpperCase()}”`);
  for (const name of await rows.locator("td:first-child").allTextContents()) expect(name.toLowerCase()).toContain(term.toLowerCase());
  await axe(page);
  await page.getByLabel("Buscar por nome").fill("zzzzqqq");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("Nenhum cliente com esse nome neste grupo.")).toBeVisible();
});

test("celular: o cabeçalho do Portal fica visível depois de rolar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginE2E(page.request, 27);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 60_000 });
  await page.goto("/parceiro/salao/clientes?segmento=sumiu");
  const menu = page.getByRole("button", { name: "Abrir menu" });
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await expect(menu).toBeInViewport();
  const top = await menu.evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(20);
});
