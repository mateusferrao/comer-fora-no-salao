import { expect, test } from "@playwright/test";
import { axe, loginE2E, PROD, S5_ON, waitExampleReady } from "./helpers";

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
  await waitExampleReady(page);
  await page.goto("/parceiro/salao/kit");
  // Espera a tela real (depois do esqueleto do loading.tsx) antes de decidir se precisa adicionar.
  await expect(page.getByRole("heading", { name: "Kit de divulgação", level: 1 })).toBeVisible();
  const add = page.getByRole("button", { name: "Adicionar porta-conta" });
  if (await add.isVisible()) await add.click();
  const section = page.getByRole("region", { name: "Porta-conta (⅓ de A4)" });
  await expect(section).toBeVisible();
  await expect(section.getByTestId("porta-conta-texto")).toContainText("Antes de pagar, faça check-in · Na 1ª visita,");
  await expect(section).not.toContainText(/terça|quarta|quinta|tarde|noite/i);
  await axe(page);
  const qr = await section.getByRole("link", { name: "Abrir o QR do porta-conta" }).getAttribute("href");
  expect(qr).toMatch(/^\/r\/[^?]+\?p=[a-z0-9]{12}$/);
  await section.getByRole("link", { name: "Imprimir porta-contas (3 por folha)" }).click();
  await expect(page.locator('[data-peca="porta_conta"]')).toHaveCount(3);
  await expect(page.getByRole("img", { name: "QR do porta-conta" })).toHaveCount(3);
  await expect(page.getByText("A4 com 3 porta-contas de 21 × 9,9 cm para recortar")).toBeVisible();
  await expect(page.getByText(/Cada folha A4 rende 3 porta-contas iguais/)).toBeVisible();
  // Ajuste de 21/11: no celular a folha cabe na tela (sem rolagem lateral) e o QR aparece inteiro.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const box = await page.getByRole("img", { name: "QR do porta-conta" }).first().boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 900 });
  const r = await page.goto(qr!);
  expect(r?.status()).toBe(200);
});
