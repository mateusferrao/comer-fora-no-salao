/** Dados comuns das telas do Portal (layout e páginas), sempre a partir da sessão do dono. */
import { redirect } from "next/navigation";
import { openingHoursSchema } from "@/src/modules/beneficios/domain/slots";
import { isOpen } from "@/src/modules/beneficios/domain/slots";
import { getOwnerSession, type OwnerSession } from "./owner-session";

export async function requireOwner(): Promise<OwnerSession> {
  const s = await getOwnerSession();
  if (!s) redirect("/parceiro/entrar");
  return s;
}

export function storeLabel(r: { kind: string; copiedFrom: string | null; status: string }): string {
  if (r.copiedFrom) return "demonstração";
  return r.status === "ativo" ? "teste · ativo" : "teste · em ativação";
}

export function openNow(openingHours: unknown, now: Date): boolean | null {
  const p = openingHoursSchema.safeParse(openingHours);
  return p.success && p.data.length > 0 ? isOpen(p.data, now) : null;
}
