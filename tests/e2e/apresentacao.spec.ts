import { expect, test } from "@playwright/test";
import { BARRA, loginE2E, waitExampleReady } from "./helpers";

/** Modo apresentação (planejamento S3 §4.6; revisão P-I7): larguras de demo, barra visível, troca de restaurante. */
for (const [w, h] of [
  [1536, 864],
  [1280, 800],
  [1152, 720],
] as const) {
  test(`modo apresentação em ${w}×${h}: Portal + app na moldura, barra visível fora dos iframes`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w, height: h });
    // Conta própria por tamanho (a 4 é do painel.spec): logins paralelos na mesma conta invalidam o código.
    await loginE2E(page.request, w === 1536 ? 7 : w === 1280 ? 8 : 9);
    await page.goto("/parceiro/salao");
    await waitExampleReady(page);
    await page.goto("/apresentacao");
    await expect(page.getByTestId("prototype-bar")).toHaveText(BARRA);
    const portal = page.frameLocator('iframe[title="Portal do Parceiro"]');
    // Banco novo: a 1ª cópia do exemplo pode ainda estar sendo preparada no iframe (mesma espera da navegacao.spec).
    await expect(portal.getByRole("heading", { name: "Visão geral", level: 1 })).toBeVisible({ timeout: 120_000 });
    await expect(portal.getByTestId("prototype-bar")).toHaveCount(0);
    // Barra lateral do Portal visível (não cai no layout de celular — revisão S3 #24).
    await expect(portal.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    const app = page.frameLocator('iframe[title="App do cliente"]');
    await expect(app.getByRole("button", { name: "Check-in" }).or(app.getByRole("link", { name: /^(Check-in|Fazer check-in)$/ })).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /^Restaurante / })).toBeVisible();
    await expect(page.getByRole("link", { name: "Bastidores" })).toBeVisible();
  });
}

test("sem sessão, o modo apresentação manda para o login", async ({ page }) => {
  await page.goto("/apresentacao");
  await expect(page).toHaveURL(/\/parceiro\/entrar$/);
});
