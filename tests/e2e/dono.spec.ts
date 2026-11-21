import { expect, test } from "@playwright/test";
import { axe, BARRA, loginE2E, PROD, loginCustomer, pickOption, storeIds } from "./helpers";

/**
 * Fluxo do dono (planejamento S2 §7). Serial: as contas de teste são compartilhadas entre os testes do arquivo.
 * Local/CI: e-mail em memória. Produção: o envio pela interface vai ao simulador do SES (não entrega a ninguém).
 */
test.describe.configure({ mode: "serial" });

for (const width of [390, 1280]) {
  test(`login (portal/01) em ${width} px: campo vazio, código errado e acessibilidade`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/parceiro/entrar");
    await expect(page.getByTestId("prototype-bar")).toHaveText(BARRA);
    await expect(page.getByRole("heading", { name: "Portal do Parceiro" })).toBeVisible();
    await expect(page.getByText("Gerencie sua loja de forma fácil e rápida")).toBeVisible();
    await axe(page);
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(page.getByText("Preencha os campos destacados para prosseguir.")).toBeVisible();
    await page.getByLabel("E-mail").fill("nao-e-email");
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(page.getByText("Use um e-mail válido.")).toBeVisible();
    // Simulador do SES: aceita e não entrega (prova o envio em produção).
    await page.getByLabel("E-mail").fill("success@simulator.amazonses.com");
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(page.getByText("Digite o código de 6 dígitos que enviamos para success@simulator.amazonses.com.")).toBeVisible();
    await page.getByLabel("Código").fill("000000");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(/Código incorreto\. Restam \d tentativas?\.|Código incorreto\. Peça outro código\./)).toBeVisible();
    await axe(page);
  });
}

test("sem sessão, o Portal manda para o login", async ({ page }) => {
  await page.goto("/parceiro/salao");
  await expect(page).toHaveURL(/\/parceiro\/entrar$/);
});

