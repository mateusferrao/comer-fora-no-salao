import type { Metadata } from "next";
import { getDb } from "@/src/db/client";
import { getSegments } from "@/src/modules/analytics/application/customers";
import { SEGMENTS, type Segment } from "@/src/modules/analytics/domain/segments";
import { CustomersView } from "@/src/ui/painel/CustomersView";
import { requireOwner } from "@/src/web/portal-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes · Comer Fora no salão · Portal do Parceiro" };

/** Clientes como segmentos acionáveis (espec. 3.6; planejamento S3 §4.5). */
export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ segmento?: string }> }) {
  const s = await requireOwner();
  const cur = s.current;
  const sp = await searchParams;
  const seg = (SEGMENTS as readonly string[]).includes(sp.segmento ?? "") ? (sp.segmento as Segment) : "sumiu";
  const data = cur ? await getSegments(getDb(), cur.id, new Date(), seg) : null;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Clientes</h1>
        <p className="text-sm text-ink-muted">Esta base é do seu restaurante. Neste protótipo, use só dados fictícios.</p>
      </header>
      {data ? <CustomersView data={data} /> : <p className="text-sm text-ink">Escolha um restaurante.</p>}
    </main>
  );
}
