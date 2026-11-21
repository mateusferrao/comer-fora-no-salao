import { expect, test } from "@playwright/test";
import { axe, loginE2E, loginCustomer } from "./helpers";

/** Visão geral e Clientes na cópia da vitrine (planejamento S3 §4.2, §4.5). Conta própria (e2e-dono+4). */
test.describe.configure({ mode: "serial" });

async function openCopy(page: import("@playwright/test").Page) {
  await loginE2E(page.request, 4);
  await page.goto("/parceiro/salao");
  await expect(page.getByText(/Preparando o restaurante de exemplo/)).toBeHidden({ timeout: 60_000 });
  await page.reload();
}

for (const width of [1280, 390]) {
  test(`Visão geral da cópia em ${width} px: métrica contra o grupo de controle, selo do exemplo, funil e indicadores`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await openCopy(page);
    await expect(page.getByRole("heading", { name: "Visão geral", level: 1 })).toBeVisible();
    await expect(page.getByText("Restaurante de exemplo · histórico gerado")).toBeVisible();
    await expect(page.getByTestId("metric-state")).toHaveAttribute("data-state", "positivo");
    await expect(page.getByText(/provavelmente entre \+/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comparado ao grupo de controle" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Indicadores antecipados/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Últ. 7 dias" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Últ. 30 dias" }).click();
    await expect(page.getByRole("radio", { name: "Últ. 30 dias" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("funil-checkins")).not.toHaveText("0");
    await axe(page);
  });
}

test("check-in feito em outra aba aparece no funil em até 5 s", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await openCopy(page);
  const switched = page.waitForResponse((r) => r.url().includes("periodo=hoje") && r.ok());
  await page.getByRole("radio", { name: "Hoje" }).click();
  await switched;
  await page.waitForTimeout(300);
  const count = async () => Number(/^[\d.]+/.exec((await page.getByTestId("funil-checkins").innerText()).trim())![0].replace(/\./g, ""));
  await expect(page.getByTestId("funil-checkins")).toBeVisible();
  const before = await count();
  const href = (await page.getByRole("link", { name: "Ver minha página" }).getAttribute("href"))!;
  const ctx = await browser.newContext();
  await loginCustomer(ctx.request, `/api${href}`, "Lia Teste");
  const ck = await ctx.request.post(`/api${href}/checkin`, { data: { gpsStatus: "negado", idempotencyKey: crypto.randomUUID() } });
  expect(ck.ok()).toBe(true);
  await ctx.close();
  await expect.poll(count, { timeout: 5_000 }).toBe(before + 1);
});

test("Clientes: 4 segmentos, contato completo (fictício no exemplo, D237) e aviso de que a base é do restaurante", async ({ page }) => {
  await openCopy(page);
  await page.getByRole("link", { name: "Clientes" }).first().click();
  await expect(page.getByRole("heading", { name: "Clientes", level: 1 })).toBeVisible();
  await expect(page.getByText("Esta base é do seu restaurante.")).toBeVisible();
  for (const s of ["sumiu", "perto", "convite_ativo", "frequente"]) await expect(page.getByTestId(`seg-${s}`)).toBeVisible();
  await expect(page.getByRole("cell", { name: /^\(00\) 9\d{4}-\d{4}$/ }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: /@exemplo\.invalid$/ }).first()).toBeVisible();
  await page.getByRole("link", { name: /Frequentes/ }).click();
  await expect(page.getByText(/Não recebem reativação/)).toBeVisible();
  await axe(page);
});

test("plano da semana: exemplo pronto → gerar (sem IA local / IA em produção) → aprovar → reativação entregue; descartar", async ({ page }) => {
  test.setTimeout(120_000);
  await openCopy(page);
  await page.getByRole("link", { name: "Plano da semana" }).first().click();
  await expect(page.getByRole("heading", { name: "Plano da semana", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "O que os seus dados dizem" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "O que aprendemos" })).toBeVisible();
  await expect(page.getByText("O veredito é do código, por indicadores antecipados; não é causal.")).toBeVisible();
  await axe(page);
  // Descartar a proposta atual (com motivo) e gerar uma nova.
  if ((await page.getByTestId("plan-status").getAttribute("data-status")) === "proposto") {
    await page.getByRole("button", { name: "Descartar" }).click();
    await page.getByLabel("Teto alto demais").check();
    await page.getByRole("button", { name: "Confirmar descarte" }).click();
    await expect(page.getByText("Plano descartado.")).toBeVisible();
  }
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Gerar plano da semana" }).click();
  await expect(page.getByTestId("plan-status")).toHaveAttribute("data-status", "proposto", { timeout: 60_000 });
  await expect(page.getByTestId("plan-origin")).toHaveAttribute("data-origin", /^(ia|sem_ia)$/);
  await expect(page.getByTestId("reativacao-previa")).toContainText("Para medir o efeito, 1 em cada 10 não recebe");
  await page.getByRole("button", { name: "Aprovar plano" }).click();
  await expect(page.getByText(/Plano aprovado · convite entregue a \d+ clientes em Sua jornada/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("plan-status")).toHaveAttribute("data-status", "aprovado");
  await expect(page.getByRole("button", { name: "Aprovar plano" })).toHaveCount(0);
  await page.getByRole("link", { name: "Histórico de planos" }).click();
  await expect(page.getByRole("cell", { name: "Aprovado" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Descartado" }).first()).toBeVisible();
  await axe(page);

  // S4.4 (D155): a reativação chega de verdade na Jornada do cliente (Ferramentas do avaliador → cliente reativado).
  const r = await page.request.post("/api/avaliador/reativado", { data: {} });
  expect(r.status(), await r.text()).toBe(200);
  await page.goto("/app/jornada");
  await expect(page.getByText("Cliente do histórico gerado (Ferramentas do avaliador).")).toBeVisible();
  const inbox = page.getByRole("region", { name: /Seus convites/ });
  await expect(inbox).toContainText("te convidou para voltar");
  await axe(page);
});
