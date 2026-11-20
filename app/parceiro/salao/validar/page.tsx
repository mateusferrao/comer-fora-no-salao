import type { Metadata } from "next";
import { ValidateCode } from "@/src/ui/portal/ValidateCode";
import { requireOwner } from "@/src/web/portal-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Validar código · Portal do Parceiro" };

export default async function ValidarPage() {
  const s = await requireOwner();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold text-ink">Validar código</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {s.current ? `${s.current.name} · ` : ""}Digite o código que o cliente mostra no app. O sistema reconhece se é 1ª visita, convite ou recompensa.
        </p>
      </header>
      {s.current ? <ValidateCode /> : <p className="text-sm text-ink">Crie ou escolha um restaurante para validar códigos.</p>}
      <p className="text-xs text-ink-muted">Benefício, convite e recompensa só valem depois de validados aqui. Em produção, esta tela abriria num &quot;modo salão&quot; com PIN, sem o resto do Portal.</p>
    </main>
  );
}
