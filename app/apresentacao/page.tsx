import type { Metadata } from "next";
import { Presenter } from "@/src/ui/painel/Presenter";
import { requireOwner, storeLabel } from "@/src/web/portal-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo apresentação · Comer Fora no Salão" };

/** Modo apresentação (espec. 3.1, 5; planejamento S3 §4.6): Portal e app lado a lado, ligados ao vivo. Fora de menus. */
export default async function ApresentacaoPage() {
  const s = await requireOwner();
  const stores = s.restaurants.filter((r) => r.status === "ativo" || r.copiedFrom).map((r) => ({ id: r.id, name: r.name, slug: r.slug, label: storeLabel(r) }));
  return <Presenter stores={stores} currentId={s.current?.id ?? stores[0]?.id ?? null} />;
}
