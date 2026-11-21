import { readFileSync } from "node:fs";
import path from "node:path";

/** SHA publicado: variável GIT_SHA (alternativa 3) > arquivo gravado no build (1 e 2) > "dev". */
export function resolveGitSha(env: Record<string, string | undefined> = process.env, cwd: string = process.cwd()): string {
  const fromEnv = env.GIT_SHA?.trim();
  if (fromEnv) return fromEnv;
  try {
    const fromFile = readFileSync(path.join(cwd, "GIT_SHA"), "utf8").trim();
    if (fromFile && fromFile !== "unknown") return fromFile;
  } catch {
    // arquivo ausente (dev local)
  }
  return "dev";
}
