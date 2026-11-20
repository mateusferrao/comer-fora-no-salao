"use client";

/**
 * Pré-processamento no navegador (espec. 4.4; D127): imagem → JPEG de até 1600 px; PDF → até 5 páginas
 * renderizadas pelo pdf.js (carregado só quando há PDF) → JPEGs. O arquivo original não sai do aparelho.
 */
export const MAX_INPUT_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_PAGES = 5;
const MAX_SIDE = 1600;

export class PrepError extends Error {
  constructor(readonly code: "heic" | "tamanho" | "tipo" | "paginas" | "leitura") {
    super(code);
  }
}

export function isHeic(f: File): boolean {
  return /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new PrepError("leitura"))), "image/jpeg", 0.85));
}

async function imageToJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => {
    throw new PrepError("tipo");
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvasToJpeg(canvas);
}

/** pdf.js servido como arquivo estático (fora do webpack: empacotá-lo dobrava a memória do build na VPS). */
const PDFJS_DIR = "/vendor/pdfjs-6.5.438";
type PdfJs = typeof import("pdfjs-dist");

async function pdfToJpegs(file: File): Promise<Blob[]> {
  const pdfjs = (await import(/* webpackIgnore: true */ `${PDFJS_DIR}/pdf.min.mjs`)) as PdfJs;
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_DIR}/pdf.worker.min.mjs`;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise.catch(() => {
    throw new PrepError("leitura");
  });
  if (doc.numPages > MAX_PDF_PAGES) {
    await task.destroy();
    throw new PrepError("paginas");
  }
  const out: Blob[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: MAX_SIDE / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    out.push(await canvasToJpeg(canvas));
  }
  await task.destroy();
  return out;
}

/** Arquivo do dono → páginas em JPEG + origem ("foto" | "pdf"). */
export async function prepareMenuFile(file: File): Promise<{ pages: Blob[]; origem: "foto" | "pdf" }> {
  if (isHeic(file)) throw new PrepError("heic");
  if (file.size > MAX_INPUT_BYTES) throw new PrepError("tamanho");
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return { pages: await pdfToJpegs(file), origem: "pdf" };
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new PrepError("tipo");
  return { pages: [await imageToJpeg(file)], origem: "foto" };
}

export const PREP_MESSAGES: Record<PrepError["code"], string> = {
  heic: "Formato não suportado: tire um print ou exporte como JPG.",
  tamanho: "O arquivo passa de 8 MB. Tire uma foto menor ou exporte o PDF com menos páginas.",
  tipo: "Formato não suportado. Envie JPG, PNG, WEBP ou PDF.",
  paginas: "O PDF tem mais de 5 páginas. Envie só as páginas do cardápio do salão.",
  leitura: "Não conseguimos abrir este arquivo. Tente outro ou use um exemplo.",
};
