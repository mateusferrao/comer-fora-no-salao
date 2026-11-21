import Link from "next/link";
import type { Metadata } from "next";
import { Roteiro } from "@/src/ui/Roteiro";
import { EvaluatorTools } from "@/src/ui/bastidores/EvaluatorTools";
import { getOwnerSession } from "@/src/web/owner-session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ferramentas do avaliador · Comer Fora no Salão · protótipo de case" };

/** Ferramentas do avaliador (D153; S4 §4.6): fora das telas do produto. Exigem estar logado no Portal. */
export default async function AvaliadorPage() {
  const s = await getOwnerSession();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <p className="text-sm">
        <Link className="text-red-text underline" href="/">
          ← Início
        </Link>
      </p>
      <h1 className="text-2xl font-bold text-ink">Ferramentas do avaliador</h1>
      <p className="text-sm leading-6 text-ink">
        Atalhos para ver em minutos o que no restaurante leva dias. Ficam aqui, fora do produto, e só agem nos seus restaurantes e nos seus clientes reais (nunca no histórico
        gerado).
      </p>
      <Roteiro />
      {s ? (
        <EvaluatorTools restaurants={s.restaurants.map((r) => ({ id: r.id, name: r.name, copy: !!r.copiedFrom }))} currentId={s.current?.id ?? null} />
      ) : (
        <p className="rounded-sm border border-border bg-white p-4 text-sm text-ink">
          Entre no Portal para usar as ferramentas.{" "}
          <Link className="text-red-text underline" href="/parceiro/entrar">
            Entrar
          </Link>
        </p>
      )}
    </main>
  );
}
