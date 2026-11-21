import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { idleSlots, menuExtractions, menuItems } from "@/src/db/schema";
import { EXAMPLES, EXAMPLE_IDS } from "@/src/modules/onboarding/adapters/example-source";
import { getExtraction } from "@/src/modules/onboarding/application/extract-menu";
import { getPackageView, type PackageView } from "@/src/modules/onboarding/application/package";
import { openingHoursSchema } from "@/src/modules/beneficios/domain/slots";
import { addDaysSP } from "@/src/shared/week";
import { daySP } from "@/src/shared/tz";
import { Stepper } from "@/src/ui/components/Stepper";
import { Step1Cardapio } from "@/src/ui/portal/wizard/Step1Cardapio";
import { Step2Salao, type SalonForm } from "@/src/ui/portal/wizard/Step2Salao";
import { Step3Revisao } from "@/src/ui/portal/wizard/Step3Revisao";
import { Step4Pacote } from "@/src/ui/portal/wizard/Step4Pacote";
import { Step5Resumo } from "@/src/ui/portal/wizard/Step5Resumo";
import type { ExtractionState } from "@/src/ui/portal/wizard/ExtractionStatus";
import { requireOwner } from "@/src/web/portal-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ativar Comer Fora no salão · Portal do Parceiro" };

const STEPS = ["Cardápio", "Seu salão", "Revisão do cardápio", "Pacote proposto", "Resumo e ativar"];

export default async function PassoPage({ params, searchParams }: { params: Promise<{ passo: string }>; searchParams: Promise<{ manual?: string }> }) {
  const { passo } = await params;
  // S6.3a (D197): "Digitar o cardápio" — sem leitura de IA; a extração antiga não entra (nem na métrica de leitura).
  const manual = (await searchParams).manual === "1";
  const step = Number(passo);
  if (!Number.isInteger(step) || step < 1 || step > 5) notFound();
  const s = await requireOwner();
  const cur = s.current;
  if (!cur || cur.kind !== "teste") redirect("/parceiro/salao");
  if (cur.status === "ativo") redirect("/parceiro/salao/kit");
  const db = getDb();
  const now = new Date();

  const [lastExt] = await db.select({ id: menuExtractions.id }).from(menuExtractions).where(eq(menuExtractions.restaurantId, cur.id)).orderBy(desc(menuExtractions.startedAt)).limit(1);
  const ext = lastExt ? await getExtraction(db, cur.id, lastExt.id, now) : null;
  const extState: ExtractionState | null = ext
    ? { status: ext.status, count: ext.result?.itens?.length, parcial: ext.result?.parcial, cache: ext.result?.cache }
    : null;

  let body: React.ReactNode;
  if (step === 1) {
    body = <Step1Cardapio examples={EXAMPLE_IDS.map((id) => ({ id, label: EXAMPLES[id].label, description: EXAMPLES[id].description, thumb: EXAMPLES[id].files[0]! }))} />;
  } else if (step === 2) {
    const slots = await db.select().from(idleSlots).where(and(eq(idleSlots.restaurantId, cur.id), eq(idleSlots.active, true))).orderBy(asc(idleSlots.position));
    const opening = openingHoursSchema.safeParse(cur.openingHours);
    // Exemplo escolhido no passo 1 → passo 2 pré-preenchido com o salão fictício dele (revisão P-I1: a demo cabe no tempo).
    const exampleRow = ext?.source === "exemplo" ? (await db.select({ h: menuExtractions.inputHash }).from(menuExtractions).where(eq(menuExtractions.id, ext.id)))[0] : undefined;
    const preset = EXAMPLE_IDS.map((id) => EXAMPLES[id]).find((e) => e.cached.inputHash === exampleRow?.h)?.preset;
    const initial: SalonForm =
      slots.length && opening.success
        ? {
            name: cur.name,
            tables: cur.tables ?? 10,
            weeklyCustomers: cur.weeklyCustomers,
            opening: opening.data,
            slots: slots.map((x) => ({ id: x.id, days: x.days, startMin: x.startMin, endMin: x.endMin, intensity: x.intensity as "muito" | "um_pouco", extraTables: x.extraTables })),
            ticketCents: cur.ticketCents,
            marginPct: cur.marginPct,
          }
        : preset
          ? { ...preset }
          : {
              name: cur.name === "Meu restaurante" ? "" : cur.name,
              // Sem exemplo: nada inventado — o dono escolhe mesas e os dias vazios (revisão da S2).
              tables: 0,
              weeklyCustomers: null,
              opening: [{ days: [0, 1, 2, 3, 4, 5, 6], startMin: 11 * 60, endMin: 23 * 60 }],
              slots: [{ days: [], startMin: 15 * 60, endMin: 18 * 60, intensity: "muito", extraTables: 4 }],
              ticketCents: null,
              marginPct: null,
            };
    body = <Step2Salao initial={initial} extractionId={manual ? null : (ext?.id ?? null)} extraction={manual ? null : extState} manual={manual} assistente={(await getFlags(db)).copiloto} />;
  } else if (step === 3) {
    const items = await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, cur.id), eq(menuItems.active, true))).orderBy(asc(menuItems.position));
    body = (
      <Step3Revisao
        extractionId={manual ? null : (ext?.id ?? null)}
        extraction={manual ? null : extState}
        manual={manual}
        initial={{ rows: items.length ? items.map((i) => ({ categoria: i.category as never, nome: i.name, precoCentavos: i.priceCents })) : ext && !manual ? null : [], cuisine: cur.cuisine, priceBand: cur.priceBand }}
      />
    );
  } else if (step === 4) {
    body = <Step4Pacote explicaIa={(await getFlags(db)).explica_ia} />;
  } else {
    const v = await getPackageView(db, cur.id, now);
    if (!v || !("slots" in v)) redirect("/parceiro/salao/ativar/4");
    body = <Step5Resumo view={v as PackageView} slug={cur.slug} todayPlus30={addDaysSP(daySP(now), 30)} />;
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-ink">Ativar Comer Fora no salão</h1>
        <Stepper steps={STEPS} current={step} hrefFor={(n) => `/parceiro/salao/ativar/${n}${manual && (n === 2 || n === 3) ? "?manual=1" : ""}`} />
      </header>
      {body}
      {step > 1 && (
        <Link href={`/parceiro/salao/ativar/${step - 1}${manual && step - 1 === 2 ? "?manual=1" : ""}`} className="min-h-11 self-start py-2 text-sm font-semibold text-red-text underline">
          ← Voltar para {STEPS[step - 2]}
        </Link>
      )}
    </main>
  );
}
