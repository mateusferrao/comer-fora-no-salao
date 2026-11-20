import { redirect } from "next/navigation";
import { requireOwner } from "@/src/web/portal-context";

export const dynamic = "force-dynamic";

/** Assistente retomável: abre no passo em que o dono parou (`onboarding_step`). */
export default async function AtivarPage() {
  const s = await requireOwner();
  const cur = s.current;
  if (!cur || cur.kind !== "teste") redirect("/parceiro/salao");
  if (cur.status === "ativo") redirect("/parceiro/salao/kit");
  redirect(`/parceiro/salao/ativar/${Math.min(5, Math.max(1, cur.onboardingStep ?? 1))}`);
}
