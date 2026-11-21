import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Sem SQL montado com texto (S6.3a, D197 — segurança contra SQL injection): o banco só é acessado pelo Drizzle e
 * pelo `sql` com template (parametrizado). `sql.raw` e `execute`/`query` com string comum só na lista permitida,
 * e cada uso permitido recebe só constantes do código.
 */
const ALLOWED: Record<string, string> = {
  // `alias` vem de chamadas internas com literais ("c", "k", "i"…), nunca de entrada.
  "src/modules/analytics/application/dashboard.ts": "sql.raw(alias)",
  // Checagem de saúde: texto fixo.
  "src/db/client.ts": 'query("select 1")',
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" || n.startsWith(".") ? [] : files(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("nenhum SQL montado com texto fora da lista permitida", () => {
  it("src/ e app/", () => {
    const hits: string[] = [];
    for (const f of [...files("src"), ...files("app")]) {
      if (f.startsWith("src/db/migrate")) continue;
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((l, i) => {
        const raw = /\bsql\.raw\(/.test(l);
        const strExec = /\.(execute|query)\(\s*["'`]/.test(l) && !/\.query\(\{/.test(l);
        if (!raw && !strExec) return;
        const ok = ALLOWED[f] && l.includes(ALLOWED[f]!);
        if (!ok) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it("os aliases do sql.raw do painel são literais", () => {
    const src = readFileSync("src/modules/analytics/application/dashboard.ts", "utf8");
    const calls = [...src.matchAll(/byOrigin\(([^)]*)\)/g)].map((m) => m[1]!.trim()).filter((a) => a !== "alias: string");
    expect(calls.length).toBeGreaterThan(0);
    for (const a of calls) expect(a).toMatch(/^"[a-z0-9_]+"$/);
  });
});
