import { after } from "next/server";
import { getDb } from "@/src/db/client";
import { cleanupStaleAccounts } from "@/src/modules/contas/application/cleanup";
import { copyVitrineFor } from "@/src/modules/contas/application/copy-vitrine";
import { safeErr } from "@/src/shared/safe-err";
import { log } from "@/src/shared/log";

/** Depois do login: prepara a vitrine da conta (D119) e faz a limpeza "de carona" (fora do caminho da resposta). */
export function afterLogin(ownerId: string): void {
  after(async () => {
    await copyVitrineFor(ownerId).catch((e) => log.error("falha na cópia da vitrine", { area: "copia", err: safeErr(e) }));
    await cleanupStaleAccounts(getDb(), new Date()).catch((e) => log.error("falha na limpeza", { area: "limpeza", err: safeErr(e) }));
  });
}

export function ensureVitrineCopy(ownerId: string): void {
  after(() => copyVitrineFor(ownerId).then(() => undefined, (e) => log.error("falha na cópia da vitrine", { area: "copia", err: safeErr(e) })));
}
