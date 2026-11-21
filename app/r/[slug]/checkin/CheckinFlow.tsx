"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { GpsStatus } from "@/src/modules/salao/domain/geo";
import type { RestaurantPageView } from "@/src/modules/salao/application/queries";
import type { CheckinView } from "@/src/modules/salao/application/views";
import { AppShell } from "@/src/ui/components/AppShell";
import { BottomSheet } from "@/src/ui/components/BottomSheet";
import { Button } from "@/src/ui/components/Button";
import { CategoryImage } from "@/src/ui/components/CategoryImage";
import { Chip } from "@/src/ui/components/Chip";
import { Logo } from "@/src/ui/components/Logo";
import { StampCard } from "@/src/ui/components/StampCard";
import { CheckinResult } from "@/src/ui/cliente/CheckinResult";
import { checkGps } from "@/src/ui/cliente/gps";
import { LoginSheet, type LoginStep } from "@/src/ui/cliente/LoginSheet";
import { RulesSheet } from "@/src/ui/cliente/RulesSheet";
import { TXT } from "@/src/ui/cliente/textos";
import { useDistance } from "@/src/ui/cliente/useDistance";

type Session = "entrar" | "perfil" | "consentir" | "pronto";
type Props = { page: RestaurantPageView; session: Session; firstName: string | null; stamps: number; initialResult?: CheckinView | null; token?: string; copyV2?: boolean };

const stepOf = (s: Session): LoginStep => (s === "perfil" ? "perfil" : s === "consentir" ? "consentir" : "email");

