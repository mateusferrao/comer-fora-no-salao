import { beforeEach, describe, expect, it } from "vitest";
import { clientIp, hitLimit, resetLimitsForTests } from "@/src/shared/rate-limit-memory";
import { safeErr } from "@/src/shared/safe-err";
import { rejectCrossSite } from "@/src/web/guards";
import { sameName } from "@/src/modules/salao/application/identify-customer";

describe("limite em memória", () => {
  beforeEach(resetLimitsForTests);
  it("bloqueia a partir de max+1 na janela e libera na próxima", () => {
    for (let i = 0; i < 3; i++) expect(hitLimit("k", 3, 1000, 0)).toBe(false);
    expect(hitLimit("k", 3, 1000, 10)).toBe(true);
    expect(hitLimit("k", 3, 1000, 1000)).toBe(false);
  });
  it("IP do primeiro X-Forwarded-For", () => {
    // O último item é o que o proxy da VPS acrescentou; o 1º pode ser forjado pelo cliente.
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("desconhecido");
  });
});

describe("guardas de origem (CSRF)", () => {
  const req = (h: Record<string, string>) => new Request("http://x/api", { method: "POST", headers: h });
  it("recusa outro site e corpo que não é JSON", () => {
    expect(rejectCrossSite(req({ "sec-fetch-site": "cross-site", "content-type": "application/json" }))!.status).toBe(403);
    expect(rejectCrossSite(req({ "sec-fetch-site": "same-origin", "content-type": "text/plain" }))!.status).toBe(415);
    expect(rejectCrossSite(req({ "sec-fetch-site": "same-origin", "content-type": "application/json" }))).toBeNull();
    expect(rejectCrossSite(req({ "content-type": "application/json; charset=utf-8" }))).toBeNull();
  });
});

describe("log sem PII", () => {
  it("só nome e código do erro, nunca a mensagem", () => {
    const err = Object.assign(new Error("Failed query: insert ... params: Ana Fictícia,abc123,5678"), { cause: { code: "23505" } });
    expect(safeErr(err)).toBe("Error (23505)");
    expect(safeErr(err)).not.toContain("Ana");
    expect(safeErr("x")).toBe("erro");
  });
});

describe("nome confere", () => {
  it("ignora maiúsculas, acentos e espaços", () => {
    expect(sameName("  Fábio   Teste ", "fabio teste")).toBe(true);
    expect(sameName("Ana", "Bruno")).toBe(false);
  });
});
