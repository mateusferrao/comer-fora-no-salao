import { defineConfig, devices } from "@playwright/test";

// BASE_URL definido → roda contra um servidor externo (ex.: produção). Senão, sobe o standalone local.
const externalBaseUrl = process.env.BASE_URL;
const port = Number(process.env.E2E_PORT ?? 3200);
/** Token fictício do servidor local; contra produção, os testes leem `E2E_LOGIN_TOKEN` do ambiente (secret do GitHub). */
export const E2E_LOGIN_TOKEN_LOCAL = "e2e-login-token-ficticio-local-0001";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${port}`,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "node .next/standalone/server.js",
        url: `http://localhost:${port}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          PORT: String(port),
          HOSTNAME: "127.0.0.1",
          DATABASE_URL: process.env.DATABASE_URL ?? "postgres://salao:salao@localhost:5432/salao_test",
          GIT_SHA: process.env.GIT_SHA ?? "e2e",
          // Segredos fictícios do servidor de teste (o standalone roda como produção e exige os dois — T-I1).
          PHONE_HASH_SECRET: process.env.PHONE_HASH_SECRET ?? "e2e-phone-hash-secret-ficticio-0001",
          SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-session-secret-ficticio-0000001",
          // S2: e-mail em memória (nunca SES no teste), token do E2E (D123) e link do avaliador (D126) fictícios.
          MAIL_TRANSPORT: "memory",
          E2E_LOGIN_TOKEN: process.env.E2E_LOGIN_TOKEN ?? E2E_LOGIN_TOKEN_LOCAL,
          EVALUATOR_LINK_TOKEN: "avaliador-link-ficticio-local-0001",
          // S3: senha fictícia dos Bastidores no servidor de teste (em produção, a variável do Easypanel — D139).
          BASTIDORES_PASSWORD: "bastidores-senha-ficticia-local",
          PUBLIC_BASE_URL: `http://localhost:${port}`,
          // Sem chaves de IA no servidor local/CI: o pacote e o kit seguem o modo sem IA (determinístico).
          OPENROUTER_KEY_PUBLIC: "",
          OPENROUTER_KEY_DEMO: "",
        },
      },
});