/** Check-in (app/09–11 + espec. 3.5.2–3.5.4; S4): cartela → GPS (não bloqueia) → login por e-mail → resultado. */
export function CheckinFlow({ page, session, firstName, stamps, initialResult = null, token, copyV2 = false }: Props) {
  const [identified, setIdentified] = useState(session === "pronto");
  const [loginStep, setLoginStep] = useState<LoginStep>(stepOf(session));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [gpsSheet, setGpsSheet] = useState(false);
  const [identifySheet, setIdentifySheet] = useState(false);
  const [rules, setRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinView | null>(initialResult);
  const gps = useRef<GpsStatus>("sem_suporte");
  const gpsAt = useRef(0);
  const key = useRef<string | null>(null);
  const distance = useDistance(page.lat, page.lng);
  const missing = Math.max(0, 6 - stamps);

  const sendCheckin = async () => {
    setBusy(true);
    setError(null);
    key.current ??= crypto.randomUUID(); // a mesma chave em "Tentar de novo" (idempotência)
    try {
      const res = await fetch(`/api/r/${page.slug}/checkin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gpsStatus: gps.current, idempotencyKey: key.current, ...(token ? { p: token } : {}) }),
      });
      if (res.status === 401) {
        const j = (await res.json().catch(() => ({}))) as { etapa?: Session };
        setIdentified(false);
        setLoginStep(stepOf(j.etapa ?? "entrar"));
        setIdentifySheet(true);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as CheckinView);
      key.current = null;
    } catch {
      setError("Não conseguimos fazer seu check-in.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const proceed = (s: GpsStatus) => {
    gps.current = s;
    if (!navigator.cookieEnabled) {
      setError("Ative os cookies para fazer check-in.");
      setBusy(false);
      return;
    }
    if (!identified) {
      setBusy(false);
      setIdentifySheet(true);
      return;
    }
    void sendCheckin();
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    // GPS já resolvido há pouco (ex.: fechou a identificação sem querer): não pergunta de novo.
    if (gpsAt.current && Date.now() - gpsAt.current < 5 * 60_000) return proceed(gps.current);
    setStatus("Verificando sua localização…");
    const s = await checkGps(page);
    setStatus("");
    if (s === "perto") {
      gpsAt.current = Date.now();
      return proceed(s);
    }
    setBusy(false);
    setGpsSheet(true);
  };


  return (
    <AppShell columnClassName="bg-[#2f2f2f]">
      <div className="relative min-h-[calc(100dvh-3rem)] overflow-hidden bg-[#2f2f2f] text-white">
        {page.heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.heroImage} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover blur-2xl" onError={(e) => (e.currentTarget.style.display = "none")} />
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-black/60" />
        <main className="relative flex flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5">
          <header className="flex items-center justify-between">
            <span className="w-11" />
            <span className="flex items-center gap-2">
              <Logo height={26} />
              <span className="text-lg font-semibold">Comer Fora</span>
            </span>
            <Link
              href={`/r/${page.slug}${token ? `?p=${encodeURIComponent(token)}` : ""}`}
              aria-label="Fechar"
              className="flex size-11 items-center justify-center rounded-full bg-black/50 focus-visible:outline-2 focus-visible:outline-white"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </Link>
          </header>

          {result ? (
            <div className="mt-8">
              <CheckinResult view={result} slug={page.slug} token={token} copyV2={copyV2} />
            </div>
          ) : (
            <>
              <h1 className="mt-14 text-center text-xl font-medium leading-7">
                Faça o check-in
                <br />e junte selos para ganhar!
              </h1>
              <div className="mt-8 rounded-[32px] bg-white p-5 text-ink">
                <p className="text-base font-semibold">{page.name}</p>
                {distance && <p className="text-sm text-ink-muted">{distance}</p>}
                <StampCard stamps={stamps} className="mt-5" />
                <hr className="my-5 border-divider" />
                <h2 className="text-base font-semibold">Recompensas</h2>
                {page.recompensa && (
                  <div className="mt-3 flex gap-3">
                    <CategoryImage category={page.recompensa.category} className="size-16 shrink-0 rounded-lg" />
                    <div className="min-w-0">
                      <p className="text-base">{page.recompensa.itemName}</p>
                      <p className="text-sm text-ink-muted">6 selos - {page.recompensa.itemName}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Chip>Próxima recompensa</Chip>
                        <Chip>{missing === 1 ? "Falta 1 selo" : `Faltam ${missing} selos`}</Chip>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {error && (
                <div role="alert" className="mt-5 rounded-md bg-white p-4 text-center text-ink">
                  <p className="text-sm font-medium">{error}</p>
                  {error.startsWith("Não conseguimos") && (
                    <Button variant="outline-app" className="mt-3 w-full" onClick={() => void sendCheckin()} loading={busy}>
                      Tentar de novo
                    </Button>
                  )}
                </div>
              )}
              <p aria-live="polite" className="sr-only">
                {status}
              </p>
              <div className="mt-10 flex flex-col items-center gap-4">
                <Button
                  variant="outline-app"
                  loading={busy}
                  onClick={() => void start()}
                  className="w-64 rounded-full border-white bg-white text-ink hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Fazer check-in
                </Button>
                {status && <p className="text-sm text-white/85">{status}</p>}
                <button type="button" onClick={() => setRules(true)} className="min-h-11 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-white">
                  Ver detalhes e regras
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      <BottomSheet
        open={gpsSheet}
        onClose={() => setGpsSheet(false)}
        title={TXT.gpsTitulo}
        description={TXT.gpsCorpo}
        actions={
          <>
            <Button variant="outline-app" onClick={() => setGpsSheet(false)}>
              Fechar
            </Button>
            <Button
              variant="primary-app"
              onClick={() => {
                setGpsSheet(false);
                setBusy(true);
                gpsAt.current = Date.now();
                proceed("confirmado_manual");
              }}
            >
              Confirmar localização
            </Button>
          </>
        }
      />
      <LoginSheet
        open={identifySheet}
        slug={page.slug}
        restaurantName={page.name}
        agora={page.agora}
        initialStep={loginStep}
        firstName={firstName}
        onClose={() => setIdentifySheet(false)}
        onDone={() => {
          setIdentified(true);
          setIdentifySheet(false);
          void sendCheckin();
        }}
      />
      <RulesSheet open={rules} onClose={() => setRules(false)} restaurantName={page.name} />
    </AppShell>
  );
}
