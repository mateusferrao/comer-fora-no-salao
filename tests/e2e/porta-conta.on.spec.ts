import { expect, test } from "@playwright/test";
import { axe, loginE2E, PROD, S5_ON } from "./helpers";

/**
 * S6.4 com a flag `porta_conta` (passada `flags-on`): Kit › "Adicionar porta-conta" (kit da cópia do exemplo, que
 * já existia) → prévia com o texto modelo → imprimir 3 por folha → o QR leva à página do restaurante com o token da
 * peça. Conta própria (e2e-dono+23).
 */
test.skip(PROD && !S5_ON, "em produção, só depois de ligar as flags (E2E_FLAGS=on)");

test("porta-conta: adicionar → texto da 1ª visita → imprimir 3 por folha → QR da peça", async ({ page }) => {
  test.setTimeout(120_000);
  await loginE2E(page.request, 23);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 60_000 });
  await page.goto("/parceiro/salao/kit");
  const add = page.getByRole("button", { name: "Adicionar porta-conta" });
  if (await add.isVisible()) await add.click();
  const section = page.getByRole("region", { name: "Porta-conta (⅓ de A4)" });
  await expect(section).toBeVisible();
  await expect(section.getByTestId("porta-conta-texto")).toContainText("Antes de pagar, faça check-in · Na 1ª visita:");
  await expect(section).not.toContainText(/terça|quarta|quinta|tarde|noite/i);
  await axe(page);
  const qr = await section.getByRole("link", { name: "Abrir o QR do porta-conta" }).getAttribute("href");
  expect(qr).toMatch(/^\/r\/[^?]+\?p=[a-z0-9]{12}$/);
  await section.getByRole("link", { name: "Imprimir porta-contas (3 por folha)" }).click();
  await expect(page.locator('[data-peca="porta_conta"]')).toHaveCount(3);
  await expect(page.getByRole("img", { name: "QR do porta-conta" })).toHaveCount(3);
  await expect(page.getByText("A4 com 3 porta-contas de 21 × 9,9 cm para recortar")).toBeVisible();
  const r = await page.goto(qr!);
  expect(r?.status()).toBe(200);
});