test("conta nova ganha a própria vitrine (60 dias): check-in de cliente nela e validação no Portal", async ({ page }) => {
  test.setTimeout(90_000);
  await loginE2E(page.request, 1);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText("Restaurante de exemplo · histórico gerado")).toBeVisible();
  const href = (await page.getByRole("link", { name: "Ver minha página" }).getAttribute("href"))!;
  expect(href).toMatch(/^\/r\/cantina-nonna-lucia-[a-z2-9]{6}$/);
  const ctx = await page.context().browser()!.newContext();
  await loginCustomer(ctx.request, `/api${href}`, "Dani Teste");
  const ck = await ctx.request.post(`/api${href}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } });
  const code = ((await ck.json()) as { codes: Array<{ code: string; type: string }> }).codes.find((c) => c.type === "primeira_visita")!.code;
  await ctx.close();
  await page.goto("/parceiro/salao/validar");
  await page.getByLabel("Código do cliente").fill(code);
  await page.getByRole("button", { name: "Consultar" }).click();
  await expect(page.getByRole("region", { name: "Código encontrado" })).toContainText("Dani Teste");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText(/Código validado ✓/)).toBeVisible();
});

test("isolamento: a conta 2 não abre nem valida nada da conta 1", async ({ page, browser }) => {
  await loginE2E(page.request, 1);
  await page.goto("/parceiro/salao/kit");
  const kit1 = await page.evaluate(async () => (await (await fetch("/api/parceiro/kit")).json()) as { slug: string; pieces: Array<{ id: string; variants: Array<{ id: string }> }> });
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await loginE2E(p2.request, 2);
  const variantId = kit1.pieces[0]!.variants[0]!.id;
  const res = await p2.goto(`/parceiro/imprimir/${variantId}`);
  expect(res!.status()).toBe(404);
  const ap = await p2.request.post("/api/parceiro/kit/peca", { data: { pieceId: kit1.pieces[0]!.id, acao: "aprovar" } });
  expect([404, 409]).toContain(ap.status());
  await ctx2.close();
});

test("conta entra, vê a Visão geral com 'Cadastre o seu restaurante' e sai", async ({ page }) => {
  await loginE2E(page.request, 1);
  await page.goto("/parceiro/salao");
  await expect(page.getByRole("heading", { name: "Visão geral", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cadastre o seu restaurante" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Visão geral" }).first()).toHaveAttribute("aria-current", "page");
  await axe(page);
  await page.getByRole("button", { name: "Sair" }).first().click();
  await expect(page).toHaveURL(/\/parceiro\/entrar$/);
});

test("link do avaliador inválido não abre conta", async ({ page }) => {
  await page.goto("/parceiro/acesso/token-invalido-qualquer");
  await expect(page.getByRole("heading", { name: "Acesso de avaliação" })).toBeVisible();
  await page.getByRole("button", { name: "Entrar no Portal" }).click();
  await expect(page.getByText("Este link de acesso não é válido.")).toBeVisible();
  await axe(page);
});

test.describe("link válido", () => {
  test.skip(PROD, "o link válido só é testado localmente (não gasta o link real)");
  test("link do avaliador válido (local) abre conta própria", async ({ page }) => {
    await page.goto("/parceiro/acesso/avaliador-link-ficticio-local-0001");
    await page.getByRole("button", { name: "Entrar no Portal" }).click();
    await expect(page).toHaveURL(/\/parceiro\/salao$/);
    await expect(page.getByText("acesso por link").first()).toBeVisible();
  });
});

test("assistente completo com exemplo: salão pré-preenchido → revisão → pacote → ativar", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginE2E(page.request, 3);
  // Começa limpo: apaga restaurantes de teste antigos desta conta de E2E.
  await page.goto("/parceiro/salao");
  for (;;) {
    const ids = await storeIds(page);
    if (!ids.length) break;
    for (const id of ids) await page.request.delete("/api/parceiro/restaurantes", { data: { restaurantId: id } });
    await page.reload();
  }
  await page.getByRole("button", { name: /Cadastrar (meu|outro) restaurante/ }).click();
  await expect(page).toHaveURL(/\/parceiro\/salao\/ativar$|\/ativar\/1$/);
  await expect(page.getByRole("heading", { name: "Cardápio do salão" })).toBeVisible();
  await axe(page);
  await page.getByRole("listitem").filter({ hasText: "Boteco do Seu Zé" }).getByRole("button", { name: "Usar este exemplo" }).click();

  await expect(page.getByRole("heading", { name: "Seu salão" })).toBeVisible();
  await expect(page.getByLabel("Nome do restaurante")).toHaveValue("Boteco do Seu Zé");
  await expect(page.getByText("21 itens encontrados")).toBeVisible();
  await axe(page);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Revisão do cardápio" })).toBeVisible();
  await expect(page.getByLabel("Nome do item 1", { exact: true })).toHaveValue("Bolinho de bacalhau");
  await axe(page);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Pacote proposto" })).toBeVisible();
  await expect(page.getByText(PROD ? /Escolhido pela IA|Sugestão automática \(sem IA\)/ : "Sugestão automática (sem IA)")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /Convite de volta · / })).toHaveCount(2);
  await axe(page);
  await page.getByRole("button", { name: "Ver outras opções" }).first().click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();
  await axe(page);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await page.getByLabel("Teto de convites por semana").first().fill("10");
  await expect(page.getByText(/até 10 convites\/semana ≈ 3 mesas/)).toBeVisible();
  await page.getByRole("button", { name: "Revisar e ativar" }).click();

  await expect(page.getByRole("heading", { name: "Resumo e ativar" })).toBeVisible();
  await expect(page.getByRole("region", { name: /Prévia do convite · / }).first().getByTestId("invite-message")).toBeVisible();
  await axe(page);
  await page.getByRole("button", { name: "Ativar Comer Fora no salão" }).click();
  await expect(page.getByRole("heading", { name: "Comer Fora no salão ativo!" })).toBeVisible();
  const slug = (await page.getByRole("link", { name: "Ver minha página" }).getAttribute("href"))!.replace("/r/", "");

  // Kit: gerado depois da ativação (sem IA no CI/local), aprovar, "no salão", impressão com QR.
  await page.getByRole("link", { name: "Ver meu kit" }).click();
  await expect(page.getByRole("heading", { name: "Display de mesa (meia A4)" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(PROD ? /Escrito pela IA|Texto modelo \(sem IA\)/ : "Texto modelo (sem IA)")).toBeVisible();
  await axe(page);
  const display = page.getByRole("region", { name: "Display de mesa (meia A4)" });
  await display.getByRole("button", { name: "Aprovar peça" }).click();
  await display.getByRole("switch", { name: "Está no salão" }).click();
  await expect(display.getByText("No salão")).toBeVisible();
  const qrHref = await display.getByRole("link", { name: "Abrir este QR" }).first().getAttribute("href");
  expect(qrHref).toMatch(new RegExp(`^/r/${slug}\\?p=`));
  await display.getByRole("link", { name: "Imprimir versão A" }).click();
  await expect(page.getByRole("img", { name: "QR da versão A" })).toBeVisible();
  await expect(page.getByTestId("prototype-bar")).toBeVisible();

  // Cliente pelo QR: clientes novos até cair convidável; o 2º card traz o recado aprovado (D122).
  let code = "";
  for (let i = 0; i < 40 && !code; i++) {
    const ctx = await page.context().browser()!.newContext();
    const req = ctx.request;
    await loginCustomer(req, `/api/r/${slug}`, "Bia Teste");
    const ck = await req.post(`/api/r/${slug}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } });
    const j = (await ck.json()) as { invite: { message: string | null } | null; codes: Array<{ code: string; type: string }> };
    if (j.invite) {
      expect(j.invite.message).toMatch(/aproveite|.+/);
      code = j.codes.find((c) => c.type === "primeira_visita")!.code;
    }
    await ctx.close();
  }
  expect(code).not.toBe("");

  // Garçom valida no Portal.
  await page.goto("/parceiro/salao/validar");
  await page.getByLabel("Código do cliente").fill(code);
  await page.getByRole("button", { name: "Consultar" }).click();
  const found = page.getByRole("region", { name: "Código encontrado" });
  await expect(found).toContainText("1ª visita");
  await expect(found).toContainText("Bia Teste");
  await axe(page);
  await found.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText(/Código validado ✓ às \d{2}:\d{2}/)).toBeVisible();
  await page.getByRole("button", { name: "Validar outro código" }).click();
  await page.getByLabel("Código do cliente").fill(code);
  await page.getByRole("button", { name: "Consultar" }).click();
  await expect(page.getByText(/Este código já foi usado às/)).toBeVisible();
  await page.getByRole("button", { name: "Validar outro código" }).click();
  await page.getByLabel("Código do cliente").fill("ZZZZZZ");
  await page.getByRole("button", { name: "Consultar" }).click();
  await expect(page.getByText("Código não encontrado. Confira as letras e números com o cliente.")).toBeVisible();
});

