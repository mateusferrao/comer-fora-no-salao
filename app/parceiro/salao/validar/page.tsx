import type { Metadata } from "next";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { activeWaiterToken } from "@/src/modules/salao/application/waiter-tokens";
import { ValidateCode } from "@/src/ui/portal/ValidateCode";
import { WaiterLinkCard } from "@/src/ui/portal/WaiterLinkCard";
import { requireOwner } from "@/src/web/portal-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Validar código · Portal do Parceiro" };

export default async function ValidarPage() {
  const s = await requireOwner();
  // S6.2 (D190): com a flag, o "Link do garçom" abre só esta tela, sem login; sem ela, vale o aviso de antes.
  const garcom = s.current && (await getFlags(getDb())).modo_garcom;
  const active = garcom ? await activeWaiterToken(getDb(), s.current!.id) : null;
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold text-ink">Validar código</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {s.current ? `${s.current.name} · ` : ""}Digite o código que o cliente mostra no app. O sistema reconhece se é 1ª visita, convite ou recompensa.
        </p>
      </header>
      {s.current ? <ValidateCode /> : <p className="text-sm text-ink">Crie ou escolha um restaurante para validar códigos.</p>}
      {garcom ? (
        <WaiterLinkCard activeSince={active?.createdAt.toISOString() ?? null} />
      ) : (
        <p className="text-xs text-ink-muted">Benefício, convite e recompensa só valem depois de validados aqui. Em produção, esta tela abriria num &quot;modo salão&quot; com PIN, sem o resto do Portal.</p>
      )}
    </main>
  );
}
