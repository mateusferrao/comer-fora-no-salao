import { describe, expect, it } from "vitest";
import { rejectCrossSite } from "@/src/web/guards";
import { MAX_JSON_BYTES, readJson } from "@/src/web/http";

/** S9 (segurança M4): corpo JSON com teto de 64 KB, antes de qualquer autenticação. */
const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://x/api", { method: "POST", body, headers: { "content-type": "application/json", ...headers }, duplex: "half" } as RequestInit);

/** JSON válido de `bytes` bytes, em pedaços; conta quantos pedaços foram puxados. */
function streamOf(bytes: number, chunk = 8 * 1024) {
  const enc = new TextEncoder();
  let sent = 0;
  const state = { pulled: 0 };
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode('{"t":"'));
    },
    pull(c) {
      state.pulled++;
      if (sent >= bytes) {
        c.enqueue(enc.encode('"}'));
        return c.close();
      }
      const n = Math.min(chunk, bytes - sent);
      c.enqueue(enc.encode("a".repeat(n)));
      sent += n;
    },
  });
  return { stream, state };
}

describe("readJson com teto de corpo", () => {
  it("lê o JSON pequeno como antes e devolve null para JSON inválido", async () => {
    expect(await readJson(post(JSON.stringify({ email: "ana@exemplo.com" })))).toEqual({ email: "ana@exemplo.com" });
    expect(await readJson(post("{nao é json"))).toBeNull();
  });

  it("aceita exatamente 64 KB", async () => {
    const s = JSON.stringify({ t: "a".repeat(MAX_JSON_BYTES - 8) });
    expect(s.length).toBe(MAX_JSON_BYTES);
    expect(await readJson(post(s))).toEqual({ t: "a".repeat(MAX_JSON_BYTES - 8) });
  });

  it("content-length acima de 64 KB: recusa sem ler o corpo", async () => {
    const req = post(JSON.stringify({ t: "a".repeat(MAX_JSON_BYTES) }), { "content-length": String(MAX_JSON_BYTES + 20) });
    expect(await readJson(req)).toBeNull();
    expect(req.bodyUsed).toBe(false);
  });

  it("sem content-length (corpo em pedaços): para de ler ao passar de 64 KB", async () => {
    const big = streamOf(10 * 1024 * 1024);
    expect(await readJson(post(big.stream))).toBeNull();
    expect(big.state.pulled).toBeLessThan(20);
    const small = streamOf(1024);
    expect(await readJson(post(small.stream))).toEqual({ t: "a".repeat(1024) });
  });
});

describe("rejectCrossSite recusa corpo JSON declarado grande com 413", () => {
  const req = (h: Record<string, string>) => new Request("http://x/api", { method: "POST", headers: h });
  it("413 acima de 64 KB; no limite passa; upload (não JSON) não entra nesse teto", () => {
    const json = { "sec-fetch-site": "same-origin", "content-type": "application/json" };
    expect(rejectCrossSite(req({ ...json, "content-length": String(MAX_JSON_BYTES + 1) }))!.status).toBe(413);
    expect(rejectCrossSite(req({ ...json, "content-length": String(MAX_JSON_BYTES) }))).toBeNull();
    expect(rejectCrossSite(req({ "content-type": "multipart/form-data; boundary=x", "content-length": "5000000" }), { requireJson: false })).toBeNull();
    expect(rejectCrossSite(req({ "content-type": "application/json", "content-length": "5000000" }), { requireJson: false })!.status).toBe(413);
  });
});