test("Configurações: trocar a oferta do convite → o próximo cliente convidável recebe a nova (versão nova)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginE2E(page.request, 3); // a mesma conta do teste anterior (restaurante já ativo)
  await page.goto("/parceiro/salao/configuracoes");
  await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();
  await axe(page);
  await page.getByRole("tab", { name: "Horários vazios e convites" }).click();
  const first = page.getByRole("region", { name: /^Horário vazio / }).first();
  await pickOption(first, "Tipo", "Leve 2, pague 1");
  const chosen = await pickOption(first, "Item do cardápio", { index: 1 });
  await first.getByRole("button", { name: "Salvar convite" }).click();
  await expect(first.getByText("Salvo · nova versão em vigor")).toBeVisible();
  await axe(page);

  const slug = await page.evaluate(async () => (await (await fetch("/api/parceiro/kit")).json()).slug as string);
  let gain = "";
  for (let i = 0; i < 40 && !gain; i++) {
    const ctx = await page.context().browser()!.newContext();
    await loginCustomer(ctx.request, `/api/r/${slug}`, "Caio Teste");
    const ck = await ctx.request.post(`/api/r/${slug}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } });
    const j = (await ck.json()) as { invite: { offer: { gain: string } | null; startMin: number } | null };
    if (j.invite?.offer?.gain.startsWith("Leve 2, pague 1")) gain = j.invite.offer.gain;
    await ctx.close();
  }
  expect(gain).toBe(`Leve 2, pague 1 em ${chosen}`);
});

test("restaurante cadastrado: Primeiros passos no lugar do roteiro de teste; nada de 'Simular'", async ({ page }) => {
  test.setTimeout(90_000);
  await loginE2E(page.request, 3); // a mesma conta do assistente (restaurante cadastrado e ativo)
  await page.goto("/parceiro/salao");
  await expect(page.getByRole("heading", { name: "Primeiros passos" })).toBeVisible();
  await expect(page.getByText("1º cliente voltou com convite")).toBeVisible();
  await expect(page.getByRole("button", { name: /Simular/ })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/simulad|de teste|demonstração/i);
  await axe(page);
});
