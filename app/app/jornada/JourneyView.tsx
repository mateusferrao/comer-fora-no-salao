"use client";

import Link from "next/link";
import { useState } from "react";
import type { JourneyView as Journey } from "@/src/modules/salao/application/queries";
import type { CustomerMessageView } from "@/src/modules/salao/application/deliver-messages";
import { AppShell } from "@/src/ui/components/AppShell";
import { BottomSheet } from "@/src/ui/components/BottomSheet";
import { Button } from "@/src/ui/components/Button";
import { CodeDisplay } from "@/src/ui/components/CodeDisplay";
import { InviteCard } from "@/src/ui/cliente/InviteCard";
import { NotificationPrefs, type PrefsItem } from "@/src/ui/cliente/NotificationPrefs";
import { MyData, type MyDataView } from "@/src/ui/cliente/MyData";
import { JourneyLogin } from "@/src/ui/cliente/JourneyLogin";
import { codeTitle, TXT } from "@/src/ui/cliente/textos";

/** Jornada (app/13; S4 — D156, D171): "Sair" e "Apagar meus dados" atrás da engrenagem, como no app. */
export function JourneyView({
  journey,
  messages = [],
  generated = false,
  exploreHref,
  copyV2 = false,
  prefs = [],
  myData = null,
}: {
  journey: Journey;
  messages?: CustomerMessageView[];
  generated?: boolean;
  exploreHref: string;
  copyV2?: boolean;
  prefs?: PrefsItem[];
  myData?: MyDataView | null;
}) {
  const [settings, setSettings] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showData, setShowData] = useState(false);
  const [login, setLogin] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const leave = async (path: "sair" | "apagar") => {
    setBusy(true);
    await fetch(`/api/cliente/${path}`, { method: "POST" }).catch(() => {});
    window.location.assign(exploreHref);
  };
  return (
    <AppShell>
      <main className="px-5 pb-12 pt-6">
        <div className="flex items-center justify-between">
          <Link href={exploreHref} aria-label="Voltar" className="flex size-11 items-center justify-center rounded-full bg-surface-muted focus-visible:outline-2 focus-visible:outline-ink">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </Link>
          {journey.firstName !== null && (
            <button type="button" aria-label="Configurações da conta" onClick={() => setSettings(true)} className="flex size-11 items-center justify-center rounded-full bg-surface-muted focus-visible:outline-2 focus-visible:outline-ink">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>
          )}
        </div>
        <h1 className="mt-6 text-center text-3xl font-semibold">Olá, {journey.firstName ?? "Visitante"}</h1>
        {/* D257: quem já é cliente entra aqui, sem check-in, para ver e corrigir os próprios dados. */}
        {journey.firstName === null && (
          <div className="mt-4 flex flex-col items-center gap-1 text-center">
            <Button variant="outline-app" onClick={() => setLogin(true)}>
              Entrar com e-mail
            </Button>
            <p className="text-xs text-ink-muted">Já fez check-in em algum restaurante? Entre para ver seus convites e seus dados.</p>
          </div>
        )}
        {generated && (
          <p className="mt-3 rounded-md border border-border bg-white p-3 text-center text-sm text-ink">
            Cliente do histórico gerado (Ferramentas do avaliador).{" "}
            <button type="button" onClick={() => void leave("sair")} className="min-h-11 font-semibold text-red-text underline">
              Voltar ao meu login
            </button>
          </p>
        )}
        {/* S5.2 (copy_v2): o convite que pode virar código hoje vai para o topo. */}
        {copyV2 &&
          journey.restaurants
            .filter((r) => r.invite?.validToday && r.invite.state !== "usar_hoje")
            .map((r) => (
              <Link key={`hoje-${r.slug}`} href={`/r/${r.slug}`} data-testid="convite-vale-hoje" className="mt-6 flex min-h-11 items-center justify-between gap-3 rounded-xl border-2 border-red-text bg-white p-4 text-ink">
                <span className="font-semibold">
                  Seu convite vale hoje até {hourText(r.invite!.endMin)} · {r.name}
                </span>
                <span aria-hidden="true" className="text-red-text">
                  ›
                </span>
              </Link>
            ))}
        {messages.length > 0 && (
          <section aria-labelledby="seus-convites" className="mt-6 rounded-xl border border-border bg-white p-4">
            <h2 id="seus-convites" className="flex items-center gap-2 text-base font-semibold">
              Seus convites
              {messages.some((m) => m.unread) && (
                <span className="rounded-full bg-red-button px-2 py-0.5 text-xs font-semibold text-white">{messages.filter((m) => m.unread).length} novo{messages.filter((m) => m.unread).length > 1 ? "s" : ""}</span>
              )}
            </h2>
            <ul className="mt-2 flex flex-col">
              {messages.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 border-t border-divider py-2 text-sm first:border-t-0">
                  <span>
                    <span className="font-medium text-ink">{m.restaurantName}</span>{" "}
                    <span className="text-ink-muted">{m.kind === "reativacao" ? "te convidou para voltar" : "convite da sua visita"}</span>
                    {m.unread && <span className="ml-2 text-xs font-semibold text-red-text">Novo</span>}
                  </span>
                  <Link href={`/r/${m.slug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-red-text underline">
                    Ver convite
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mt-2 text-center">
          <Link href={exploreHref} className="inline-flex min-h-11 items-center text-base font-medium text-red-text">
            Ver o restaurante de exemplo ›
          </Link>
        </p>
        {/* S9: só o que existe (Reservas e Avaliações com zero fixo saíram). */}
        <p className="mt-6 flex flex-col items-center text-center">
          <span className="text-3xl font-semibold">{journey.visits}</span>
          <span className="mt-1 text-base text-ink-muted">{journey.visits === 1 ? "Visita" : "Visitas"}</span>
        </p>

        <h2 className="mt-10 text-xl font-semibold">Seus restaurantes</h2>
        {journey.restaurants.length === 0 ? (
          <p className="mt-4 rounded-xl border border-border px-5 py-6 text-base text-ink-muted">Suas visitas aparecem aqui depois do 1º check-in.</p>
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
                        <p className="text-sm">{codeTitle(c)}</p>
                        <CodeDisplay code={c.code} className="mt-1 text-2xl" />
                        <p className="mt-1 text-xs text-ink-muted">
                          {TXT.mostreCodigo} · {TXT.valeHoje}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {r.invite && (
                  <div className="mt-3">
                    <InviteCard invite={r.invite} agenda={copyV2} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
      <JourneyLogin open={login} onClose={() => setLogin(false)} onDone={() => window.location.reload()} />
      <BottomSheet open={settings} onClose={() => (setSettings(false), setConfirmDelete(false), setShowPrefs(false), setShowData(false))} title={showPrefs ? "Gerenciar notificações" : showData ? "Seus dados" : "Sua conta"}>
        {showData && myData ? (
          <MyData initial={myData} onBack={() => setShowData(false)} />
        ) : showPrefs ? (
          <div className="flex flex-col gap-3">
            <NotificationPrefs items={prefs} />
            <Button variant="outline-app" onClick={() => setShowPrefs(false)}>
              Voltar
            </Button>
          </div>
        ) : confirmDelete ? (
          <div className="flex flex-col gap-3 text-left">
            <p className="text-sm text-ink">Vamos apagar seu nome, telefone e e-mail, e você deixa de receber convites. Suas visitas ficam só como números anônimos para os restaurantes.</p>
            <Button variant="primary-app" loading={busy} onClick={() => void leave("apagar")}>
              Apagar meus dados
            </Button>
            <Button variant="outline-app" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* D250: o cliente corrige o próprio nome e telefone. */}
            {myData && (
              <Button variant="outline-app" onClick={() => setShowData(true)}>
                Seus dados
              </Button>
            )}
            {/* S6.1 (D198): central de preferências, como "Gerenciar notificações" do app (print 14). */}
            <Button variant="outline-app" onClick={() => setShowPrefs(true)}>
              Gerenciar notificações
            </Button>
            <Button variant="outline-app" loading={busy} onClick={() => void leave("sair")}>
              Sair
            </Button>
            <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 text-sm font-medium text-red-text underline">
              Apagar meus dados
            </button>
          </div>
        )}
      </BottomSheet>
    </AppShell>
  );
}

const hourText = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;
