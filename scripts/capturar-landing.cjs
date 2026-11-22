/* eslint-disable @typescript-eslint/no-require-imports -- script Node avulso (CommonJS), fora do app */
// Captura os prints da landing (S9): topo da Visão geral da cópia da Cantina e o celular com o 2º card do convite.
// Uso: node capture-landing.cjs <worktree> <baseURL> <outDir> [explore]
const path = require("node:path");
const [, , WT, BASE, OUT, MODE] = process.argv;
const { chromium } = require(path.join(WT, "node_modules/@playwright/test"));
const pg = require(path.join(WT, "node_modules/pg"));
const DB = process.env.DATABASE_URL;
const TOKEN = "e2e-login-token-ficticio-local-0001";

async function setFlags() {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    await c.query("begin");
    const cur = await c.query(`select v.value from app_config a join app_config_versions v on v.key = a.key and v.version = a.version where a.key = 'flags'`);
    const on = ["painel_valor", "copy_v2", "explica_ia", "resumo_email", "modo_garcom", "porta_conta", "mcp", "copiloto", "mcp_clientes", "mcp_edicao"];
    const value = { ...(cur.rows[0]?.value ?? {}), ...Object.fromEntries(on.map((f) => [f, true])), agendador: false };
    const max = await c.query(`select coalesce(max(version), 0) + 1 as v from app_config_versions where key = 'flags'`);
    const version = Number(max.rows[0].v);
    await c.query(`insert into app_config_versions (key, version, value, note) values ('flags', $1, $2, 'captura da landing')`, [version, JSON.stringify(value)]);
    await c.query(`insert into app_config (key, version) values ('flags', $1) on conflict (key) do update set version = excluded.version, updated_at = now()`, [version]);
    await c.query("commit");
  } finally {
    await c.end();
  }
}

async function copySlug() {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    const r = await c.query(`select slug from restaurants where copied_from is not null order by created_at desc limit 1`);
    return r.rows[0].slug;
  } finally {
    await c.end();
  }
}

(async () => {
  await setFlags();
  const browser = await chromium.launch();
  // 1) Dono: login de teste (D123) → Visão geral da cópia da Cantina.
  const owner = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const email = `e2e-dono+910@exemplo.invalid`;
  const r = await owner.request.post("/api/parceiro/entrar", { data: { email }, headers: { "x-e2e-token": TOKEN } });
  const { codigo } = await r.json();
  const v = await owner.request.post("/api/parceiro/entrar/codigo", { data: { email, codigo } });
  if (v.status() !== 200) throw new Error("login " + v.status());
  const page = await owner.newPage();
  await page.goto("/parceiro/salao");
  await page.getByRole("heading", { name: "Visão geral", level: 1 }).waitFor({ timeout: 120_000 });
  for (let i = 0; i < 60 && (await page.getByText(/Preparando o restaurante de exemplo/).count()); i++) {
    await page.waitForTimeout(2000);
    await page.reload();
  }
  await page.waitForTimeout(1500);
  if (MODE === "explore") {
    await page.screenshot({ path: path.join(OUT, "explore-owner.png"), fullPage: true });
  } else {
    const main = page.locator("main").first();
    const box = await main.boundingBox();
    await page.screenshot({ path: path.join(OUT, "visao-geral.png"), clip: { x: box.x, y: box.y, width: box.width, height: Number(process.env.CLIP_H ?? 540) } });
  }
  const slug = await copySlug();
  console.log("slug", slug);

  // 2) Cliente no celular: check-in pela API até cair no grupo com convite; depois a tela do check-in.
  for (let attempt = 0; attempt < 8; attempt++) {
    const cust = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const api = `/api/r/${slug}`;
    const mail = `e2e-cliente+${Date.now()}${attempt}@exemplo.invalid`;
    const a = await cust.request.post(`${api}/entrar`, { data: { email: mail, accept: true }, headers: { "x-e2e-token": TOKEN } });
    const { codigo: cc } = await a.json();
    const b = await cust.request.post(`${api}/entrar/confirmar`, { data: { email: mail, code: cc } });
    const { etapa } = await b.json();
    if (etapa === "perfil") await cust.request.post(`${api}/perfil`, { data: { name: "Larissa", phone: "", optEmail: true, optApp: true } });
    const p = await cust.newPage();
    await p.goto(`/r/${slug}/checkin`);
    await p.getByRole("button", { name: "Fazer check-in" }).click();
    const confirm = p.getByRole("button", { name: /Confirmar localização/ });
    await confirm.waitFor({ timeout: 15000 }).catch(() => {});
    if (await confirm.isVisible()) await confirm.click();
    await p.getByText(/Check-in feito/).first().waitFor({ timeout: 20000 }).catch(async () => { await p.screenshot({ path: path.join(OUT, "debug.png") }); throw new Error("sem resultado"); });
    await p.waitForTimeout(1500);
    const hasInvite = await p.getByText(/Seu convite/i).first().isVisible().catch(() => false);
    console.log("ui checkin, convite:", hasInvite);
    if (!hasInvite) { await cust.close(); continue; }
    await p.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, MODE === "explore" ? "explore-phone.png" : "celular.png"), fullPage: MODE === "explore" });
    break;
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
