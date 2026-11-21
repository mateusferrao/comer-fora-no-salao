import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cruise, type ICruiseResult, type IConfiguration } from "dependency-cruiser";

const require = createRequire(import.meta.url);
const root = path.resolve(__dirname, "../..");
const config = require(path.join(root, ".dependency-cruiser.cjs")) as IConfiguration;

describe("fronteiras do domínio", () => {
  it("acusa domain-no-infra quando o domínio importa drizzle-orm", async () => {
    const fixtureDir = path.join(root, "tests/fixtures/boundaries");
    const { output } = await cruise(["src", "app"], {
      baseDir: fixtureDir,
      validate: true,
      ruleSet: { forbidden: config.forbidden },
      doNotFollow: { path: "node_modules" },
      tsPreCompilationDeps: true,
    });
    const result = output as ICruiseResult;
    const violations = result.summary.violations.map((v) => `${v.rule.name}:${v.from}`);
    for (const f of ["bad", "bad-pg", "bad-langfuse", "bad-adapter", "bad-application", "bad-ia", "bad-app"]) {
      expect(violations, f).toContain(`domain-no-infra:src/modules/x/domain/${f}.ts`);
    }
    expect(violations.some((v) => v.includes("good.ts"))).toBe(false);
  });

  it("o run principal (npm run check:boundaries) passa e não enxerga a fixture", () => {
    const out = execFileSync("npx", ["depcruise", "src", "app", "--config", ".dependency-cruiser.cjs"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(out).toMatch(/no dependency violations found/);
    expect(out).not.toMatch(/fixtures/);
  });
});
