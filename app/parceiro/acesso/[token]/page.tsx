import type { Metadata } from "next";
import { AccessButton } from "./AccessButton";
import { Roteiro } from "@/src/ui/Roteiro";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal do Parceiro · acesso do avaliador" };

/**
 * Link do avaliador (D126). A página não cria nada sozinha: o botão faz um POST — robôs que abrem links
 * de e-mail (pré-visualização, antivírus) não gastam o limite nem criam contas.
 */
export default async function AcessoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-[calc(100dvh-3rem)] items-start justify-center bg-page px-4 py-10 sm:items-center">
      <div className="w-full max-w-[428px] rounded-sm bg-white px-6 py-8 shadow-low sm:px-8">
        <h1 className="text-2xl font-bold text-ink">Acesso de avaliação</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Este link abre uma conta só sua no Portal do protótipo, sem pedir e-mail. Ela já vem com um restaurante de demonstração com 60 dias de dados, e você
          pode criar o seu restaurante do zero.
        </p>
        <AccessButton token={token} />
        <p className="mt-6 text-xs leading-5 text-ink-muted">Protótipo de case · dados fictícios. Contas sem acesso por 7 dias são apagadas.</p>
        <Roteiro className="mt-6" />
      </div>
    </main>
  );
}
