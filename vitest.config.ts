import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
          testTimeout: 30_000,
          // Sem chaves de IA na integração: nada de chamada real (custo, rede); cada teste injeta o gateway falso.
          env: { DATABASE_URL: process.env.DATABASE_URL ?? "postgres://salao:salao@localhost:5432/salao_test", OPENROUTER_KEY_DEMO: "", OPENROUTER_KEY_PUBLIC: "", LANGFUSE_PUBLIC_KEY: "", LANGFUSE_SECRET_KEY: "" },
        },
      },
    ],
  },
});
