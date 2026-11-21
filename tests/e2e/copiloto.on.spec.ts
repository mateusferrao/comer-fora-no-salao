import { expect, test } from "@playwright/test";
import { axe, loginE2E, PROD } from "./helpers";

/**
 * S8 — Assistente do salão (D260–D264). Local: IA roteirizada (só com chaves vazias + token local — `fakeAi` no
 * health). Produção: só confere que a IA falsa está desligada; a conversa real é testada na revisão (D09).
 */
test("health: IA falsa do copiloto só no servidor local", async ({ request }) => {
  const h = (await (await request.get("/api/health")).json()) as { fakeAi?: boolean };
  expect(h.fakeAi).toBe(!PROD);
});

test.describe("copiloto (local, IA roteirizada)", () => {
  test.skip(PROD, "em produção a conversa usa IA real: coberta pela E2E da revisão");

  test("chip → cartão com custo do código → Aplicar → oferta gravada e aba de convites", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginE2E(page.request, 41);
    await page.goto("/parceiro/salao");
    await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 120_000 });
    const before = (await (await page.request.get("/api/parceiro/configuracoes")).json()) as { slots: Array<{ offer: { itemId: string } }> };
    await page.goto("/parceiro/salao/configuracoes?aba=convites");
    await page.getByRole("button", { name: "Assistente" }).click();
    const panel = page.getByRole("complementary", { name: "Assistente do salão" });
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: /^Trocar a oferta do convite de / }).click();
    const card = panel.getByRole("article", { name: /^Proposta: Trocar a oferta do convite de / });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByText(/custo máximo de R\$/)).toBeVisible();
    await expect(card.getByText("Convites já emitidos continuam com a oferta antiga.")).toBeVisible();
    await axe(page);
    await card.getByRole("button", { name: /^Aplicar: / }).click();
    await expect(card.getByRole("status")).toContainText("Aplicado");
    await expect(page).toHaveURL(/aba=convites&v=/);
    const after = (await (await page.request.get("/api/parceiro/configuracoes")).json()) as { slots: Array<{ offer: { itemId: string } }> };
    expect(after.slots[0]!.offer.itemId).not.toBe(before.slots[0]!.offer.itemId);
  });

  test("recusa do código (Tiramisù é a recompensa) e Esc fecha devolvendo o foco", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginE2E(page.request, 42);
    await page.goto("/parceiro/salao");
    await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 120_000 });
    await page.getByRole("button", { name: "Assistente" }).click();
    const panel = page.getByRole("complementary", { name: "Assistente do salão" });
    await panel.getByRole("textbox", { name: "Seu pedido" }).fill("acabou o tiramisù");
    await panel.getByRole("button", { name: "Enviar" }).click();
    await expect(panel.getByText("“Tiramisù” é a recompensa da cartela. Troque a recompensa antes de tirar o prato do cardápio.")).toBeVisible({ timeout: 30_000 });
    await panel.getByRole("textbox", { name: "Seu pedido" }).press("Escape");
    await expect(panel).toBeHidden();
    await expect(page.getByRole("button", { name: "Assistente" })).toBeFocused();
  });

  test("celular (390 px): tela cheia, fecha pelo botão", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginE2E(page.request, 43);
    await page.goto("/parceiro/salao");
    await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 120_000 });
    await page.getByRole("button", { name: "Assistente" }).click();
    const dlg = page.getByRole("dialog", { name: "Assistente do salão" });
    await expect(dlg).toBeVisible();
    await dlg.getByRole("button", { name: "Como foi a semana?" }).click();
    await expect(dlg.getByText(/No último mês foram/)).toBeVisible({ timeout: 30_000 });
    await axe(page);
    await dlg.getByRole("button", { name: "Fechar o assistente" }).click();
    await expect(dlg).toBeHidden();
  });
});
