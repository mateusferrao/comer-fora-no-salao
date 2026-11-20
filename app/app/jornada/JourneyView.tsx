"use client";

import Link from "next/link";
import type { JourneyView as Journey } from "@/src/modules/salao/application/queries";
import { AppShell } from "@/src/ui/components/AppShell";
import { CodeDisplay } from "@/src/ui/components/CodeDisplay";
import { InviteCard } from "@/src/ui/cliente/InviteCard";
import { TXT } from "@/src/ui/cliente/textos";

export function JourneyView({ journey, exploreHref }: { journey: Journey; exploreHref: string }) {
  const switchCustomer = async () => {
    await fetch("/api/cliente/trocar", { method: "POST" }).catch(() => {});
    window.location.assign(exploreHref);
  };
  return (
    <AppShell>
      <main className="px-5 pb-12 pt-6">
        <Link href={exploreHref} aria-label="Voltar" className="flex size-11 items-center justify-center rounded-full bg-surface-muted focus-visible:outline-2 focus-visible:outline-ink">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="mt-6 text-center text-3xl font-semibold">Olá, {journey.firstName ?? "Visitante"}</h1>
        <p className="mt-2 text-center">
          <Link href={exploreHref} className="inline-flex min-h-11 items-center text-base font-medium text-red-text">
            Explorar restaurantes ›
          </Link>
        </p>
        <dl className="mt-6 grid grid-cols-3 text-center">
          {[
            ["Visitas", journey.visits],
            ["Reservas", 0],
            ["Avaliações", 0],
          ].map(([label, n]) => (
            <div key={label}>
              <dd className="text-3xl font-semibold">{n}</dd>
              <dt className="mt-1 text-base text-ink-muted">{label}</dt>
            </div>
          ))}
        </dl>

        <h2 className="mt-10 text-xl font-semibold">Seus restaurantes</h2>
        {journey.restaurants.length === 0 ? (
          <p className="mt-4 rounded-xl border border-border px-5 py-6 text-base text-ink-muted">Ao fazer check-in, suas visitas serão registradas aqui</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {journey.restaurants.map((r) => (
              <li key={r.slug} className="rounded-xl border border-border p-4">
                <Link href={`/r/${r.slug}`} className="text-lg font-semibold underline-offset-2 hover:underline">
                  {r.name}
                </Link>
                <p className="mt-1 text-sm text-ink-muted">
                  {r.visits === 1 ? "1 visita" : `${r.visits} visitas`} · {r.stamps} de {r.required} selos
                </p>
                {r.todayCodes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold">Códigos de hoje</p>
                    {r.todayCodes.map((c) => (
                      <div key={c.code} className="mt-2">
                        <p className="text-sm">
                          {c.title}
                          {c.itemName ? ` · ${c.itemName}` : ""}
                        </p>
                        <CodeDisplay code={c.code} className="mt-1 text-2xl" />
                        <p className="mt-1 text-xs text-ink-muted">
                          {TXT.informeCodigo} · {TXT.valeHoje}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {r.invite && (
                  <div className="mt-3">
                    <p className="mb-2 text-sm font-semibold text-red-text">Convite ativo</p>
                    <InviteCard invite={r.invite} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {journey.firstName && (
          <button type="button" onClick={() => void switchCustomer()} className="mt-8 min-h-11 w-full text-center text-sm text-ink-muted underline">
            Testar como outro cliente (fictício)
          </button>
        )}
      </main>
    </AppShell>
  );
}
