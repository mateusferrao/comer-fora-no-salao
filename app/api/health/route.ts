import { dailyCapOff } from "@/src/modules/ia/gateway-factory";
import { pingDb } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import { seedStatus } from "@/src/db/seed";
import { retrySeedIfDue } from "@/src/db/seed/boot";
import { resolveGitSha } from "@/src/shared/git-sha";
import { createHealthHandler } from "@/src/shared/health";
import { mailConfigured } from "@/src/modules/contas/adapters/mail-factory";
import { keyState } from "@/src/modules/ia/gateway-factory";

export const dynamic = "force-dynamic";

/**
 * "up" = banco responde E migrações aplicadas; se o banco voltou depois do boot, migra aqui (uma vez).
 * `seed`: a vitrine e o restaurante E2E existem; se o seed falhou, tenta de novo nesta consulta (sem esperar).
 */
export const GET = createHealthHandler({
  ping: async () => {
    await pingDb();
    await ensureMigrated();
  },
  seed: () => {
    const s = seedStatus();
    // Sem seed concluído (banco fora no boot ou falha): nova tentativa com espera crescente; o motivo fica só no log.
    retrySeedIfDue();
    return { state: s.state };
  },
  sha: resolveGitSha(),
  mail: () => mailConfigured(),
  // D254: "teto" mostra se o teto diário da chave pública está suspenso por `IA_SEM_TETO_DIARIO`.
  ia: () => ({ publica: keyState(process.env.OPENROUTER_KEY_PUBLIC), demo: keyState(process.env.OPENROUTER_KEY_DEMO), teto: dailyCapOff() ? "suspenso" : "ativo" }),
});
