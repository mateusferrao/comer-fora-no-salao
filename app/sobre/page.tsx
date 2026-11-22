import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/src/ui/components/AppShell";
import { PHOTO_CREDITS } from "@/src/ui/cliente/creditos";

export const metadata: Metadata = { title: "Sobre este protótipo · Comer Fora" };

const h2 = "mt-8 text-lg font-semibold text-ink";
const p = "mt-2 text-base leading-6 text-ink";

/**
 * "Sobre este protótipo" para quem chega pelas telas do cliente (S9): o link da barra e os créditos das fotos vêm para
 * cá, e não para Bastidores › Como funciona, que explica ao dono como o retorno é medido.
 */
export default function SobrePage() {
  return (
    <AppShell>
      <main className="px-5 pb-12 pt-6">
        <h1 className="text-2xl font-semibold leading-8 text-ink">Sobre este protótipo</h1>
        <p className={p}>Este é um protótipo feito para um processo seletivo do iFood. Não é produto oficial do iFood.</p>
        <p className={p}>O check-in, o código de acesso por e-mail, o código do benefício e os convites funcionam de verdade. O restaurante de exemplo, Cantina Nonna Lúcia, é fictício.</p>

        <h2 className={h2}>Seus dados</h2>
        <p className={p}>Você entra só com o seu e-mail. O restaurante em que você faz check-in vê seu nome, seu e-mail, seu telefone (se você informar) e suas visitas.</p>
        <p className={p}>
          Para apagar seus dados, use a engrenagem em{" "}
          <Link href="/app/jornada" className="font-medium text-red-text underline">
            Sua jornada
          </Link>
          .
        </p>

        <h2 id="fotos" className={h2}>
          Créditos das fotos
        </h2>
        <p className={p}>Fotos ilustrativas de banco livre do Wikimedia Commons:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-ink-muted">
          {PHOTO_CREDITS.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
