import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/src/db/client";
import { getKit } from "@/src/modules/kit/application/kit";
import { qrUrl } from "@/src/modules/kit/domain/qr";
import { KitManager } from "@/src/ui/kit/KitManager";
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
        <p className="mt-1 text-sm text-ink-muted">
          Display de mesa e cartaz em 2 versões (cada uma com o próprio QR, para saber qual traz mais check-ins) e o cartão do garçom. As chamadas vêm da IA (ou do
          texto modelo, quando ela não responde) e você pode editar; o benefício e os números vêm das regras.
        </p>
      </header>
      <KitManager initial={kit} restaurantName={cur.name} qrs={qrs} />
    </main>
  );
}
