import { expect, test } from "@playwright/test";
import { axe, loginCustomer } from "./helpers";

const E2E = "e2e-salao-teste";

/**
 * D250 (sem flag): Jornada › engrenagem › "Seus dados": o cliente corrige nome e telefone; erro de formato aparece no
 * campo; salvo, persiste depois de recarregar. Telefone fictício (DDD 00).
 */
test("cliente: Seus dados na Jornada (nome e telefone, validação no campo, persiste)", async ({ page }) => {
  const email = await loginCustomer(page.request, `/api/r/${E2E}`, "Dados Automáticos");
  await page.goto("/app/jornada");
  await page.getByRole("button", { name: "Configurações da conta" }).click();
  await page.getByRole("button", { name: "Seus dados" }).click();
  const sheet = page.getByRole("dialog", { name: "Seus dados" });
  await expect(sheet.getByLabel("Nome")).toHaveValue("Dados Automáticos");
  await expect(sheet.getByText(email)).toBeVisible();
  await sheet.getByLabel("Telefone (opcional)").fill("0012");
  await sheet.getByRole("button", { name: "Salvar" }).click();
  await expect(sheet.getByText("Use o formato (11) 91234-5678, com DDD.")).toBeVisible();
  await sheet.getByLabel("Telefone (opcional)").fill("00912341420");
  await expect(sheet.getByLabel("Telefone (opcional)")).toHaveValue("(00) 91234-1420");
  await sheet.getByLabel("Nome").fill("Dados Corrigidos");
  await sheet.getByRole("button", { name: "Salvar" }).click();
  await expect(sheet.getByText("Dados salvos ✓")).toBeVisible();
  await axe(page);
  await page.reload();
  await page.getByRole("button", { name: "Configurações da conta" }).click();
  await page.getByRole("button", { name: "Seus dados" }).click();
  const again = page.getByRole("dialog", { name: "Seus dados" });
  await expect(again.getByLabel("Nome")).toHaveValue("Dados Corrigidos");
  await expect(again.getByLabel("Telefone (opcional)")).toHaveValue("(00) 91234-1420");
});
