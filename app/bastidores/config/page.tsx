import type { Metadata } from "next";
import { BastidoresConfig } from "@/src/ui/bastidores/BastidoresConfig";
import { bastidoresEnabled, isBastidores } from "@/src/web/bastidores-session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações do protótipo · Bastidores" };

/** Bastidores › Configurações do protótipo (senha — D139): prompts ao vivo, flags e resetar demo. */
export default async function ConfigPage() {
  const enabled = bastidoresEnabled();
  const logged = enabled && (await isBastidores());
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink">Configurações do protótipo</h1>
      <p className="mt-1 text-sm text-ink-muted">Bastidores. Muda o bloco de instruções e tom das tarefas de IA para todo o protótipo; schema e regras ficam no código.</p>
      {!enabled ? <p className="mt-6 text-sm text-ink">Bastidores protegidos desligados neste ambiente.</p> : <BastidoresConfig logged={logged} />}
    </main>
  );
}
