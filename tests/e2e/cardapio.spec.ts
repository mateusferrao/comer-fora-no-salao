import { expect, test } from "@playwright/test";
import { axe, loginE2E, pickOption, storeIds } from "./helpers";

/**
 * S6.3a (D197, sem flag): "Digitar o cardápio" no cadastro — passa pelo "Seu salão" (modo manual), abre o passo 3
 * vazio ("Seu cardápio") e aceita incluir, editar e remover itens à mão. Conta própria (e2e-dono+25).
 */
test("cardápio manual: digitar → seu salão → seu cardápio vazio → incluir, editar e remover → pacote", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginE2E(page.request, 25);
  await page.goto("/parceiro/salao");
  for (;;) {
    const ids = await storeIds(page, "teste");
    if (!ids.length) break;
    for (const id of ids) await page.request.delete("/api/parceiro/restaurantes", { data: { restaurantId: id } });
    await page.reload();
  }
  await page.getByRole("button", { name: /Cadastrar (meu|outro) restaurante/ }).click();
  await expect(page.getByRole("heading", { name: "Cardápio do salão" })).toBeVisible();
  await page.getByRole("link", { name: "Digitar o cardápio" }).click();

  await expect(page).toHaveURL(/\/ativar\/2\?manual=1$/);
  await expect(page.getByRole("heading", { name: "Seu salão" })).toBeVisible();
  await page.getByLabel("Nome do restaurante").fill("Cantina Digitada");
  await page.getByLabel("Número de mesas").fill("12");
  await page.getByRole("group", { name: "Dias do horário vazio 1" }).getByRole("button", { name: "terça" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page).toHaveURL(/\/ativar\/3\?manual=1$/);
  await expect(page.getByRole("heading", { name: "Seu cardápio" })).toBeVisible();
  await expect(page.getByText("Digite os itens")).toBeVisible();
  for (const [i, nome, cat, preco] of [
    [1, "Cannoli", "sobremesa", "22,00"],
    [2, "Panna cotta", "sobremesa", "18,00"],
    [3, "Item errado", "prato", "1,00"],
    [4, "Lasanha", "prato", "52,00"],
  ] as const) {
    await page.getByRole("button", { name: "+ Adicionar item" }).click();
    await page.getByLabel(`Nome do item ${i}`, { exact: true }).fill(nome);
    await pickOption(page, `Categoria de ${nome}`, { sobremesa: "Sobremesa", prato: "Prato" }[cat]);
    await page.getByLabel(`Preço de ${nome}`).fill(preco);
  }
  await page.getByLabel("Nome do item 4", { exact: true }).fill("Lasanha da casa");
  await page.getByRole("button", { name: "Remover Item errado" }).click();
  await expect(page.getByLabel("Nome do item 3", { exact: true })).toHaveValue("Lasanha da casa");
  // O ponteiro ficou sobre o botão da linha que subiu (estado de hover não é o da tela em repouso).
  await page.mouse.move(0, 0);
  await axe(page);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Pacote proposto" })).toBeVisible({ timeout: 60_000 });
});
