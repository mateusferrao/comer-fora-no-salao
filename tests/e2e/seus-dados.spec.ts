import { expect, test } from "@playwright/test";
import { axe, e2eCustomerEmail, e2eToken, loginCustomer } from "./helpers";

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

/**
 * D257: "Entrar com e-mail" na Jornada — quem já é cliente entra sem check-in (código por e-mail) e chega a "Seus
 * dados". E-mail sem cadastro de cliente não entra. Código lido da resposta com o token de E2E (padrão D123).
 */
test("cliente: Entrar com e-mail na Jornada, sem check-in, e Seus dados", async ({ page, browser }) => {
  const api = await browser.newContext();
  const email = await loginCustomer(api.request, `/api/r/${E2E}`, "Cliente Jornada");
  await api.close();
  await page.route("**/api/cliente/entrar", (route) => route.continue({ headers: { ...route.request().headers(), "x-e2e-token": e2eToken() } }));
  await page.goto("/app/jornada");
  await expect(page.getByRole("heading", { name: "Olá, Visitante" })).toBeVisible();
  await page.getByRole("button", { name: "Entrar com e-mail" }).click();
  const sheet = page.getByRole("dialog", { name: "Entrar com e-mail" });
  await sheet.getByLabel("E-mail").fill(email);
  const sent = page.waitForResponse((r) => r.url().endsWith("/api/cliente/entrar") && r.request().method() === "POST");
  await sheet.getByRole("button", { name: "Enviar código" }).click();
  const { codigo } = (await (await sent).json()) as { codigo: string };
  const code = page.getByRole("dialog", { name: "Digite o código" });
  await code.getByLabel("Código").fill(codigo);
  await code.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Cliente" })).toBeVisible();
  // Depois do reload, o clique só vale com a página interativa (em produção, a hidratação demora mais).
  await expect(async () => {
    await page.getByRole("button", { name: "Configurações da conta" }).click();
    await expect(page.getByRole("dialog", { name: "Sua conta" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("button", { name: "Seus dados" }).click();
  await expect(page.getByRole("dialog", { name: "Seus dados" }).getByLabel("Nome")).toHaveValue("Cliente Jornada");
  await axe(page);
});

test("cliente: e-mail sem cadastro não entra pela Jornada", async ({ page }) => {
  await page.route("**/api/cliente/entrar", (route) => route.continue({ headers: { ...route.request().headers(), "x-e2e-token": e2eToken() } }));
  await page.goto("/app/jornada");
  await page.getByRole("button", { name: "Entrar com e-mail" }).click();
  const sheet = page.getByRole("dialog", { name: "Entrar com e-mail" });
  await sheet.getByLabel("E-mail").fill(e2eCustomerEmail());
  const sent = page.waitForResponse((r) => r.url().endsWith("/api/cliente/entrar") && r.request().method() === "POST");
  await sheet.getByRole("button", { name: "Enviar código" }).click();
  const { codigo } = (await (await sent).json()) as { codigo: string };
  const code = page.getByRole("dialog", { name: "Digite o código" });
  await code.getByLabel("Código").fill(codigo);
  await code.getByRole("button", { name: "Entrar" }).click();
  await expect(code.getByText("Ainda não há cadastro de cliente com este e-mail. Faça o check-in num restaurante para se cadastrar.")).toBeVisible();
});
