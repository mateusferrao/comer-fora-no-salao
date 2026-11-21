import { expect, test } from "@playwright/test";
import { axe, loginCustomer, loginE2E, PROD, S5_ON } from "./helpers";

/**
 * S6.2 com a flag `modo_garcom` (passada `flags-on`): Validar código › "Link do garçom" → link + QR (uma vez) →
 * outro aparelho, sem login, abre o link → só "Validar código" → valida um código real → o dono revoga → o link
 * para na hora. Conta própria (e2e-dono+22).
 */
test.skip(PROD && !S5_ON, "em produção, só depois de ligar as flags (E2E_FLAGS=on)");

test("link do garçom: criar → validar sem login → revogar corta na hora", async ({ page }) => {
  test.setTimeout(120_000);
  await loginE2E(page.request, 22);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 60_000 });
  await page.goto("/parceiro/salao/kit");
  const href = await page.getByRole("link", { name: "Abrir este QR" }).first().getAttribute("href");
  const slug = /\/r\/([^/?#]+)/.exec(href ?? "")![1]!;

  // Um código real de 1ª visita na loja do dono.
  const cctx = await page.context().browser()!.newContext();
  await loginCustomer(cctx.request, `/api/r/${slug}`, "Gabi Garçom");
  const ck = await cctx.request.post(`/api/r/${slug}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } });
  const code = ((await ck.json()) as { codes: Array<{ code: string; type: string }> }).codes.find((c) => c.type === "primeira_visita")!.code;
  await cctx.close();

  await page.goto("/parceiro/salao/validar");
  const card = page.getByTestId("link-garcom");
  await card.getByRole("button", { name: /^Criar link/ }).click();
  await expect(card.getByRole("img", { name: "QR do link do garçom" })).toBeVisible();
  const url = (await card.getByTestId("link-garcom-url").textContent())!.trim();
  expect(url).toMatch(/\/garcom\/gc_/);
  await axe(page);

  const wctx = await page.context().browser()!.newContext();
  const w = await wctx.newPage();
  await w.goto(new URL(url).pathname);
  await expect(w).toHaveURL(/\/garcom$/);
  await expect(w.getByRole("heading", { name: /^Validar código · / })).toBeVisible();
  await expect(w.getByRole("navigation", { name: "Menu principal" })).toHaveCount(0);
  await w.getByLabel("Código do cliente").fill(code);
  await w.getByRole("button", { name: "Consultar" }).click();
  const found = w.getByRole("region", { name: "Código encontrado" });
  await expect(found).toContainText("Gabi G.");
  await expect(found).not.toContainText("••");
  await axe(w);
  await found.getByRole("button", { name: "Confirmar" }).click();
  await expect(w.getByText(/Código validado ✓ às \d{2}:\d{2}/)).toBeVisible();

  page.on("dialog", (d) => void d.accept());
  await card.getByRole("button", { name: "Revogar" }).click();
  await expect(card.getByText("Link revogado.")).toBeVisible();
  await w.reload();
  await expect(w.getByText("Este link do garçom não vale mais. Peça um novo ao responsável.")).toBeVisible();
  await wctx.close();
});
