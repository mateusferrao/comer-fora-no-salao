import { expect, test } from "@playwright/test";
import { axe, confirmIfAsked, loginE2E, PROD, S5_ON, waitExampleReady } from "./helpers";

/**
 * S6.1 com a flag `resumo_email` (passada `flags-on`): Plano › "Ver o e-mail desta semana" → o link "Revisar e
 * aprovar" da prévia → página de confirmação (GET só mostra) → "Aprovar plano" (POST, via e-mail) → reabrir: "já foi
 * usado". Conta própria (e2e-dono+21), sem e-mail guardado (contas E2E nunca guardam — D187): o fluxo do avaliador.
 */
test.skip(PROD && !S5_ON, "em produção, só depois de ligar as flags (E2E_FLAGS=on)");

test("resumo semanal: prévia com link → página de confirmação → aprovar pelo e-mail → link usado", async ({ page }) => {
  test.setTimeout(120_000);
  await loginE2E(page.request, 21);
  await page.goto("/parceiro/salao");
  await waitExampleReady(page);
  await page.goto("/parceiro/salao/plano");
  if (
    (await page.getByTestId("plan-status").getAttribute("data-status")) !==
    "proposto"
  ) {
    await page.getByRole("button", { name: "Gerar plano da semana" }).click();
    await confirmIfAsked(page);
    await expect(page.getByTestId("plan-status")).toHaveAttribute(
      "data-status",
      "proposto",
      { timeout: 60_000 },
    );
  }
  const card = page.getByTestId("resumo-email");
  await expect(card).toContainText("Esta conta não tem e-mail guardado");
  await expect(card.getByRole("button", { name: "Enviar para meu e-mail agora" })).toHaveCount(0);
  await card.getByRole("button", { name: "Ver o e-mail desta semana" }).click();
  const panel = page.getByRole("dialog", { name: "O e-mail desta semana" });
  // S9: com margem a mais certa, o assunto traz o valor ("… · plano para aprovar").
  await expect(panel.getByTestId("resumo-previa")).toContainText(/para aprovar/);
  await expect(panel.getByTestId("resumo-previa")).toContainText("Revisar e aprovar:");
  await axe(page);
  const href = await panel.getByRole("link", { name: /Abrir “Revisar e aprovar”/ }).getAttribute("href");
  expect(href).toMatch(/\/parceiro\/aprovar\/rv_/);
  const path = new URL(href!).pathname;

  // Outro contexto, sem sessão: como quem abre o e-mail no celular.
  const ctx = await page.context().browser()!.newContext();
  const mail = await ctx.newPage();
  await mail.goto(path);
  await expect(mail.getByRole("heading", { name: /^Plano da semana · / })).toBeVisible();
  await expect(mail.getByText("Situação: Sugerido · esperando sua aprovação")).toBeVisible();
  await axe(mail);
  await mail.getByRole("button", { name: "Aprovar e enviar convites" }).click();
  await expect(mail.getByTestId("aprovado-email")).toContainText("Plano aprovado.");
  await mail.reload();
  await expect(mail.getByText("Este link já foi usado. Veja o plano no Portal.")).toBeVisible();
  await ctx.close();

  await page.goto("/parceiro/salao/plano");
  await expect(page.getByTestId("plan-status")).toHaveAttribute("data-status", "aprovado");
  await expect(page.getByText("Aprovado pelo e-mail")).toBeVisible();
});

test("link inválido → 404", async ({ page }) => {
  const r = await page.goto("/parceiro/aprovar/rv_naoexiste_naoexiste_naoexiste_naoexiste_000");
  expect(r?.status()).toBe(404);
  // S9: o 404 aponta o caminho que resolve.
  await expect(page.getByRole("link", { name: "Abrir o plano no Portal" })).toHaveAttribute("href", "/parceiro/salao/plano");
});
