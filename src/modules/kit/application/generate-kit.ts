import { getDb } from "@/src/db/client";
import { startKitGeneration as start } from "./kit";

/** Geração do kit depois da ativação (em segundo plano). */
export async function startKitGeneration(restaurantId: string, ownerId: string): Promise<void> {
  await start(getDb(), restaurantId, ownerId);
}
