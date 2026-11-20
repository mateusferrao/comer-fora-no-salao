import { getDb } from "@/src/db/client";
import { VITRINE_SLUG } from "@/src/db/seed/vitrine";
import { getJourney } from "@/src/modules/salao/application/queries";
import { readCustomerId } from "@/src/web/customer-session";
import { JourneyView } from "./JourneyView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jornada · Comer Fora (protótipo)" };

/** Jornada no Comer Fora (app/13): só "Visitas" é funcional; Reservas e Avaliações ficam estáticas. */
export default async function JornadaPage() {
  const customerId = await readCustomerId();
  const journey = await getJourney(getDb(), customerId, new Date());
  return <JourneyView journey={journey} exploreHref={`/r/${VITRINE_SLUG}`} />;
}
