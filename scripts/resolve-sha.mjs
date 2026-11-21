// Grava o SHA do commit em .next/standalone/GIT_SHA (planejamento S0 §6.5).
// Ordem: 1) ARG/ENV GIT_SHA do build; 2) .git/HEAD + refs liberados no .dockerignore.
// (3: o job de deploy grava GIT_SHA no serviço — lido em tempo de execução, tem prioridade.)
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const isSha = (s) => typeof s === "string" && /^[0-9a-f]{7,40}$/.test(s);

function fromGit() {
  try {
    const head = readFileSync(".git/HEAD", "utf8").trim();
    if (isSha(head)) return head;
    if (!head.startsWith("ref:")) return null;
    const ref = head.slice(4).trim();
    if (existsSync(`.git/${ref}`)) return readFileSync(`.git/${ref}`, "utf8").trim();
    if (existsSync(".git/packed-refs")) {
      for (const line of readFileSync(".git/packed-refs", "utf8").split("\n")) {
        const [sha, name] = line.trim().split(" ");
        if (name === ref) return sha;
      }
    }
  } catch {
    // sem .git no contexto de build
  }
  return null;
}

const fromArg = process.env.GIT_SHA?.trim();
let sha = "unknown";
let source = "nenhuma";
if (isSha(fromArg)) {
  sha = fromArg;
  source = "ARG GIT_SHA";
} else {
  const g = fromGit();
  if (isSha(g)) {
    sha = g;
    source = ".git";
  }
}
writeFileSync(".next/standalone/GIT_SHA", `${sha}\n`);
console.log(`resolve-sha: ${sha} (fonte: ${source})`);
