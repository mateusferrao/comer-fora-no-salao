import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/src/db/client";
import { getKit } from "@/src/modules/kit/application/kit";
import { qrUrl } from "@/src/modules/kit/domain/qr";
import { KitManager } from "@/src/ui/kit/KitManager";
import { getFlags } from "@/src/modules/config/application/app-config";
import { requireOwner } from "@/src/web/portal-context";
import { publicBaseUrl, qrDataUri } from "@/src/web/qr";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kit de divulgação · Portal do Parceiro" };

export default async function KitPage() {
  const s = await requireOwner();
  const cur = s.current;
  if (!cur || cur.status !== "ativo") {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-bold text-ink">Kit de divulgação</h1>
        <p className="text-sm text-ink">O kit é gerado depois de ativar o Comer Fora no salão.</p>
        <Link href="/parceiro/salao/ativar" className="self-start text-sm font-semibold text-red-text underline">
          Continuar a ativação
        </Link>
      </main>
    );
  }
  const kit = (await getKit(getDb(), cur.id, new Date()))!;
  const base = publicBaseUrl();
  const qrs: Record<string, string> = {};
  for (const p of kit.pieces) for (const v of p.variants) if (p.kind !== "garcom") qrs[v.id] = await qrDataUri(qrUrl(base, cur.slug, v.token));
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold text-ink">Kit de divulgação</h1>
        <p className="mt-1 text-sm text-ink">
          Imprima o display e o cartaz, coloque nas mesas e marque “Está no salão”. Cada versão tem o próprio QR: o painel mostra qual traz mais check-ins.
        </p>
        <details className="mt-2 text-sm text-ink-muted">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink sm:min-h-6">Como os QRs contam</summary>
          <p className="mt-1">
            Cada QR identifica a peça e a versão (display A ou B, cartaz A ou B, porta-conta), não a mesa: imprima o mesmo display para todas as mesas. As leituras e
            os check-ins são contados por peça e versão, e é isso que mostra qual chamada funciona melhor. As chamadas vêm da IA (ou do texto padrão, quando ela não
            responde) e você pode editar. O benefício e os números vêm do sistema. O cartão do garçom não tem QR.
          </p>
        </details>
      </header>
      <KitManager initial={kit} restaurantName={cur.name} qrs={qrs} billHolder={(await getFlags(getDb())).porta_conta} />
    </main>
  );
}
