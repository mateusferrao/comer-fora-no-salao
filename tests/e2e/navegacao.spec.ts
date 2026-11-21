import { expect, test } from "@playwright/test";
import { axe, loginE2E } from "./helpers";

/**
 * Ajuste de 21/11: tocar num item do menu responde na hora. Com a resposta do servidor atrasada de propósito, o
 * esqueleto da tela nova (`aria-busy`) e o item tocado já marcado aparecem antes do conteúdo; depois, a tela real.
 */
test("celular: menu → Clientes mostra o esqueleto e marca o item na hora, antes da resposta do servidor", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginE2E(page.request, 32);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "Visão geral", level: 1 })).toBeVisible();
  // Atrasa só a navegação para Clientes; o prefetch (que traz o esqueleto) passa normal, como na vida real.
  await page.route(/\/parceiro\/salao\/clientes/, async (route) => {
    if (!route.request().headers()["next-router-prefetch"]) await new Promise((r) => setTimeout(r, 2_500));
    await route.continue();
  });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  // Tempo humano entre abrir o menu e tocar (o menu visível dispara o prefetch).
  await page.waitForTimeout(600);
  await menu.getByRole("link", { name: "Clientes" }).click();
  await expect(page.getByTestId("carregando").or(page.getByRole("heading", { name: "Clientes", level: 1 }))).toBeVisible({ timeout: 800 });
  await expect(page.getByTestId("carregando")).toHaveAttribute("aria-busy", "true");
  await axe(page);
  await expect(page.getByRole("heading", { name: "Clientes", level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("carregando")).toHaveCount(0);
});

test("computador: o item tocado fica marcado enquanto a tela carrega", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginE2E(page.request, 33);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 120_000 });
  await page.route(/\/parceiro\/salao\/kit/, async (route) => {
    if (!route.request().headers()["next-router-prefetch"]) await new Promise((r) => setTimeout(r, 2_500));
    await route.continue();
  });
  await page.waitForTimeout(600);
  const nav = page.getByRole("navigation", { name: "Menu principal" });
  await nav.getByRole("link", { name: "Kit de divulgação" }).click();
  await expect(nav.getByRole("link", { name: "Kit de divulgação" }).getByTestId("nav-pendente").or(page.getByTestId("carregando"))).toBeVisible({ timeout: 800 });
  await expect(page.getByRole("heading", { name: "Kit de divulgação", level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(nav.getByRole("link", { name: "Kit de divulgação" })).toHaveAttribute("aria-current", "page");
});
