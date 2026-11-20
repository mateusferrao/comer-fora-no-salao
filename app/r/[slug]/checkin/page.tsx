import { notFound } from "next/navigation";
import { getDb } from "@/src/db/client";
import { getCustomerHere, getRestaurantPage, getTodayResult } from "@/src/modules/salao/application/queries";
import { readCustomerId } from "@/src/web/customer-session";
import { CheckinFlow } from "./CheckinFlow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check-in · Comer Fora (protótipo)" };

export default async function CheckinPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ p?: string }> }) {
  const { slug } = await params;
  const { p } = await searchParams;
  const db = getDb();
  const now = new Date();
  const page = await getRestaurantPage(db, slug, now);
  if (!page) notFound();
  const customerId = await readCustomerId();
  const here = customerId ? await getCustomerHere(db, page.id, customerId, now) : null;
  const today = here && customerId ? await getTodayResult(db, page.id, customerId, now) : null;
  return <CheckinFlow page={page} identified={Boolean(here)} stamps={here?.stamps ?? 0} initialResult={today} token={typeof p === "string" ? p.slice(0, 64) : undefined} />;
}
