import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/src/db/client";
import { listCustomerPrefs, prefsTarget } from "@/src/modules/salao/application/preferences";
import { NotificationPrefs } from "@/src/ui/cliente/NotificationPrefs";
import { Unsubscribe } from "./Unsubscribe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preferências de e-mail · Comer Fora", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Link "Preferências de e-mail · Descadastrar" de todo e-mail ao cliente (S4.4; S6.1 — D198). A página não muda nada
 * sozinha: cada interruptor e "Parar todos" fazem um POST (robôs que abrem links de e-mail não gastam nada). Não mostra
 * o e-mail nem o nome do cliente.
 */
export default async function DescadastrarPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.slice(0, 400) : "";
  const target = prefsTarget(token);
  const items = target ? await listCustomerPrefs(getDb(), target.customerId, target.restaurantId) : [];
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-center text-2xl font-bold text-ink">{items[0] ? `E-mails do restaurante ${items[0].restaurant}` : "Preferências de e-mail"}</h1>
      {items.length > 0 ? (
        <NotificationPrefs items={items} token={token} />
      ) : (
        <p className="text-center text-sm text-ink-muted">Este link não vale mais. Use a engrenagem em Sua jornada.</p>
      )}
      {items.length > 0 && (
        <section aria-label="Parar todos os e-mails" className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-ink-muted">Seus convites continuam em Sua jornada.</p>
          <Unsubscribe token={token} />
        </section>
      )}
      <p className="text-center text-sm text-ink-muted">
        Para apagar todos os seus dados, use a engrenagem em{" "}
        <Link className="text-red-text underline" href="/app/jornada">
          Sua jornada
        </Link>
        .
      </p>
    </main>
  );
}
