/**
 * Gera as imagens dos 3 cardápios FICTÍCIOS (D117/D130) a partir de eval/cardapios/dados.ts, com Playwright:
 * - boteco: "foto torta" (papel girado, sombra, leve desfoque e JPEG comprimido) — o caso difícil;
 * - burger: cardápio limpo de 1 coluna;
 * - sushi: PDF de 2 páginas A4 + as 2 páginas em JPEG (como o navegador converte o PDF — D127).
 * Saída: public/exemplos/* e eval/cardapios/<id>.gabarito.json. Uso: npx tsx scripts/gerar-cardapios.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { CARDAPIOS, gabarito, reais, type Cardapio, type Secao } from "../eval/cardapios/dados";

const OUT = path.join(process.cwd(), "public/exemplos");
const EVAL = path.join(process.cwd(), "eval/cardapios");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function linhas(s: Secao, leader: boolean): string {
  return s.linhas
    .map((l) => {
      const precos = l.precos.map((p) => (p.rotulo ? `${esc(p.rotulo)} ${reais(p.centavos)}` : `R$ ${reais(p.centavos)}`)).join(" · ");
      return `<div class="item"><div class="linha"><span class="nome">${esc(l.nome)}</span>${leader ? '<span class="dots"></span>' : ""}<span class="preco">${precos}</span></div>${
        l.desc ? `<div class="desc">${esc(l.desc)}</div>` : ""
      }</div>`;
    })
    .join("");
}

function secoes(ss: Secao[], leader: boolean): string {
  return ss.map((s) => `<section><h2>${esc(s.titulo)}</h2>${linhas(s, leader)}</section>`).join("");
}

function htmlBoteco(c: Cardapio): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#6b4e2e;background-image:repeating-linear-gradient(90deg,#6b4e2e 0 40px,#73553a 40px 80px);width:1500px;height:1700px;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif}
  .papel{width:1150px;padding:60px 70px;background:#f6efdc;transform:rotate(-3.2deg) skewX(1.5deg);box-shadow:18px 24px 40px rgba(0,0,0,.55);filter:blur(.6px) contrast(.92);color:#2b2118}
  h1{font-size:64px;margin:0;text-align:center;letter-spacing:2px} .sub{text-align:center;font-style:italic;font-size:24px;margin:6px 0 30px}
  .cols{columns:2;column-gap:60px} section{break-inside:avoid;margin-bottom:26px} h2{font-size:30px;border-bottom:3px double #2b2118;margin:0 0 10px;text-transform:uppercase}
  .linha{display:flex;gap:8px;font-size:22px;align-items:baseline} .nome{font-weight:bold} .dots{flex:1;border-bottom:2px dotted #6b5a45} .desc{font-size:17px;font-style:italic;margin:0 0 8px 4px} .item{margin-bottom:6px}
  </style></head><body><div class="papel"><h1>${esc(c.nome)}</h1><p class="sub">${esc(c.subtitulo)}</p><div class="cols">${secoes(c.paginas[0]!, true)}</div></div></body></html>`;
}

function htmlBurger(c: Cardapio): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1000px;background:#111;color:#f4f4f4;font-family:Arial,Helvetica,sans-serif}
  .wrap{padding:60px 70px} h1{font-size:70px;margin:0;color:#ffcc33;text-transform:uppercase;letter-spacing:-1px} .sub{font-size:22px;color:#bbb;margin:4px 0 40px}
  h2{font-size:28px;color:#ffcc33;margin:34px 0 12px;text-transform:uppercase;letter-spacing:3px} .item{margin-bottom:14px}
  .linha{display:flex;justify-content:space-between;font-size:26px} .nome{font-weight:bold} .preco{color:#ffcc33;font-weight:bold} .desc{font-size:18px;color:#aaa}
  </style></head><body><div class="wrap"><h1>${esc(c.nome)}</h1><p class="sub">${esc(c.subtitulo)}</p>${secoes(c.paginas[0]!, false)}</div></body></html>`;
}

function htmlSushi(c: Cardapio): string {
  const pagina = (ss: Secao[], i: number) =>
    `<div class="pagina">${i === 0 ? `<h1>${esc(c.nome)}</h1><p class="sub">${esc(c.subtitulo)}</p>` : `<p class="topo">${esc(c.nome)} · continuação</p>`}${secoes(ss, true)}<p class="rodape">página ${i + 1} de ${c.paginas.length}</p></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:A4;margin:0} body{margin:0;font-family:"Times New Roman",serif;color:#1d1d1d}
  .pagina{width:210mm;height:297mm;box-sizing:border-box;padding:22mm 20mm;position:relative;break-after:page;background:#fbfaf6}
  h1{font-size:40pt;margin:0;text-align:center;font-weight:normal;letter-spacing:6px} .sub{text-align:center;font-size:13pt;color:#8a2b2b;margin:4mm 0 12mm}
  .topo{text-align:center;color:#8a2b2b;font-size:12pt;margin:0 0 10mm} h2{font-size:17pt;color:#8a2b2b;font-weight:normal;margin:9mm 0 4mm;border-bottom:1px solid #c9b8a4}
  .linha{display:flex;gap:3mm;font-size:13pt;align-items:baseline} .dots{flex:1;border-bottom:1px dotted #999} .desc{font-size:10.5pt;color:#666;margin-bottom:2mm}
  .rodape{position:absolute;bottom:12mm;left:0;right:0;text-align:center;font-size:9pt;color:#999}
  </style></head><body>${c.paginas.map(pagina).join("")}</body></html>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(EVAL, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const c of CARDAPIOS) {
    writeFileSync(path.join(EVAL, `${c.id}.gabarito.json`), JSON.stringify({ culinaria: c.culinaria, faixaPreco: c.faixaPreco, itens: gabarito(c) }, null, 2) + "\n");
    if (c.id === "boteco") {
      await page.setViewportSize({ width: 1500, height: 1700 });
      await page.setContent(htmlBoteco(c));
      await page.screenshot({ path: path.join(OUT, "boteco.jpg"), type: "jpeg", quality: 55 });
    } else if (c.id === "burger") {
      await page.setViewportSize({ width: 1000, height: 800 });
      await page.setContent(htmlBurger(c));
      await page.screenshot({ path: path.join(OUT, "burger.jpg"), type: "jpeg", quality: 80, fullPage: true });
    } else {
      await page.setContent(htmlSushi(c));
      await page.pdf({ path: path.join(OUT, "sushi.pdf"), format: "A4", printBackground: true });
      // Páginas como o navegador as renderiza (pdf.js → JPEG ~1600 px — D127).
      const hi = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 794, height: 1123 } });
      await hi.setContent(htmlSushi(c));
      const pages = await hi.locator(".pagina").all();
      for (let i = 0; i < pages.length; i++) {
        await pages[i]!.screenshot({ path: path.join(OUT, `sushi-${i + 1}.jpg`), type: "jpeg", quality: 82, scale: "device" });
      }
      await hi.close();
    }
    console.log(`${c.id}: ${gabarito(c).length} itens`);
  }
  await browser.close();
}

main();
