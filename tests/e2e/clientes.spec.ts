import { expect, test } from "@playwright/test";
import { axe, loginE2E, waitExampleReady } from "./helpers";

/**
 * Ajustes de 21/11 (sem flag): Clientes mostra todos do grupo (20 por página), busca por nome e ordena ao clicar no
 * título da coluna; no celular, o cabeçalho do Portal acompanha a rolagem. Contas próprias (e2e-dono+27 e +29: logins em paralelo na mesma conta invalidam o código), cópia do exemplo.
 */
test("clientes: 20 por página, página 2, ordenar por Selos (aria-sort), buscar por nome", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginE2E(page.request, 27);
  await page.goto("/parceiro/salao");
  await waitExampleReady(page);
  await page.goto("/parceiro/salao/clientes?segmento=sumiu");
  const rows = page.getByRole("region", { name: "Lista de clientes (rolável)" }).locator("tbody tr");
  await expect(rows).toHaveCount(20);
  await expect(page.getByTestId("clientes-total")).toContainText("clientes neste grupo");
  const nav = page.getByRole("navigation", { name: "Páginas da lista de clientes" });
  await expect(nav).toContainText("Página 1 de");
  await nav.getByRole("link", { name: "Próxima →" }).click();
  await expect(nav).toContainText("Página 2 de");

  // Ordenar não joga a tela para o topo (ajuste de 21/11).
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);
  const before = 300;
  expect(before).toBeGreaterThan(100);
  await page.getByRole("link", { name: /^Selos/ }).click();
  await expect(page.getByRole("columnheader", { name: /Selos/ })).toHaveAttribute("aria-sort", "descending");
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThan(40);
  // Setas em SVG (nunca emoji).
  await expect(page.getByRole("columnheader", { name: /Selos/ }).locator("svg")).toHaveCount(1);
  await expect(page.locator("thead")).not.toContainText(/[↕▲▼]/);
  const stamps = await rows.locator("td:nth-child(6)").allTextContents();
  const n = stamps.map((t) => Number(t.split("/")[0]));
  expect(n).toEqual([...n].sort((a, b) => b - a));
  await page.getByRole("link", { name: /^Selos/ }).click();
  await expect(page.getByRole("columnheader", { name: /Selos/ })).toHaveAttribute("aria-sort", "ascending");

  // D237: contato completo (fictício no exemplo).
  await expect(rows.first().locator("td").nth(1)).toHaveText(/^\(00\) 9\d{4}-\d{4}$/);
  await expect(rows.first().locator("td").nth(2)).toHaveText(/@exemplo\.invalid$/);
  const email = (await rows.first().locator("td").nth(2).textContent())!.trim();
  await page.getByLabel("Buscar por nome").fill(email);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByTestId("clientes-total")).toContainText("1 cliente encontrado");
  await page.getByRole("link", { name: "Limpar busca" }).click();
  const first = (await rows.first().locator("td").first().textContent())!.trim();
  const term = first.split(" ")[0]!;
  await page.getByLabel("Buscar por nome").fill(term.toUpperCase());
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByTestId("clientes-total")).toContainText(`para “${term.toUpperCase()}”`);
  for (const name of await rows.locator("td:first-child").allTextContents()) expect(name.toLowerCase()).toContain(term.toLowerCase());
  await axe(page);
  await page.getByLabel("Buscar por nome").fill("zzzzqqq");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("Nenhum cliente encontrado neste grupo.")).toBeVisible();
});

test("celular: o cabeçalho do Portal fica visível depois de rolar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginE2E(page.request, 29);
  await page.goto("/parceiro/salao");
  await waitExampleReady(page);
  await page.goto("/parceiro/salao/clientes?segmento=sumiu");
  // A lista chega depois do esqueleto (loading.tsx): rola só com a tela real.
  await expect(page.getByRole("region", { name: "Lista de clientes (rolável)" })).toBeVisible();
  const menu = page.getByRole("button", { name: "Abrir menu" });
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await expect(menu).toBeInViewport();
  const top = await menu.evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(20);
});
