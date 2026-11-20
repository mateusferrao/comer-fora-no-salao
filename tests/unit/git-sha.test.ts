import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveGitSha } from "@/src/shared/git-sha";

describe("resolveGitSha", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sha-"));
  const empty = mkdtempSync(path.join(tmpdir(), "sha-vazio-"));
  writeFileSync(path.join(dir, "GIT_SHA"), "abc1234\n");

  it("a variável GIT_SHA tem prioridade", () => {
    expect(resolveGitSha({ GIT_SHA: "fff0000" }, dir)).toBe("fff0000");
  });
  it("sem variável, lê o arquivo gravado no build", () => {
    expect(resolveGitSha({}, dir)).toBe("abc1234");
  });
  it("sem nada, devolve dev", () => {
    expect(resolveGitSha({}, empty)).toBe("dev");
  });
});
