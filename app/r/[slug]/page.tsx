import { cache } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { getRestaurantPage, recentCheckinCount, SOCIAL_PROOF_MIN } from "@/src/modules/salao/application/queries";
import { RestaurantView } from "./RestaurantView";

export const dynamic = "force-dynamic";

// `generateMetadata` e a página pedem o mesmo restaurante: 1 consulta por requisição.
const load = cache((slug: string) => getRestaurantPage(getDb(), slug, new Date()));

/** Página do restaurante aberta pelo QR (`/r/<slug>?p=<token>`) — espec. 3.5.1; topo de conversão com `copy_v2` (D181). */
export default async function RestaurantPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ p?: string }> }) {
  const { slug } = await params;
  const { p } = await searchParams;
  const page = await load(slug);
  if (!page) notFound();
  const copyV2 = (await getFlags(getDb())).copy_v2;
  const n = copyV2 ? await recentCheckinCount(getDb(), page, new Date()) : 0;
  return <RestaurantView page={page} token={typeof p === "string" ? p.slice(0, 64) : undefined} copyV2={copyV2} recentCheckins={n >= SOCIAL_PROOF_MIN ? n : null} />;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await load(slug);
  return { title: page ? `${page.name} · Comer Fora` : "Restaurante não encontrado" };
}
