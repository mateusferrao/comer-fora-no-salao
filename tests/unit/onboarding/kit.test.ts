import { describe, expect, it } from "vitest";
import { buildKitPrompt, kitGuard, resolveKit } from "@/src/modules/ia/tasks/kit";
import { BILL_TEMPLATE, FALLBACK_KIT, INVITE_LINE, sentenceCount, WAITER_TEMPLATE, waiterPhrase } from "@/src/modules/kit/domain/templates";
import { guardText } from "@/src/modules/ia/guardrails";
import { qrUrl } from "@/src/modules/kit/domain/qr";

const menu = [
  { id: "i-panna", category: "sobremesa" as const, name: "Panna cotta", priceCents: 1800 },
  { id: "i-cannoli", category: "sobremesa" as const, name: "Cannoli", priceCents: 2200 },
  { id: "i-pizza4", category: "prato" as const, name: "Pizza 4 queijos", priceCents: 5600 },
];
const kp = buildKitPrompt({ restaurantName: "Cantina", beneficio: "Panna cotta grátis", recompensa: "Tiramisù grátis", menu, inviteItemIds: ["i-cannoli"] });
const good = { A: { titulo: "Faça check-in e ganhe {beneficio}", subtitulo: "Junte selos e ganhe {recompensa}.", acao: "Leia o QR" }, B: { titulo: "Prove {prato:p2}", subtitulo: "Check-in no app, código pro garçom.", acao: "Aponte a câmera" }, recado: "Que bom ter você aqui!" };

describe("kit — holdout protegido (revisão P-I2)", () => {
  it("o item do convite não entra no contexto da IA", () => {
    expect(kp.text).not.toContain("Cannoli");
    expect(kp.text).toContain("{prato:p2} = Pizza 4 queijos");
  });
  it("guard: texto bom passa; dia/turno, convite e número reprovam", () => {
    expect(kitGuard(kp)(good)).toEqual({ ok: true });
    const bad = kitGuard(kp)({ ...good, A: { ...good.A, subtitulo: "Volte na terça à tarde com seu convite" }, recado: "Ganhe 2 doces" });
    expect(bad.ok).toBe(false);
    expect(bad.ok === false && bad.reasons).toEqual(expect.arrayContaining(["A.subtitulo:dia_turno:terca", "A.subtitulo:dia_turno:tarde", "menciona_convite", "recado:numero"]));
  });
  it("apelidos viram ids", () => {
    expect(resolveKit(kp, good).B.titulo).toBe("Prove {prato:i-pizza4}");
  });
  it("modelos sem IA e cartão do garçom passam nas regras; cartão ≤ 2 frases e sem convite", () => {
    const ctx = { beneficio: "Panna cotta grátis", recompensa: "Tiramisù grátis" };
    for (const v of ["A", "B"] as const)
      for (const t of Object.values(FALLBACK_KIT[v])) expect(guardText(t, ctx, { allowed: ["beneficio", "recompensa"], maxLen: 90, field: "kit", mode: "ia", forbidDayTurn: true }).ok).toBe(true);
    expect(sentenceCount(WAITER_TEMPLATE)).toBeLessThanOrEqual(2);
    expect(WAITER_TEMPLATE).not.toMatch(/convite/i);
    expect(INVITE_LINE).not.toMatch(/\d|tarde|noite|segunda|terça/i);
  });
  it("S9: o benefício de agora é sempre da 1ª visita; sem exclamação; porta-conta com 'com 6 selos'", () => {
    expect(WAITER_TEMPLATE).toMatch(/^Na 1ª visita, /);
    expect(FALLBACK_KIT.A.titulo).toMatch(/primeira visita/);
    expect(FALLBACK_KIT.B.titulo).toMatch(/primeiro check-in/);
    expect(Object.values(FALLBACK_KIT).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v))).join(" ")).not.toMatch(/!| no app/);
    expect(BILL_TEMPLATE.subtitulo).toMatch(/com 6 selos/);
    expect(BILL_TEMPLATE.subtitulo).not.toMatch(/6ª/);
  });
  it("S9: cartão do garçom gravado com o texto antigo sai com o texto novo; link do garçom troca o Portal", () => {
    const old = "Hoje, quem faz check-in ganha {beneficio}. Peça o código ao cliente e valide no Portal.";
    expect(waiterPhrase(old, false)).toBe(WAITER_TEMPLATE);
    expect(waiterPhrase(old, true)).toBe(WAITER_TEMPLATE.replace("valide no Portal", "valide no link do garçom"));
    expect(waiterPhrase("Texto do dono.", true)).toBe("Texto do dono.");
  });
  it("QR por versão a partir da URL pública", () => {
    expect(qrUrl("https://exemplo.host/", "cantina-x", "tok-a")).toBe("https://exemplo.host/r/cantina-x?p=tok-a");
  });
});
