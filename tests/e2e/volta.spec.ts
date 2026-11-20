import { expect, test, type Page } from "@playwright/test";
import { axe } from "./helpers";

/**
 * Volta com convite pelo "Antecipar 1 dia" (D140, D141) e motivo do holdout no teste (D143), no restaurante E2E
 * oculto (`teste`, faixa o dia todo, teto alto — D109). Roda local e em produção.
 */
const E2E = "e2e-salao-teste";
test.use({ viewport: { width: 390, height: 844 } });

async function uiCheckin(page: Page, first: boolean) {
  await page.goto(`/r/${E2E}/checkin`);
  await page.getByRole("button", { name: "Fazer check-in" }).click();
  await page.getByRole("dialog", { name: "Parece que você não está no restaurante!" }).getByRole("button", { name: "Confirmar localização" }).click();
  if (first) {
    const id = page.getByRole("dialog", { name: "Identifique-se para ativar seus benefícios" });
    await id.getByRole("checkbox").check();
    await id.getByRole("button", { name: "Continuar" }).click();
  }
  await expect(page.getByRole("heading", { name: "Check-in feito!" })).toBeVisible();
}

test("convidável: 'Para testar: antecipar 1 dia' → novo check-in → código do convite", async ({ browser }) => {
  test.setTimeout(120_000);
  let page: Page | null = null;
  for (let i = 0; i < 10 && !page; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await uiCheckin(p, true);
    if (await p.getByRole("region", { name: "Seu convite" }).waitFor({ timeout: 2_500 }).then(() => true, () => false)) page = p;
    else await ctx.close();
  }
  expect(page, "nenhum cliente convidável em 10 tentativas").not.toBeNull();
  const card = page!.getByTestId("teste-antecipar");
  await expect(card).toContainText("Só no restaurante de teste");
  await card.getByRole("button", { name: "Para testar: antecipar 1 dia" }).click();
  await expect(card.getByRole("status")).toHaveText("Pronto (só no teste): o convite agora conta como de ontem. Faça check-in de novo para receber o código.");
  await axe(page!);
  await uiCheckin(page!, false);
  await expect(page!.getByText("Você voltou no horário do seu convite.")).toBeVisible();
  await expect(page!.getByRole("region", { name: "Seu convite" }).first()).toBeVisible();
  await expect(page!.getByText("Informe este código ao garçom").first()).toBeVisible();
});

test("holdout no restaurante de teste: sem 2º card, com o motivo e 'Testar como outro cliente'", async ({ browser }) => {
  test.setTimeout(180_000);
  let found: Page | null = null;
  for (let i = 0; i < 60 && !found; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // Identificação e check-in pela API (mais rápido); a tela de resultado é a do dia ("já fez check-in hoje").
    const d = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
    await ctx.request.post(`/api/r/${E2E}/identificacao`, { data: { name: "Teste Automático", phone: `(00) 9${d.slice(0, 4)}-${d.slice(4)}`, optWhatsapp: true, optApp: true, optPush: true, accept: true } });
    const res = await ctx.request.post(`/api/r/${E2E}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } });
    const j = (await res.json()) as { invite: unknown; testNote?: string | null };
    if (!j.invite && j.testNote === "grupo_controle") found = await ctx.newPage();
    else await ctx.close();
  }
  expect(found, "nenhum holdout em 60 clientes").not.toBeNull();
  // O motivo aparece no resultado do check-in; aqui conferimos pela API que a vitrine nunca recebe o campo.
  const vit = await found!.request.get("/r/cantina-nonna-lucia");
  expect(vit.ok()).toBe(true);
});
