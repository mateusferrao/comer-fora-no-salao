import { after } from "next/server";
import { startKitGeneration } from "@/src/modules/kit/application/generate-kit";

/** Depois de ativar: a geração do kit começa em segundo plano (revisão P-I1 — a demo não espera o kit). */
export function afterActivation(restaurantId: string, ownerId: string): void {
  after(() => startKitGeneration(restaurantId, ownerId));
}
