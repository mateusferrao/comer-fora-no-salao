import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POST as checkin } from "@/app/api/r/[slug]/checkin/route";
import { MAX_JSON_BYTES } from "@/src/web/http";

/**
 * S9 (segurança M4): todo corpo de pedido passa pelo `readJson` (teto de 64 KB, mesmo sem `content-length`), e a
 * rota responde 413 quando ele diz "grande". Ler o corpo direto (`req.json()`, `req.text()`…) fura o teto.
 */
const ALLOWED: Record<string, { call: string; why: string }> = {
  // Upload do cardápio: multipart com teto próprio (content-length obrigatório, até 24 MB) antes de ler.
  "app/api/parceiro/cardapio/extrair/route.ts": { call: "req.formData()", why: "multipart com teto próprio" },
};

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return routes(p);
    return n === "route.ts" ? [p] : [];
  });
}

const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

describe("rotas leem o corpo só pelo readJson", () => {
  const files = routes("app/api");

  it("acha as rotas", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("nenhuma rota lê o corpo direto (req.json(), request.json(), .text(), .arrayBuffer()…)", () => {
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/\b(req|request)\s*\.\s*(json|text|arrayBuffer|blob|formData)\s*\(/g)) {
        const l = text.split("\n")[lineOf(text, m.index) - 1]!;
        if (ALLOWED[f] && l.includes(ALLOWED[f]!.call)) continue;
        hits.push(`${f}:${lineOf(text, m.index)}: ${l.trim().slice(0, 120)}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("toda rota que chama readJson responde ao corpo grande demais (413)", () => {
    const missing = files.filter((f) => {
      const text = readFileSync(f, "utf8");
      return /\breadJson\s*\(/.test(text) && !/\.erro === "grande"/.test(text);
    });
    expect(missing).toEqual([]);
  });
});

describe("check-in (rota pública, anônima): corpo grande × inválido", () => {
  const params = { params: Promise.resolve({ slug: "qualquer" }) };
  const req = (body: BodyInit) =>
    new Request("http://x/api/r/qualquer/checkin", { method: "POST", body, headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" }, duplex: "half" } as RequestInit);

  it("corpo em pedaços (sem content-length) acima de 64 KB → 413, antes do banco", async () => {
    const chunk = new TextEncoder().encode("a".repeat(16 * 1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent > 10 * MAX_JSON_BYTES) return c.close();
        sent += chunk.byteLength;
        c.enqueue(chunk);
      },
    });
    const res = await checkin(req(stream), params);
    expect(res.status).toBe(413);
    expect(sent).toBeLessThan(2 * MAX_JSON_BYTES);
  });

  it("JSON quebrado → 400", async () => {
    expect((await checkin(req("{nao é json"), params)).status).toBe(400);
  });
});
