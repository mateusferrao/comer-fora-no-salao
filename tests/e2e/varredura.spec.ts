import { expect, test, type Page } from "@playwright/test";
import { loginE2E, waitExampleReady } from "./helpers";

/**
 * Varredura de textos (S4, D152; revisão técnica I8 e de produto M2): nas telas do produto, nada se apresenta
 * como teste, simulação, demonstração ou dado fictício. Lê o texto renderizado (inclui o que vem do banco) e o
 * título da página. Exceções: a barra de protótipo, os Bastidores e os rodapés do impresso e do e-mail.
 */
const PROIBIDO = /simulad|fictíci|ficticio|de teste|para testar|\btestar\b|demonstra[çc][ãa]o|só no teste|\bdemo\b|protótipo/i;

async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[aria-label="Aviso de protótipo"], [data-testid="prototype-bar-sheet"], [data-testid="rodape-prototipo"], script, style, dialog:not([open])').forEach((n) => n.remove());
    return clone.innerText;
  });
}

async function check(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle").catch(() => {});
  const text = await visibleText(page);
  const hit = PROIBIDO.exec(text);
  expect(hit, `${url}: "${hit?.[0]}" em …${hit ? text.slice(Math.max(0, hit.index - 60), hit.index + 60) : ""}…`).toBeNull();
  expect(await page.title(), `${url}: título`).not.toMatch(PROIBIDO);
}

test("telas públicas do produto: entrada, login, restaurante, check-in e Jornada", async ({ page }) => {
  for (const url of ["/", "/parceiro/entrar", "/r/cantina-nonna-lucia", "/r/cantina-nonna-lucia/checkin", "/app/jornada"]) await check(page, url);
});

test("telas do Portal do dono (cópia do restaurante de exemplo)", async ({ page }) => {
  test.setTimeout(120_000);
  await loginE2E(page.request, 9);
  await page.goto("/parceiro/salao");
  await waitExampleReady(page);
  for (const url of ["/parceiro/salao", "/parceiro/salao/plano", "/parceiro/salao/plano/historico", "/parceiro/salao/kit", "/parceiro/salao/clientes", "/parceiro/salao/configuracoes", "/parceiro/salao/validar"]) {
    await check(page, url);
  }
});
