import { expect, test } from "@playwright/test";
import { axe, confirmIfAsked, loginE2E, PROD, S5_ON } from "./helpers";

/**
 * S5.3 com a flag `explica_ia` (passada `flags-on`; em produção só com E2E_FLAGS=on): "Por que esta oferta?" no plano
 * da semana — plano pronto do exemplo declarado como tal; depois de gerar, as opções do código e "Como a IA decidiu".
 * Local sem chave de IA: o plano gerado cai no modo sem IA (declarado). Conta própria (e2e-dono+12).
 */
test.skip(PROD && !S5_ON, "em produção, só depois de ligar as flags (E2E_FLAGS=on)");

test("plano da semana: 'Por que esta oferta?' abre o painel com opções, fatos, regras e a camada técnica", async ({ page }) => {
  test.setTimeout(120_000);
  await loginE2E(page.request, 12);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 60_000 });
  await page.goto("/parceiro/salao/plano");
  await expect(page.getByRole("heading", { name: "Plano da semana", level: 1 })).toBeVisible();
  if ((await page.getByTestId("plan-origin").getAttribute("data-origin")) === "fixo") {
    await page.getByRole("button", { name: "Por que esta oferta?" }).first().click();
    const panel = page.getByRole("dialog", { name: "Por que esta oferta?" });
    await expect(panel.getByTestId("por-que")).toContainText("Plano escrito antes para o restaurante de exemplo, sem IA.");
    await panel.getByRole("button", { name: "Fechar" }).click();
  }
  if ((await page.getByTestId("plan-status").getAttribute("data-status")) === "proposto") {
    await page.getByRole("button", { name: "Descartar" }).click();
    await page.getByLabel("Teto alto demais").check();
    await page.getByRole("button", { name: "Confirmar descarte" }).click();
    await expect(page.getByText("Plano descartado.")).toBeVisible();
  }
  await page.getByRole("button", { name: "Gerar plano da semana" }).click();
  await confirmIfAsked(page);
  await expect(page.getByTestId("plan-status")).toHaveAttribute(
    "data-status",
    "proposto",
    { timeout: 60_000 },
  );
  await page
    .getByRole("button", { name: "Por que esta oferta?" })
    .first()
    .click();
  const panel = page.getByRole("dialog", { name: "Por que esta oferta?" });
  await expect(panel.getByRole("heading", { name: /O código separou \d+ opç(ão|ões) para esta faixa/ })).toBeVisible();
  await expect(panel.getByText("Nota do código: quanto menor o custo perto do ticket médio, maior a nota.")).toBeVisible();
  await expect(panel.getByRole("heading", { name: /^(A IA escolheu .+|Escolhida pela maior nota do código)$/ })).toBeVisible();
  await panel.getByText("Como a IA decidiu").click();
  await expect(panel.getByText(/Sem chamada de IA registrada para esta oferta\.|Modelo: .+/)).toBeVisible();
  await axe(page);
  await panel.getByRole("button", { name: "Fechar" }).click();
  await expect(panel).toBeHidden();
});
