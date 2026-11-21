/**
 * Encerramento gracioso (S0 #27, planejamento S3 §6.5): com `NEXT_MANUAL_SIG_HANDLE=true`, o Next não trata
 * SIGTERM/SIGINT; este handler roda as tarefas (flush do rastro, fechar o pool) com limite total e sai com o
 * código de sinal (128 + n), como o Next faria.
 */
import { log } from "./log";

export type ShutdownTask = { name: string; run: () => Promise<void> };
type Deps = { exit: (code: number) => void; timeoutMs?: number };

const CODE: Record<string, number> = { SIGINT: 130, SIGTERM: 143 };

export async function runShutdown(signal: string, tasks: ShutdownTask[], { exit, timeoutMs = 5_000 }: Deps): Promise<void> {
  const started = Date.now();
  log.info("encerrando", { area: "processo", signal });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const all = (async () => {
    for (const t of tasks) {
      try {
        await t.run();
      } catch (err) {
        log.warn("falha ao encerrar (ignorada)", { area: "processo", task: t.name, err: err instanceof Error ? err.name : "erro" });
      }
    }
  })();
  const limit = new Promise<"tempo">((resolve) => {
    timer = setTimeout(() => resolve("tempo"), timeoutMs);
  });
  const r = await Promise.race([all.then(() => "ok" as const), limit]);
  if (timer) clearTimeout(timer);
  log.info("encerrado", { area: "processo", signal, status: r, ms: Date.now() - started });
  exit(CODE[signal] ?? 128);
}

/** Registra uma vez por processo. */
export function installShutdown(tasks: ShutdownTask[], deps: Deps): void {
  const g = globalThis as typeof globalThis & { __salaoShutdown?: boolean };
  if (g.__salaoShutdown) return;
  g.__salaoShutdown = true;
  let running = false;
  const handler = (signal: string) => {
    if (running) return;
    running = true;
    void runShutdown(signal, tasks, deps);
  };
  process.on("SIGTERM", () => handler("SIGTERM"));
  process.on("SIGINT", () => handler("SIGINT"));
}
