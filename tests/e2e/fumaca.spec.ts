import { expect, test } from "@playwright/test";

// Roda local, no CI e contra produção (BASE_URL). Planejamento S0 §7.3.
const BARRA = "Protótipo de case · não é produto oficial do iFood";

test("barra de protótipo com o texto exato", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("prototype-bar")).toHaveText(BARRA);
});

test("meta robots com noindex", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("cabeçalho X-Robots-Tag com noindex", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-robots-tag"]).toMatch(/noindex/);
});

test("/api/health responde 200 com banco no ar", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: boolean; db: string; sha: string; fakeAi?: boolean };
  expect(body).toMatchObject({ ok: true, db: "up" });
  if (process.env.EXPECTED_SHA) expect(body.sha).toBe(process.env.EXPECTED_SHA);
  // S8 (revisão, segurança 2): a IA roteirizada do E2E nunca liga em produção.
  if (process.env.BASE_URL) expect(body.fakeAi).toBe(false);
});

test("galeria /bastidores/componentes com barra e noindex", async ({ page }) => {
  const res = await page.goto("/bastidores/componentes");
  expect(res?.status()).toBe(200);
  expect(res?.headers()["x-robots-tag"]).toMatch(/noindex/);
  await expect(page.getByTestId("prototype-bar")).toHaveText(BARRA);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
