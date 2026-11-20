import { notFound } from "next/navigation";
import { getDb } from "@/src/db/client";
import { getRestaurantPage } from "@/src/modules/salao/application/queries";
import { RestaurantView } from "./RestaurantView";

export const dynamic = "force-dynamic";

/** Página do restaurante aberta pelo QR (`/r/<slug>?p=<token>`) — espec. 3.5.1. */
export default async function RestaurantPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ p?: string }> }) {
  const { slug } = await params;
  const { p } = await searchParams;
  const page = await getRestaurantPage(getDb(), slug, new Date());
  if (!page) notFound();
  return <RestaurantView page={page} token={typeof p === "string" ? p.slice(0, 64) : undefined} />;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getRestaurantPage(getDb(), slug, new Date());
  return { title: page ? `${page.name} · Comer Fora (protótipo)` : "Restaurante não encontrado" };
}
