import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/src/db/client";
import { addBillHolder, generateKit, getKit } from "@/src/modules/kit/application/kit";
import { setFlag } from "@/src/modules/config/application/app-config";
import { registerScan } from "@/src/modules/salao/application/register-scan";
import { fixedClock } from "@/src/shared/clock";
import { createRestaurant, resetDb } from "./helpers/db";

const NOW = new Date("2026-11-21T15:00:00Z");

describe("porta-conta (S6.4, D192)", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("flag ligada: kit novo já nasce com o porta-conta (1 versão, texto modelo, QR próprio); sem convite específico", async () => {
    await setFlag(getDb(), "porta_conta", true);
    const r = await createRestaurant({ pieces: [] });
    await generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: null });
    const k = (await getKit(getDb(), r.restaurantId, NOW))!;
    const bill = k.pieces.find((p) => p.kind === "porta_conta")!;
    expect(bill.variants).toHaveLength(1);
    const v = bill.variants[0]!;
    expect(v.rendered).toEqual({
      titulo: "Antes de pagar, faça check-in",
      subtitulo: "Na 1ª visita: Panna cotta grátis. A cada visita, um selo: na 6ª, Tiramisù grátis.",
      acao: "Aponte a câmera para o QR",
    });
    expect(JSON.stringify(v.rendered)).not.toMatch(/Cannoli|terça|tarde/);
    expect(new Set(k.pieces.flatMap((p) => p.variants.map((x) => x.token))).size).toBe(6);
  });

  it("kit antigo: 'Adicionar porta-conta' cria 1 peça (2 cliques ao mesmo tempo = 1); sem kit → erro; leitura conta na peça", async () => {
    // Kit gerado com a flag desligada (ligada por padrão desde a S9).
    await setFlag(getDb(), "porta_conta", false);
    const r = await createRestaurant({ pieces: [] });
    expect(await addBillHolder(getDb(), { restaurantId: r.restaurantId, now: NOW })).toEqual({ ok: false, erro: "sem_kit" });
    await generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: null });
    expect((await getKit(getDb(), r.restaurantId, NOW))!.pieces.some((p) => p.kind === "porta_conta")).toBe(false);
    const res = await Promise.all([addBillHolder(getDb(), { restaurantId: r.restaurantId, now: NOW }), addBillHolder(getDb(), { restaurantId: r.restaurantId, now: NOW })]);
    expect(res.filter((x) => x.ok && x.created)).toHaveLength(1);
    const k = (await getKit(getDb(), r.restaurantId, NOW))!;
    const bills = k.pieces.filter((p) => p.kind === "porta_conta");
    expect(bills).toHaveLength(1);
    const v = bills[0]!.variants[0]!;
    await registerScan(getDb(), { restaurantId: r.restaurantId, variantId: v.id, deviceHash: "dev-pc", userAgent: "Mozilla/5.0", clock: fixedClock(NOW.toISOString()) });
    const k2 = (await getKit(getDb(), r.restaurantId, NOW))!;
    expect(k2.pieces.find((p) => p.kind === "porta_conta")!.variants[0]!.scans).toBe(1);
  });
});
