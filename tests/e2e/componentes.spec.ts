import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const URL = "/bastidores/componentes";
const BARRA = "Protótipo de case · não é produto oficial do iFood";
const CABECALHO = "Base do design system · tokens medidos em prints de referência";

const VIEWPORTS = [
  { nome: "celular", width: 390, height: 844, barraMax: 44 },
  { nome: "computador", width: 1280, height: 800, barraMax: 28 },
];

async function focoDentro(page: Page, seletor: string) {
  return page.evaluate((s) => !!document.querySelector(s)?.contains(document.activeElement), seletor);
}

for (const vp of VIEWPORTS) {
  test.describe(`galeria em ${vp.width} px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("renderiza todos os componentes, o logo e o cabeçalho", async ({ page }) => {
      await page.goto(URL);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(CABECALHO);
      await expect(page.getByRole("img", { name: "iFood" }).first()).toBeVisible();
      for (const id of ["tokens", "button", "tabs", "chip", "select", "badge", "bottom-sheet", "app-shell", "portal-shell"]) {
        await expect(page.getByTestId(`demo-${id}`), id).toBeVisible();
      }
    });

    test(`barra com o texto completo e altura ≤ ${vp.barraMax} px`, async ({ page }) => {
      await page.goto(URL);
      const barra = page.getByTestId("prototype-bar");
      await expect(barra).toHaveText(BARRA);
      const box = await barra.boundingBox();
      expect(box?.height).toBeLessThanOrEqual(vp.barraMax);
      const cortado = await barra.evaluate((el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
      expect(cortado).toBe(false);
    });

    test("BottomSheet: abre, Tab circula dentro, Esc fecha e devolve o foco", async ({ page }) => {
      await page.goto(URL);
      const gatilho = page.getByRole("button", { name: "Abrir painel inferior" });
      await gatilho.click();
      const sheet = page.getByRole("dialog", { name: "Parece que você não está no restaurante!" });
      await expect(sheet).toBeVisible();
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        expect(await focoDentro(page, "dialog[open]")).toBe(true);
      }
      await page.keyboard.press("Shift+Tab");
      expect(await focoDentro(page, "dialog[open]")).toBe(true);
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(gatilho).toBeFocused();
    });

    test("Tabs: setas do teclado trocam a aba", async ({ page }) => {
      await page.goto(URL);
      const demo = page.getByTestId("demo-tabs");
      const primeira = demo.getByRole("tab", { name: "Benefícios" });
      await primeira.focus();
      await page.keyboard.press("ArrowRight");
      await expect(demo.getByRole("tab", { name: "Sobre" })).toBeFocused();
      await expect(demo.getByRole("tab", { name: "Sobre" })).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("ArrowRight");
      await expect(primeira).toBeFocused();
    });

    test("todo alvo interativo tem ao menos 44 × 44 px", async ({ page }) => {
      await page.goto(URL);
      const pequenos = await page.evaluate(() => {
        const sel = 'button, a[href], [role="tab"], input, select, textarea, summary';
        return Array.from(document.querySelectorAll<HTMLElement>(sel))
          // Links da barra de protótipo: alvo de 24 px (WCAG 2.5.8), conferido no entrada.spec (S3).
          .filter((el) => !el.closest('[aria-label="Aviso de protótipo"]') && !el.closest("dialog:not([open])"))
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ el: el.outerHTML.slice(0, 80), r: el.getBoundingClientRect() }))
          // visualmente oculto até receber foco (link "Pular para o conteúdo")
          .filter(({ r }) => r.width > 1 && r.height > 1)
          .filter(({ r }) => r.width < 44 || r.height < 44)
          .map(({ el, r }) => `${Math.round(r.width)}×${Math.round(r.height)} ${el}`);
      });
      expect(pequenos).toEqual([]);
    });

    test("axe sem violações", async ({ page }) => {
      await page.goto(URL);
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  });
}

test.describe("gaveta do PortalShell no celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("abre, prende o foco, Esc fecha e devolve o foco", async ({ page }) => {
    await page.goto(URL);
    const botao = page.getByRole("button", { name: "Abrir menu" });
    await botao.click();
    const gaveta = page.getByRole("dialog", { name: "Menu" });
    await expect(gaveta).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect(await focoDentro(page, "dialog[open]")).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(gaveta).toBeHidden();
    await expect(botao).toBeFocused();
  });

  test("axe sem violações com a gaveta aberta", async ({ page }) => {
    await page.goto(URL);
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

test.describe("PortalShell no computador", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("sidebar fixa visível e sem botão de menu", async ({ page }) => {
    await page.goto(URL);
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeHidden();
  });
});

test.describe("correções da revisão S0", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Button carregando mantém o foco, fica aria-disabled e não usa opacidade", async ({ page }) => {
    await page.goto(URL);
    const botao = page.getByRole("button", { name: "Simular carregamento" });
    await botao.focus();
    await page.keyboard.press("Enter");
    await expect(botao).toHaveAttribute("aria-busy", "true");
    await expect(botao).toHaveAttribute("aria-disabled", "true");
    await expect(botao).toBeFocused();
    expect(await botao.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await page.keyboard.press("Enter"); // clique durante o carregamento é ignorado
    await expect(botao).toBeFocused();
    await expect(botao).not.toHaveAttribute("aria-busy", "true", { timeout: 5_000 });
  });

  test("Pular para o conteúdo é o 1º foco e leva ao conteúdo", async ({ page }) => {
    await page.goto(URL);
    await page.keyboard.press("Tab");
    const pular = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(pular).toBeFocused();
    const box = await pular.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#conteudo$/);
  });

  test("painel inferior não dispensável ignora o clique no fundo", async ({ page }) => {
    await page.goto(URL);
    await page.getByRole("button", { name: "Abrir confirmação" }).click();
    const d = page.getByRole("dialog", { name: "Confirmar a ação?" });
    await expect(d).toBeVisible();
    await page.mouse.click(20, 80);
    await expect(d).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(d).toBeHidden();
  });

  test("404 em português, com a barra e caminho de volta", async ({ page }) => {
    const res = await page.goto("/rota-que-nao-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("prototype-bar")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página não encontrada");
    await page.getByRole("link", { name: "Voltar ao início" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

/** Seletor do design system (ajuste de 21/11): lista suspensa com teclado no computador; BottomSheet no celular. */
test.describe("Select", () => {
  test("computador: teclado (setas, Home/End, Enter, Esc), opção desabilitada pulada, axe com a lista aberta", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    const sec = page.getByTestId("demo-select");
    const trigger = sec.getByRole("button", { name: /^Oferta / });
    await expect(trigger).toHaveAccessibleName("Oferta Cannoli grátis");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const box = sec.getByRole("listbox", { name: "Oferta" });
    await expect(box).toBeFocused();
    await expect(sec.getByRole("option", { name: /Cannoli grátis/ })).toHaveAttribute("aria-selected", "true");
    const r = await new AxeBuilder({ page }).include('[data-testid="demo-select"]').analyze();
    expect(r.violations.map((v) => v.id)).toEqual([]);
    await page.keyboard.press("End");
    // A última opção está desabilitada: End para na penúltima.
    await page.keyboard.press("Enter");
    await expect(box).toBeHidden();
    await expect(sec.getByTestId("select-valor")).toHaveText("Escolhido: tiramisu");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Home");
    await page.keyboard.press("Escape");
    await expect(sec.getByTestId("select-valor")).toHaveText("Escolhido: tiramisu");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await sec.getByRole("option", { name: /Panna cotta/ }).click();
    await expect(sec.getByTestId("select-valor")).toHaveText("Escolhido: panna");
  });

  test("celular: abre como lista presa ao botão (sem painel inferior); escolher fecha", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(URL);
    const sec = page.getByTestId("demo-select");
    const trigger = sec.getByRole("button", { name: /^Oferta / });
    await trigger.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const box = sec.getByRole("listbox", { name: "Oferta" });
    await expect(box).toBeVisible();
    // A lista nasce colada ao botão (logo abaixo ou logo acima dele).
    const t = (await trigger.boundingBox())!;
    const b = (await box.boundingBox())!;
    expect(Math.min(Math.abs(b.y - (t.y + t.height)), Math.abs(t.y - (b.y + b.height)))).toBeLessThan(16);
    await sec.getByRole("option", { name: /Tiramisù/ }).click();
    await expect(box).toBeHidden();
    await expect(sec.getByTestId("select-valor")).toHaveText("Escolhido: tiramisu");
  });
});
