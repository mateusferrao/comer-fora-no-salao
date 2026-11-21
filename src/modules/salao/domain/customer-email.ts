/** E-mail do cliente (S4, D154): regras puras; o HMAC e a criptografia ficam na aplicação. */
import { z } from "zod";
import { maskEmail, normalizeEmail } from "@/src/modules/contas/domain/login-code";

export { maskEmail };

/** E-mails de teste do E2E de cliente (padrão da D123): id largo para não repetir entre execuções. */
export const CUSTOMER_E2E_EMAIL_RE = /^e2e-cliente\+\d{1,16}@exemplo\.invalid$/;

const emailSchema = z.email().max(254);

export function parseCustomerEmail(raw: string): string | null {
  const e = normalizeEmail(raw);
  if (CUSTOMER_E2E_EMAIL_RE.test(e)) return e;
  return emailSchema.safeParse(e).success ? e : null;
}
