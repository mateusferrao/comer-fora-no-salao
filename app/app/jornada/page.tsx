import { getDb } from "@/src/db/client";
import { VITRINE_SLUG } from "@/src/db/seed/vitrine";
import { getJourney } from "@/src/modules/salao/application/queries";
import { listCustomerMessages, markMessagesRead } from "@/src/modules/salao/application/deliver-messages";
import { customers } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { readCustomerId } from "@/src/web/customer-session";
import { JourneyView } from "./JourneyView";
import { getFlags } from "@/src/modules/config/application/app-config";
import { listCustomerPrefs } from "@/src/modules/salao/application/preferences";
import { getMyContact } from "@/src/modules/salao/application/customer-login";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sua jornada · Comer Fora" };

/** Jornada no Comer Fora (app/13): só "Visitas" é funcional; Reservas e Avaliações ficam estáticas. */
export default async function JornadaPage() {
  const customerId = await readCustomerId();
  const db = getDb();
  const journey = await getJourney(db, customerId, new Date());
  // "Seus convites" (S4.4 — D155): lista com "Novo" nesta visita; marca como lidos depois de montar a tela.
  const messages = customerId && journey.firstName !== null ? await listCustomerMessages(db, customerId) : [];
  if (customerId && messages.some((m) => m.unread)) await markMessagesRead(db, customerId, new Date());
  // "Ver como cliente reativado" (Ferramentas do avaliador) entra como um cliente do histórico gerado: a Jornada avisa.
  const generated = customerId ? Boolean((await db.select({ run: customers.simulationRunId }).from(customers).where(eq(customers.id, customerId)))[0]?.run) : false;
  const prefs = customerId && journey.firstName !== null ? await listCustomerPrefs(db, customerId) : [];
  // D250: "Seus dados" só para cliente real logado com perfil (o cliente do histórico gerado não edita).
  const myData = customerId && journey.firstName !== null && !generated ? await getMyContact(db, customerId) : null;
  return <JourneyView journey={journey} messages={messages} generated={generated} exploreHref={`/r/${VITRINE_SLUG}`} copyV2={(await getFlags(db)).copy_v2} prefs={prefs} myData={myData} />;
}
