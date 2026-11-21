import { expect, test } from "@playwright/test";
import { axe, loginCustomer } from "./helpers";

const E2E = "e2e-salao-teste";

/**
 * S6.1 (D198, sem flag): Jornada › engrenagem › "Gerenciar notificações": E-mail (mestre) com Convites e Lembretes e
 * "Convites de volta no app"; grava a cada toque e persiste. Mestre desligado desabilita os tipos.
 */
test("cliente: gerenciar notificações na Jornada (por tipo, persiste; mestre desabilita os tipos)", async ({ page }) => {
  await loginCustomer(page.request, `/api/r/${E2E}`, "Preferências Automáticas");
  await page.goto("/app/jornada");
  await page.getByRole("button", { name: "Configurações da conta" }).click();
  await page.getByRole("button", { name: "Gerenciar notificações" }).click();
  const box = page.getByTestId("preferencias").getByRole("region").first();
  const lembretes = box.getByRole("switch", { name: "Lembretes" });
  await expect(lembretes).toHaveAttribute("aria-checked", "true");
  await lembretes.click();
  await expect(box.getByText("Preferências salvas")).toBeVisible();
  await axe(page);
  await page.reload();
  await page.getByRole("button", { name: "Configurações da conta" }).click();
  await page.getByRole("button", { name: "Gerenciar notificações" }).click();
  const box2 = page.getByTestId("preferencias").getByRole("region").first();
  await expect(box2.getByRole("switch", { name: "Lembretes" })).toHaveAttribute("aria-checked", "false");
  await box2.getByRole("switch", { name: "E-mail", exact: true }).click();
  await expect(box2.getByRole("switch", { name: "Convites", exact: true })).toBeDisabled();
  await expect(box2.getByRole("switch", { name: "Convites de volta no app" })).toBeEnabled();
});
