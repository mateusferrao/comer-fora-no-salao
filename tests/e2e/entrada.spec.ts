import { expect, test } from "@playwright/test";
import path from "node:path";
import { axe, BARRA, loginE2E, PROD, S5_ON, startNewStore, storeIds } from "./helpers";

/** Entrada, páginas públicas, barra, Bastidores e CSP (planejamento S3 §4.6–4.7). */

for (const width of [390, 1280]) {
  test(`"/" em ${width} px: 1 + 1 botões, sem roteiro de teste, barra só com "Como funciona" (≤ 44 px a 390)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const res = await page.goto("/");
    expect(res!.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByTestId("prototype-bar")).toHaveText(BARRA);
    await expect(page.getByRole("heading", { name: "Seu salão cheio divulga seu horário vazio" })).toBeVisible();
    // Com `copy_v2` (S5.2, E2E_FLAGS=on em produção), o CTA da landing é "Ativar meu salão".
    await expect(page.getByRole("link", { name: S5_ON ? "Ativar meu salão" : "Entrar no Portal do Parceiro" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Veja o que seu cliente vê" })).toHaveAttribute("href", "/r/cantina-nonna-lucia");
    await expect(page.getByRole("heading", { name: "Como testar sozinho" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Trocar de lado" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Como funciona" })).toBeVisible();
    const bar = page.getByRole("complementary", { name: "Aviso de protótipo" });
    const box = (await bar.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(width >= 640 ? 28 : 44);
    await axe(page);
  });
}

test("Como funciona, Visão da plataforma e Qualidade da IA são públicas, com barra e noindex", async ({ page }) => {
  for (const [url, h] of [
    ["/bastidores/como-funciona", "Como este protótipo funciona"],
    ["/bastidores/plataforma", "Visão da plataforma"],
    ["/bastidores/qualidade", "Qualidade da IA"],
  ] as const) {
    const res = await page.goto(url);
    expect(res!.status()).toBe(200);
    expect(res!.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByRole("heading", { name: h, level: 1 })).toBeVisible();
    await expect(page.getByTestId("prototype-bar")).toHaveText(BARRA);
    await axe(page);
  }
  await page.goto("/bastidores/como-funciona");
  await expect(page.getByText(/simulação \(baseada em agentes, sem IA\)/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ferramentas do avaliador" })).toBeVisible();
  await expect(page.getByText(/132 de 140 combinações/)).toBeVisible();
});

test("link do avaliador mostra o roteiro curto", async ({ page }) => {
  await page.goto("/parceiro/acesso/qualquer-token");
  await expect(page.getByRole("heading", { name: "Como testar sozinho" })).toBeVisible();
});

test("Bastidores › Configurações pedem senha", async ({ page }) => {
  await page.goto("/bastidores/config");
  await expect(page.getByRole("heading", { name: "Configurações do protótipo", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Senha dos Bastidores")).toBeVisible();
  await page.getByLabel("Senha dos Bastidores").fill("errada-qualquer");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(/Senha incorreta\.|Muitas tentativas/)).toBeVisible();
});

test("rotas dos Bastidores sem o cookie de senha respondem 401 (publicar, voltar, testar, flag, reset, estado)", async ({ page }) => {
  await page.goto("/");
  const statuses = await page.evaluate(async () => {
    const out: Record<string, number> = {};
    for (const acao of ["publicar", "voltar", "testar", "flag", "reset"]) {
      const r = await fetch(`/api/bastidores/${acao}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      out[acao] = r.status;
    }
    out.estado = (await fetch("/api/bastidores/estado")).status;
    return out;
  });
  expect(statuses).toEqual({ publicar: 401, voltar: 401, testar: 401, flag: 401, reset: 401, estado: 401 });
});

test("CSP de produção: o PDF passa pelo pdf.js no navegador sem erro de política", async ({ page }) => {
  test.skip(PROD, "não cria restaurantes de teste em produção a cada deploy só para isto");
  test.setTimeout(90_000);
  const csp: string[] = [];
  page.on("console", (m) => (/Content Security Policy|Refused to/.test(m.text()) ? csp.push(m.text()) : null));
  page.on("pageerror", (e) => csp.push(String(e)));
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginE2E(page.request, 6);
  const res = await page.goto("/parceiro/salao");
  expect(res!.headers()["content-security-policy"]).toContain("worker-src 'self' blob:");
  // Começa limpo: apaga os restaurantes cadastrados antigos desta conta (limite de 3); a cópia do exemplo fica.
  for (;;) {
    const ids = await storeIds(page);
    if (!ids.length) break;
    for (const id of ids) expect((await page.request.delete("/api/parceiro/restaurantes", { data: { restaurantId: id } })).ok()).toBe(true);
    await page.reload();
  }
  await startNewStore(page);
  await expect(page.getByRole("heading", { name: "Cardápio do salão" })).toBeVisible();
  await page.locator("#arquivo-cardapio").setInputFiles(path.join(process.cwd(), "public/exemplos/sushi.pdf"));
  await expect(page.getByRole("heading", { name: "Seu salão" })).toBeVisible({ timeout: 30_000 });
  expect(csp).toEqual([]);
});

test("Bastidores com senha (local): publicar o tom do kit, ver a versão em uso, voltar ao original e ligar uma flag", async ({ page }) => {
  test.skip(PROD, "a senha de produção não fica no GitHub (D139); em produção só conferimos que ela é pedida");
  await page.goto("/bastidores/config");
  await page.getByLabel("Senha dos Bastidores").fill("bastidores-senha-ficticia-local");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Prompts (bloco de instruções e tom)" })).toBeVisible();
  await page.getByRole("tab", { name: "Chamadas do kit" }).click();
  await page.getByLabel(/Instruções da tarefa/).fill("Você escreve chamadas curtas e bem-humoradas para o salão, como um garçom simpático. Português do Brasil.");
  await page.getByRole("button", { name: "Testar com exemplo" }).click();
  await expect(page.getByTestId("teste-prompt")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Publicado: a próxima chamada desta tarefa já usa este texto.")).toBeVisible();
  await page.getByText(/Versões \(/).click();
  await expect(page.getByText(/· em uso/).first()).toBeVisible();
  await page.getByRole("button", { name: "Voltar a esta versão" }).last().click();
  await expect(page.getByText("Pronto: voltou para esta versão.")).toBeVisible();
  const flag = page.getByLabel(/Insight de operação/);
  const was = await flag.isChecked();
  await flag.setChecked(!was);
  await expect(page.getByText(new RegExp(`Insight de operação.*: ${was ? "desligado" : "ligado"}\\.`))).toBeVisible();
  await flag.setChecked(was);
  await axe(page);
});

test("'/trocar-lado' não existe mais (D156)", async ({ page }) => {
  const res = await page.goto("/trocar-lado?de=app");
  expect(res!.status()).toBe(404);
});
