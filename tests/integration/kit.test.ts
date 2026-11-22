import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/src/db/client";
import { kitPieces, ownerEdits, pieceVariants, restaurants, scans } from "@/src/db/schema";
import type { AiGateway } from "@/src/modules/ia/gateway";
import { approvePiece, editRecado, editVersionField, generateKit, getKit, markInSalon, newKitVersion, reviewKit } from "@/src/modules/kit/application/kit";
import { getRestaurantPage } from "@/src/modules/salao/application/queries";
import { createRestaurant, resetDb } from "./helpers/db";
import { setFlag } from "@/src/modules/config/application/app-config";

const NOW = new Date("2026-11-21T15:00:00Z");
const good: AiGateway = {
  async generate() {
    return {
      output: { A: { titulo: "Check-in vale {beneficio}", subtitulo: "Leia o QR e mostre o código ao garçom.", acao: "Leia o QR" }, B: { titulo: "Seu {beneficio} te espera", subtitulo: "Junte selos e ganhe {recompensa}.", acao: "Aponte a câmera" }, recado: "Que bom ter você aqui!" },
      usage: { inTokens: 10, outTokens: 10 },
      model: "fake",
    };
  },
};

describe("kit (Postgres)", () => {
  // O kit da S3: 3 peças e o cartão do garçom apontando para o Portal. Porta-conta e link do garçom (ligados por
  // padrão desde a S9) ficam desligados aqui; o porta-conta tem o teste próprio em porta-conta.test.ts.
  beforeEach(async () => {
    await resetDb();
    await setFlag(getDb(), "porta_conta", false);
    await setFlag(getDb(), "modo_garcom", false);
  });
  afterAll(closeDb);

  it("gera 3 peças (display e cartaz A/B, cartão do garçom) com textos da IA; 2ª geração não duplica", async () => {
    const r = await createRestaurant({ pieces: [] });
    await getDb().update(restaurants).set({ recado: null }).where(eq(restaurants.id, r.restaurantId));
    await setFlag(getDb(), "revisor", false); // o revisor tem teste próprio abaixo
    const [a, b] = await Promise.all([generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: good }), generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: good })]);
    expect([a, b].filter((x) => x.ok && x.created)).toHaveLength(1);
    const k = (await getKit(getDb(), r.restaurantId, NOW))!;
    expect(k.pieces.map((p) => [p.kind, p.variants.length])).toEqual([["display", 2], ["cartaz", 2], ["garcom", 1]]);
    expect(k.origem).toBe("ia");
    expect(k.pieces[0]!.variants[0]!.rendered.titulo).toBe("Check-in vale Panna cotta grátis");
    expect(k.pieces[2]!.variants[0]!.rendered.frase).toBe("Na 1ª visita, quem faz check-in pelo QR da mesa ganha Panna cotta grátis. Peça ao cliente o código do benefício e valide no Portal.");
    // S9 (M4): o recado da IA espera a aprovação da peça; o dono já o vê no kit.
    const recadoNow = async () => (await getDb().select({ recado: restaurants.recado }).from(restaurants).where(eq(restaurants.id, r.restaurantId)))[0]!.recado;
    expect(await recadoNow()).toBeNull();
    expect(k.recado).toBe("Que bom ter você aqui!");
    expect(k.recadoPendente).toBe(true);
    expect(await approvePiece(getDb(), { restaurantId: r.restaurantId, pieceId: k.pieces[2]!.id, now: NOW })).toBe(true); // cartão do garçom não publica
    expect(await recadoNow()).toBeNull();
    expect(await approvePiece(getDb(), { restaurantId: r.restaurantId, pieceId: k.pieces[0]!.id, now: NOW })).toBe(true);
    expect(await recadoNow()).toBe("Que bom ter você aqui!");
    expect((await getKit(getDb(), r.restaurantId, NOW))!.recadoPendente).toBe(false);
    const tokens = (await getDb().select({ t: pieceVariants.qrToken }).from(pieceVariants).where(eq(pieceVariants.restaurantId, r.restaurantId))).map((x) => x.t);
    expect(new Set(tokens).size).toBe(5);
  });

  it("IA cita o item do convite → guard reprova → modelo sem IA", async () => {
    const r = await createRestaurant({ pieces: [] });
    const leaky: AiGateway = { async generate() { return { output: { A: { titulo: "Volte na terça à tarde", subtitulo: "x", acao: "y" }, B: { titulo: "a", subtitulo: "b", acao: "c" }, recado: "z" }, usage: { inTokens: 1, outTokens: 1 }, model: "fake" }; } };
    await generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: leaky });
    const k = (await getKit(getDb(), r.restaurantId, NOW))!;
    expect(k.origem).toBe("sem_ia");
    expect(JSON.stringify(k.pieces.map((p) => p.variants.map((v) => v.rendered)))).not.toMatch(/Cannoli|terça|tarde|convite/);
  });

  it("editar campo vale para display e cartaz da mesma versão; 'no salão' só depois de aprovar", async () => {
    const r = await createRestaurant({ pieces: [] });
    await generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: null });
    expect(await editVersionField(getDb(), { restaurantId: r.restaurantId, label: "B", field: "titulo", value: "Ganhe 2 doces hoje!", now: NOW })).toMatchObject({ ok: true, warnings: ["numero"] });
    expect(await editVersionField(getDb(), { restaurantId: r.restaurantId, label: "B", field: "titulo", value: "Ligue 11 99999-0000", now: NOW })).toMatchObject({ ok: false, erro: "texto" });
    // Holdout (revisão da S2): dia/turno no texto do dono é aviso, não bloqueio.
    expect(await editRecado(getDb(), { restaurantId: r.restaurantId, value: "Volte na terça à tarde!", now: NOW })).toMatchObject({ ok: true, warnings: expect.arrayContaining(["convite"]) });
    expect(await editVersionField(getDb(), { restaurantId: r.restaurantId, label: "B", field: "titulo", value: "Ganhe 2 doces hoje!", now: NOW })).toMatchObject({ ok: true });
    const k = (await getKit(getDb(), r.restaurantId, NOW))!;
    expect(k.pieces.filter((p) => p.kind !== "garcom").map((p) => p.variants.find((v) => v.label === "B")!.rendered.titulo)).toEqual(["Ganhe 2 doces hoje!", "Ganhe 2 doces hoje!"]);
    const display = k.pieces[0]!;
    expect(await markInSalon(getDb(), { restaurantId: r.restaurantId, pieceId: display.id, on: true, now: NOW })).toEqual({ ok: false, erro: "nao_aprovada" });
    expect(await approvePiece(getDb(), { restaurantId: r.restaurantId, pieceId: display.id, now: NOW })).toBe(true);
    expect(await markInSalon(getDb(), { restaurantId: r.restaurantId, pieceId: display.id, on: true, now: NOW })).toEqual({ ok: true });
    const [row] = await getDb().select().from(kitPieces).where(eq(kitPieces.id, display.id));
    expect(row!.status).toBe("no_salao");
    // outro restaurante não aprova peça alheia
    const other = await createRestaurant();
    expect(await approvePiece(getDb(), { restaurantId: other.restaurantId, pieceId: display.id, now: NOW })).toBe(false);
  });

  it("versão com leituras: texto travado; 'Criar nova versão' aposenta a antiga (QR segue valendo) e libera a edição", async () => {
    const r = await createRestaurant({ pieces: [] });
    await generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: null });
    expect(await newKitVersion(getDb(), { restaurantId: r.restaurantId, label: "A", now: NOW })).toEqual({ ok: false, erro: "sem_leituras" });
    const k0 = (await getKit(getDb(), r.restaurantId, NOW))!;
    const displayA = k0.pieces.find((p) => p.kind === "display")!.variants.find((v) => v.label === "A")!;
    await getDb().insert(scans).values({ restaurantId: r.restaurantId, variantId: displayA.id, deviceHash: "d1", at: NOW, daySp: "2026-11-21" });
    expect(await editVersionField(getDb(), { restaurantId: r.restaurantId, label: "A", field: "titulo", value: "Outro título", now: NOW })).toEqual({ ok: false, erro: "travado" });
    // A versão B (sem leituras) continua editável.
    expect(await editVersionField(getDb(), { restaurantId: r.restaurantId, label: "B", field: "titulo", value: "Outro título", now: NOW })).toMatchObject({ ok: true });
    const k1 = (await getKit(getDb(), r.restaurantId, NOW))!;
    expect(k1.pieces.find((p) => p.kind === "display")!.variants.find((v) => v.label === "A")).toMatchObject({ scans: 1, locked: true });
    const nv = await newKitVersion(getDb(), { restaurantId: r.restaurantId, label: "A", now: NOW });
    expect(nv).toMatchObject({ ok: true });
    const [old] = await getDb().select().from(pieceVariants).where(eq(pieceVariants.id, displayA.id));
    expect(old!.retiredAt).not.toBeNull();
    const k2 = (await getKit(getDb(), r.restaurantId, NOW))!;
    const newA = k2.pieces.find((p) => p.kind === "display")!.variants.find((v) => v.label === "A")!;
    expect(newA.id).not.toBe(displayA.id);
    expect(newA.token).not.toBe(displayA.token);
    expect(newA).toMatchObject({ locked: false, scans: 0 });
    expect(k2.pieces.find((p) => p.kind === "display")!.variants).toHaveLength(2);
    expect(await editVersionField(getDb(), { restaurantId: r.restaurantId, label: "A", field: "titulo", value: "Outro título", now: NOW })).toMatchObject({ ok: true });
  });

  it("revisor (flag): 'revisando' e 'bloquear' seguram aprovar; texto do dono libera; revisor que falha não bloqueia", async () => {
    await setFlag(getDb(), "revisor", true);
    const block: AiGateway = { generate: async () => ({ output: { veredito: "bloquear", motivos: ["Promete desconto que não está na oferta."] }, usage: { inTokens: 5, outTokens: 5 }, model: "fake-revisor" }) };
    const r = await createRestaurant({ pieces: [] });
    await getDb().update(restaurants).set({ recado: null }).where(eq(restaurants.id, r.restaurantId));
    const jobs: Array<() => Promise<void>> = [];
    await generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: good, reviewerGateway: block, schedule: (fn) => void jobs.push(fn) });
    const k0 = (await getKit(getDb(), r.restaurantId, NOW))!;
    const display = k0.pieces.find((p) => p.kind === "display")!;
    expect(display.variants[0]!.review?.status).toBe("revisando");
    expect(await approvePiece(getDb(), { restaurantId: r.restaurantId, pieceId: display.id, now: NOW })).toBe("revisor");
    await Promise.all(jobs.map((j) => j()));
    const k1 = (await getKit(getDb(), r.restaurantId, NOW))!;
    expect(k1.pieces.find((p) => p.kind === "display")!.variants.map((v) => v.review)).toEqual([expect.objectContaining({ status: "bloquear", reasons: ["Promete desconto que não está na oferta."] }), expect.objectContaining({ status: "bloquear" })]);
    expect(await approvePiece(getDb(), { restaurantId: r.restaurantId, pieceId: display.id, now: new Date(NOW.getTime() + 60_000) })).toBe("revisor");
    // O dono reescreve as duas versões: assume o texto, a revisão deixa de valer.
    for (const label of ["A", "B"] as const) await editVersionField(getDb(), { restaurantId: r.restaurantId, label, field: "titulo", value: "Faça check-in e ganhe {beneficio}", now: NOW });
    expect(await approvePiece(getDb(), { restaurantId: r.restaurantId, pieceId: display.id, now: NOW })).toBe(true);
    // S9 (M4): o recado que o revisor bloqueou nunca chega à página pública, nem depois da aprovação.
    expect((await getDb().select({ recado: restaurants.recado }).from(restaurants).where(eq(restaurants.id, r.restaurantId)))[0]!.recado).toBeNull();
    expect((await getKit(getDb(), r.restaurantId, NOW))!.recado).toBeNull();

    // Revisor indisponível: "não revisado", nada bloqueia.
    const r2 = await createRestaurant({ pieces: [] });
    const down: AiGateway = { generate: async () => Promise.reject(Object.assign(new Error("x"), { kind: "unavailable" })) };
    const jobs2: Array<() => Promise<void>> = [];
    await generateKit(getDb(), { restaurantId: r2.restaurantId, ownerId: r2.ownerId, now: NOW, gateway: good, reviewerGateway: down, schedule: (fn) => void jobs2.push(fn) });
    await Promise.all(jobs2.map((j) => j()));
    const k2 = (await getKit(getDb(), r2.restaurantId, NOW))!;
    const d2 = k2.pieces.find((p) => p.kind === "display")!;
    expect(d2.variants[0]!.review?.status).toBe("nao_revisado");
    expect(await approvePiece(getDb(), { restaurantId: r2.restaurantId, pieceId: d2.id, now: NOW })).toBe(true);
  });
  /** Revisor que devolve um veredito fixo. */
  const verdict = (veredito: "ok" | "atencao" | "bloquear"): AiGateway => ({ generate: async () => ({ output: { veredito, motivos: veredito === "ok" ? [] : ["Motivo."] }, usage: { inTokens: 5, outTokens: 5 }, model: "fake-revisor" }) });
  const publicRecado = async (restaurantId: string) => {
    const [row] = await getDb().select({ slug: restaurants.slug }).from(restaurants).where(eq(restaurants.id, restaurantId));
    return (await getRestaurantPage(getDb(), row!.slug, NOW))!.recado;
  };
  /** Gera o kit com o revisor na fila e reescreve as duas versões enquanto ele roda (a peça deixa de esperar). */
  async function kitEditedWhileReviewing(reviewer: AiGateway) {
    await setFlag(getDb(), "revisor", true);
    const r = await createRestaurant({ pieces: [] });
    await getDb().update(restaurants).set({ recado: null }).where(eq(restaurants.id, r.restaurantId));
    const jobs: Array<() => Promise<void>> = [];
    await generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: good, reviewerGateway: reviewer, schedule: (fn) => void jobs.push(fn) });
    for (const label of ["A", "B"] as const) await editVersionField(getDb(), { restaurantId: r.restaurantId, label, field: "titulo", value: "Faça check-in e ganhe {beneficio}", now: NOW });
    const display = (await getKit(getDb(), r.restaurantId, NOW))!.pieces.find((p) => p.kind === "display")!;
    return { r, display, runReviewer: () => Promise.all(jobs.map((j) => j())) };
  }

  it("S9: recado da IA não escapa da revisão quando o dono edita a peça durante 'revisando'", async () => {
    const { r, display, runReviewer } = await kitEditedWhileReviewing(verdict("bloquear"));
    // A peça foi reescrita pelo dono e pode ser aprovada; o recado da IA ainda espera o revisor.
    expect(await approvePiece(getDb(), { restaurantId: r.restaurantId, pieceId: display.id, now: NOW })).toBe(true);
    expect(await publicRecado(r.restaurantId)).toBeNull();
    expect((await getKit(getDb(), r.restaurantId, NOW))!.recadoPendente).toBe(true);
    await runReviewer();
    expect(await publicRecado(r.restaurantId)).toBeNull();
    const k = (await getKit(getDb(), r.restaurantId, NOW))!;
    expect(k).toMatchObject({ recado: null, recadoPendente: false });
  });

  it("S9: revisor 'ok' depois da aprovação publica o recado; 'atenção' deixa o recado só como sugestão", async () => {
    const ok = await kitEditedWhileReviewing(verdict("ok"));
    await approvePiece(getDb(), { restaurantId: ok.r.restaurantId, pieceId: ok.display.id, now: NOW });
    expect(await publicRecado(ok.r.restaurantId)).toBeNull();
    await ok.runReviewer();
    expect(await publicRecado(ok.r.restaurantId)).toBe("Que bom ter você aqui!");

    const warn = await kitEditedWhileReviewing(verdict("atencao"));
    await warn.runReviewer();
    await approvePiece(getDb(), { restaurantId: warn.r.restaurantId, pieceId: warn.display.id, now: NOW });
    expect(await publicRecado(warn.r.restaurantId)).toBeNull();
    expect((await getKit(getDb(), warn.r.restaurantId, NOW))!).toMatchObject({ recado: "Que bom ter você aqui!", recadoPendente: true, recadoRevisao: "atencao" });
  });

  it("S9: revisor que não responde em 20 s libera o recado na aprovação (não revisado)", async () => {
    const { r, display } = await kitEditedWhileReviewing(verdict("bloquear"));
    await approvePiece(getDb(), { restaurantId: r.restaurantId, pieceId: display.id, now: new Date(NOW.getTime() + 25_000) });
    expect(await publicRecado(r.restaurantId)).toBe("Que bom ter você aqui!");
  });

  it("S9: 'bloquear' retira da página pública o recado da IA já publicado, nunca o do dono", async () => {
    await setFlag(getDb(), "revisor", false);
    const r = await createRestaurant({ pieces: [] });
    await getDb().update(restaurants).set({ recado: null }).where(eq(restaurants.id, r.restaurantId));
    await generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: good });
    const display = (await getKit(getDb(), r.restaurantId, NOW))!.pieces.find((p) => p.kind === "display")!;
    await approvePiece(getDb(), { restaurantId: r.restaurantId, pieceId: display.id, now: NOW });
    expect(await publicRecado(r.restaurantId)).toBe("Que bom ter você aqui!");
    await reviewKit(getDb(), { restaurantId: r.restaurantId, now: NOW, gateway: verdict("bloquear") });
    expect(await publicRecado(r.restaurantId)).toBeNull();

    // O recado do dono fica, mesmo com "bloquear" depois.
    expect(await editRecado(getDb(), { restaurantId: r.restaurantId, value: "Boa refeição.", now: NOW })).toMatchObject({ ok: true });
    await reviewKit(getDb(), { restaurantId: r.restaurantId, now: NOW, gateway: verdict("bloquear") });
    expect(await publicRecado(r.restaurantId)).toBe("Boa refeição.");
  });

  it("S9: editar o recado mede a edição contra o recado pendente da IA", async () => {
    await setFlag(getDb(), "revisor", false);
    const r = await createRestaurant({ pieces: [] });
    await getDb().update(restaurants).set({ recado: null }).where(eq(restaurants.id, r.restaurantId));
    await generateKit(getDb(), { restaurantId: r.restaurantId, ownerId: r.ownerId, now: NOW, gateway: good });
    await editRecado(getDb(), { restaurantId: r.restaurantId, value: "Que bom ter você aqui.", now: NOW });
    const edits = await getDb().select({ suggested: ownerEdits.suggested, final: ownerEdits.final }).from(ownerEdits).where(eq(ownerEdits.restaurantId, r.restaurantId));
    expect(edits.filter((e) => e.final === "Que bom ter você aqui.")).toEqual([{ suggested: "Que bom ter você aqui!", final: "Que bom ter você aqui." }]);
    expect((await getKit(getDb(), r.restaurantId, NOW))!).toMatchObject({ recado: "Que bom ter você aqui.", recadoPendente: false });
  });
});
