// Completa a saída standalone do Next: o server.js faz process.chdir(__dirname),
// então static, public e as migrações precisam estar dentro de .next/standalone.
import { cpSync, existsSync } from "node:fs";

const out = ".next/standalone";
if (!existsSync(`${out}/server.js`)) {
  console.error("prepare-standalone: .next/standalone/server.js não existe (rode next build antes)");
  process.exit(1);
}
cpSync(".next/static", `${out}/.next/static`, { recursive: true });
cpSync("public", `${out}/public`, { recursive: true });
cpSync("drizzle", `${out}/drizzle`, { recursive: true });
console.log("prepare-standalone: static, public e drizzle copiados");
