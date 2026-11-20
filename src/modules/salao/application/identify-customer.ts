/** Identificação do cliente (espec. 3.5.3): HMAC do telefone + 4 dígitos; opt-in ligado por padrão (D30). */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Executor } from "@/src/db/executor";
import { customerContacts, customers, restaurantCustomers } from "@/src/db/schema";
import { hmacPhone } from "@/src/shared/crypto";
import { isPhoneFormat, last4, phoneDigits } from "@/src/modules/salao/domain/phone";

export const identifyInputSchema = z.object({
  name: z.string().trim().min(2, "nome").max(60, "nome"),
  phone: z.string().refine(isPhoneFormat, "telefone"),
  optWhatsapp: z.boolean(),
  optApp: z.boolean(),
  optPush: z.boolean(),
  accept: z.literal(true),
});
export type IdentifyInput = z.infer<typeof identifyInputSchema>;

export class PhoneInUseError extends Error {
  constructor() {
    super("telefone em uso com outro nome");
  }
}

/** Nome comparado sem maiúsculas, acentos nem espaços extras. */
export function sameName(a: string, b: string): boolean {
  const n = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return n(a) === n(b);
}

/**
 * Devolve o cliente do telefone (cria se não existir) e grava os opt-ins neste restaurante.
 * Telefone já cadastrado só entra como o mesmo cliente se o nome conferir (o telefone sozinho não é senha —
 * revisão S1, A1; em produção seria login iFood/OTP).
 */
export async function identifyCustomer(ex: Executor, restaurantId: string, input: IdentifyInput): Promise<{ customerId: string; created: boolean }> {
  const digits = phoneDigits(input.phone);
  const hmac = hmacPhone(digits);
  return ex.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: customerContacts.customerId, name: customerContacts.name })
      .from(customerContacts)
      .where(eq(customerContacts.phoneHmac, hmac))
      .limit(1);
    if (existing && !sameName(existing.name, input.name)) throw new PhoneInUseError();
    let customerId = existing?.id;
    let created = false;
    if (!customerId) {
      const [c] = await tx.insert(customers).values({}).returning({ id: customers.id });
      customerId = c!.id;
      const inserted = await tx
        .insert(customerContacts)
        .values({ customerId, phoneHmac: hmac, phoneLast4: last4(input.phone), name: input.name.trim() })
        .onConflictDoNothing({ target: customerContacts.phoneHmac })
        .returning({ id: customerContacts.customerId });
      if (inserted.length === 0) {
        // Corrida com outro pedido do mesmo telefone: usa quem chegou primeiro.
        await tx.delete(customers).where(eq(customers.id, customerId));
        const [winner] = await tx
          .select({ id: customerContacts.customerId, name: customerContacts.name })
          .from(customerContacts)
          .where(eq(customerContacts.phoneHmac, hmac))
          .limit(1);
        if (!sameName(winner!.name, input.name)) throw new PhoneInUseError();
        customerId = winner!.id;
      } else {
        created = true;
      }
    }
    await tx
      .insert(restaurantCustomers)
      .values({ restaurantId, customerId, optWhatsapp: input.optWhatsapp, optApp: input.optApp, optPush: input.optPush })
      .onConflictDoUpdate({
        target: [restaurantCustomers.restaurantId, restaurantCustomers.customerId],
        set: { optWhatsapp: sql`excluded.opt_whatsapp`, optApp: sql`excluded.opt_app`, optPush: sql`excluded.opt_push` },
      });
    return { customerId, created };
  });
}

export async function customerExists(ex: Executor, customerId: string): Promise<boolean> {
  const [c] = await ex.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
  return Boolean(c);
}
