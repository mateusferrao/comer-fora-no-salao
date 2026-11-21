import type { Metadata } from "next";
import { restaurantFromStopToken } from "@/src/modules/planos/application/digest";
import { StopDigest } from "./StopDigest";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parar o resumo semanal · Comer Fora", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** "Não quero mais receber este resumo" (S6.1 — D193): a página não desliga sozinha; o botão faz um POST. */
export default async function StopDigestPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.slice(0, 400) : "";
  // Link inválido: diz logo, sem botão que falharia (E2E profunda da revisão S4–S6).
  const valid = !!restaurantFromStopToken(token);
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-2xl font-bold text-ink">Parar o resumo semanal por e-mail</h1>
      <p className="text-sm text-ink-muted">O plano da semana continua no Portal. Você pode religar o resumo em Configurações › Avisos e automação.</p>
      {valid ? <StopDigest token={token} /> : <p className="text-base text-ink">Este link não vale. Desligue o resumo em Configurações › Avisos e automação.</p>}
    </main>
  );
}
