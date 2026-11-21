import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { kitPieces, pieceVariants, restaurants } from "@/src/db/schema";
import { getKit } from "@/src/modules/kit/application/kit";
import { qrUrl } from "@/src/modules/kit/domain/qr";
import { BillHolder, KitPiece, WaiterCard } from "@/src/ui/kit/KitPiece";
import { PrintToolbar } from "@/src/ui/kit/PrintToolbar";
import { getOwnerSession } from "@/src/web/owner-session";
import { publicBaseUrl, qrDataUri } from "@/src/web/qr";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Imprimir peça · Portal do Parceiro" };

/** Página de impressão por peça no tamanho certo (espec. 3.4): A5, A4 ou 4 cartões do garçom por A4. */
export default async function ImprimirPage({ params }: { params: Promise<{ variantId: string }> }) {
  const s = await getOwnerSession();
  if (!s) redirect("/parceiro/entrar");
  const { variantId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(variantId)) notFound();
  const db = getDb();
  const [row] = await db
    .select({ restaurantId: restaurants.id, name: restaurants.name, slug: restaurants.slug, kind: kitPieces.kind })
    .from(pieceVariants)
    .innerJoin(kitPieces, eq(kitPieces.id, pieceVariants.pieceId))
    .innerJoin(restaurants, eq(restaurants.id, pieceVariants.restaurantId))
    .where(and(eq(pieceVariants.id, variantId), eq(restaurants.ownerId, s.owner.id)));
  if (!row) notFound();
  const kit = (await getKit(db, row.restaurantId, new Date()))!;
  const variant = kit.pieces.flatMap((p) => p.variants.map((v) => ({ ...v, kind: p.kind }))).find((v) => v.id === variantId);
  // Versão aposentada ("Criar nova versão") não se imprime mais: o QR dela segue valendo, mas a peça nova é outra.
  if (!variant) notFound();
  // Revisor (flag): texto bloqueado ou ainda em revisão não vai para o papel.
  if (variant.review?.status === "bloquear" || variant.review?.status === "revisando") {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-10">
        <h1 className="text-xl font-bold text-ink">{variant.review.status === "revisando" ? "O revisor ainda está conferindo este texto" : "O revisor pediu ajustes neste texto"}</h1>
        {variant.review.reasons.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-ink">
            {variant.review.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        <p className="text-sm text-ink-muted">{variant.review.status === "revisando" ? "Leva poucos segundos. Atualize a página." : "Edite o texto no Kit (o seu texto libera a impressão) e volte aqui."}</p>
        <a className="text-sm font-semibold text-red-text underline" href="/parceiro/salao/kit">
          Voltar ao Kit
        </a>
      </main>
    );
  }
  const page = row.kind === "cartaz" ? "A4 portrait" : row.kind === "display" ? "A5 portrait" : "A4 portrait";
  return (
    <main className="flex flex-col items-center gap-4 bg-page py-6 print:bg-white print:p-0">
      <style>{`@page { size: ${page}; margin: 0 } @media print { body { background: #fff } }`}</style>
      <PrintToolbar kind={row.kind as "display" | "cartaz" | "garcom" | "porta_conta"} />
      <div className="shadow-medium print:shadow-none">
        {row.kind === "porta_conta" ? (
          <div className="flex flex-col bg-white" style={{ width: "210mm" }}>
            {await (async () => {
              const qr = await qrDataUri(qrUrl(publicBaseUrl(), row.slug, variant.token));
              return [0, 1, 2].map((i) => <BillHolder key={i} restaurantName={row.name} qrSrc={qr} texts={{ titulo: variant.rendered.titulo ?? "", subtitulo: variant.rendered.subtitulo ?? "", acao: variant.rendered.acao ?? "" }} />);
            })()}
          </div>
        ) : row.kind === "garcom" ? (
          <div className="grid grid-cols-2 bg-white" style={{ width: "210mm" }}>
            {[0, 1, 2, 3].map((i) => (
              <WaiterCard key={i} restaurantName={row.name} frase={variant.rendered.frase ?? ""} />
            ))}
          </div>
        ) : (
          <KitPiece
            kind={row.kind as "display" | "cartaz"}
            restaurantName={row.name}
            versionLabel={variant.label}
            texts={{ titulo: variant.rendered.titulo ?? "", subtitulo: variant.rendered.subtitulo ?? "", acao: variant.rendered.acao ?? "" }}
            qrSrc={await qrDataUri(qrUrl(publicBaseUrl(), row.slug, variant.token))}
          />
        )}
      </div>
    </main>
  );
}
