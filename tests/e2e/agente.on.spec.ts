import { expect, test } from "@playwright/test";
import { axe, loginE2E, PROD, S5_ON } from "./helpers";

/**
 * D246 com a flag `mcp` (passada `flags-on`): o card "Conectar um assistente de IA" ensina passo a passo; o token
 * gerado no passo 1, usado como o passo 3 manda (Authorization: Bearer), lista as ferramentas do servidor; revogar
 * (passo 5) corta na hora. Conta própria (e2e-dono+34).
 */
test.skip(PROD && !S5_ON, "em produção, só depois de ligar as flags (E2E_FLAGS=on)");

test("agente (MCP): passo a passo → token funciona no endereço → revogar corta", async ({ page }) => {
  test.setTimeout(180_000);
  await loginE2E(page.request, 34);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 120_000 });
  await page.goto("/parceiro/salao/configuracoes");
  // D247: aba própria "Integrações".
  await page.getByRole("tab", { name: "Integrações" }).click();
  const card = page.getByRole("region", { name: "Conectar um assistente de IA (MCP)" });
  await expect(card).toBeVisible();
  const steps = card.getByRole("list", { name: "Como conectar, passo a passo" });
  for (const t of ["Gere a sua chave de acesso (token)", "Copie o endereço do seu restaurante", "Cole os dois no seu assistente", "Teste", "Para cortar o acesso"]) {
    await expect(steps.getByRole("heading", { name: t, exact: true })).toBeVisible();
  }
  const endpoint = (await card.locator("code").filter({ hasText: /\/api\/mcp$/ }).first().textContent())!.trim();
  expect(endpoint).toMatch(/^https?:\/\/.+\/api\/mcp$/);

  await card.getByRole("button", { name: /^Gerar (novo )?token$/ }).click();
  const conf = page.getByRole("alertdialog");
  if (await conf.isVisible({ timeout: 1_000 }).catch(() => false)) await conf.getByRole("button", { name: "Gerar novo token" }).click();
  const box = card.getByTestId("token-agente");
  await expect(box).toBeVisible();
  const token = (await box.locator("code").textContent())!.trim();
  expect(token.length).toBeGreaterThan(20);
  await card.getByText("Exemplo pronto: Claude Code (no terminal)").click();
  await expect(card.getByText(`--header "Authorization: Bearer ${token}"`)).toBeVisible();
  await axe(page);

  // O que o passo 3 manda fazer, feito por um cliente MCP: o token abre as ferramentas.
  const list = { jsonrpc: "2.0", id: 1, method: "tools/list" };
  const ok = await page.request.post("/api/mcp", { data: list, headers: { authorization: `Bearer ${token}` } });
  expect(ok.status()).toBe(200);
  expect(JSON.stringify(await ok.json())).toContain("ver_plano");

  await card.getByRole("button", { name: "Revogar token" }).click();
  await page.getByRole("alertdialog", { name: "Revogar o token?" }).getByRole("button", { name: "Revogar" }).click();
  await expect(card.getByText("Token revogado: o assistente não tem mais acesso.")).toBeVisible();
  const cut = await page.request.post("/api/mcp", { data: list, headers: { authorization: `Bearer ${token}` } });
  expect(cut.status()).toBe(401);
});
