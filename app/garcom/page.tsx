import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { ValidateCode } from "@/src/ui/portal/ValidateCode";
import { readWaiterSession } from "@/src/web/waiter-session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Link do garçom · Validar código", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Link do garçom (S6.2 — D190): só "Validar código", sem o resto do Portal. */
export default async function WaiterPage() {
  if (!(await getFlags(getDb())).modo_garcom) notFound();
  const s = await readWaiterSession();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6 sm:px-8">
      <header>
        <p className="text-sm font-semibold text-red-text">Link do garçom</p>
        <h1 className="text-2xl font-bold text-ink">{s ? `Validar código · ${s.restaurantName}` : "Validar código"}</h1>
        {s && <p className="mt-1 text-sm text-ink-muted">Digite o código que o cliente mostra no app. O sistema reconhece se é 1ª visita, convite ou recompensa.</p>}
      </header>
      {s ? (
        <ValidateCode endpoint="/api/garcom/codigos" waiter />
      ) : (
        <p role="alert" className="rounded-sm border border-border bg-surface-muted p-4 text-base text-ink">
          Este link do garçom não vale mais. Peça um novo ao responsável.
        </p>
      )}
    </main>
  );
}
