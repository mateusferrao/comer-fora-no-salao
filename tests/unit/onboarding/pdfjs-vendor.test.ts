import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** O pdf.js do navegador é servido de public/vendor (fora do webpack); a pasta precisa acompanhar a versão instalada. */
describe("pdf.js servido como estático", () => {
  it("a pasta em public/vendor corresponde à versão do pdfjs-dist", () => {
    const { version } = JSON.parse(readFileSync("node_modules/pdfjs-dist/package.json", "utf8")) as { version: string };
    const src = readFileSync("src/ui/portal/wizard/images.ts", "utf8");
    expect(src).toContain(`/vendor/pdfjs-${version}`);
    expect(existsSync(`public/vendor/pdfjs-${version}/pdf.min.mjs`)).toBe(true);
    expect(existsSync(`public/vendor/pdfjs-${version}/pdf.worker.min.mjs`)).toBe(true);
  });
});
