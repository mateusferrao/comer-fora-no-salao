/**
 * Roda uma vez quando o servidor Node sobe. Nunca roda no `next build` nem no runtime edge (planejamento S0 §6.3).
 * O seed da vitrine NÃO é aguardado aqui (não pode segurar o servidor — S1, T-I2); o health mostra o estado dele.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Rastro antes de tudo; sem chaves ou com erro, fica desligado e só registra no log (D59).
  const { setupTracingFromEnv } = await import("./src/modules/ia/tracing");
  const tracing = setupTracingFromEnv();

  // SIGTERM/SIGINT próprios (NEXT_MANUAL_SIG_HANDLE=true no Dockerfile): flush do rastro e fecha o pool em até 5 s.
  if (process.env.NEXT_MANUAL_SIG_HANDLE === "true") {
    const { installShutdown } = await import("./src/shared/shutdown");
    const { closeDb } = await import("./src/db/client");
    installShutdown(
      [
        { name: "rastro", run: () => tracing.shutdown() },
        // Folga para as requisições em andamento (e os `after()`) terminarem antes de fechar o pool (revisão S3).
        { name: "folga", run: () => new Promise((r) => setTimeout(r, 1_500)) },
        { name: "banco", run: () => closeDb() },
      ],
      { exit: (code) => process.exit(code), timeoutMs: 5_000 },
    );
  }

  const { migrateOnBoot } = await import("./src/db/migrate");
  const migrated = await migrateOnBoot();

  const { startSeedOnBoot } = await import("./src/db/seed/boot");
  void startSeedOnBoot(migrated);
}
