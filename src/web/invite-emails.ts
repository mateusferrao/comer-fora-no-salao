/**
 * E-mails de convite DEPOIS do commit (S4.4 — D163; revisão técnica I4): agenda o envio com `after()` para não
 * segurar a resposta nem mandar e-mail de uma transação que ainda pode voltar atrás.
 */
import { after } from "next/server";
import { getDb } from "@/src/db/client";
import { getMailSender } from "@/src/modules/contas/adapters/mail-factory";
import { sendPendingInviteEmails } from "@/src/modules/salao/application/deliver-messages";
import { log } from "@/src/shared/log";
import { safeErr } from "@/src/shared/safe-err";
import { publicBaseUrl } from "./qr";
import { getFlags } from "@/src/modules/config/application/app-config";

export function scheduleInviteEmails(restaurantId: string, inviteIds?: string[]): void {
  const run = async () => {
    try {
      const v2 = (await getFlags(getDb())).copy_v2;
      await sendPendingInviteEmails(getDb(), { restaurantId, inviteIds, sender: getMailSender(), baseUrl: publicBaseUrl(), now: new Date(), v2 });
    } catch (err) {
      log.error("falhou", { area: "convite_email", err: safeErr(err) });
    }
  };
  try {
    after(run);
  } catch {
    // Fora de uma requisição (testes que chamam a rota direto): roda em segundo plano mesmo assim.
    void run();
  }
}
