/** Linha de base Tesseract (OCR local, sem nuvem e sem IA) para a T1 (D128). Só no script de avaliação. */
import { createWorker } from "tesseract.js";

export async function tesseractText(images: Uint8Array[]): Promise<string> {
  const worker = await createWorker("por");
  try {
    const out: string[] = [];
    for (const img of images) out.push((await worker.recognize(Buffer.from(img))).data.text);
    return out.join("\n");
  } finally {
    await worker.terminate();
  }
}
