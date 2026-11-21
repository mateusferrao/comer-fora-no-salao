import { describe, expect, it } from "vitest";
import { nextValidWindow } from "@/src/modules/salao/domain/invite-window";
import { inviteIcs } from "@/src/modules/salao/domain/ics";
import { endOfDaySP, instantSP } from "@/src/shared/tz";

// Faixa Ter–Qui 15h–18h. 24/11/2026 = terça.
const slot = { days: [2, 3, 4], startMin: 900, endMin: 1080 };
const expires = endOfDaySP(instantSP("2026-12-24", 720));

describe("nextValidWindow (S5.2: 1º dia em que o código do convite pode nascer)", () => {
  it("emitido terça 15h30 dentro da faixa → quarta 15h–18h (nunca o dia da emissão)", () => {
    const w = nextValidWindow({ slot, issuedDay: "2026-11-24", expiresAt: expires, now: instantSP("2026-11-24", 930) })!;
    expect(w.day).toBe("2026-11-25");
    expect(w.start.toISOString()).toBe("2026-11-25T18:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-25T21:00:00.000Z");
  });

  it("emitido segunda → terça", () => {
    expect(nextValidWindow({ slot, issuedDay: "2026-11-23", expiresAt: expires, now: instantSP("2026-11-23", 780) })!.day).toBe("2026-11-24");
  });

  it("emitido ontem e agora dentro da faixa de hoje → hoje", () => {
    expect(nextValidWindow({ slot, issuedDay: "2026-11-24", expiresAt: expires, now: instantSP("2026-11-25", 960) })!.day).toBe("2026-11-25");
  });

  it("hoje já passou do fim → próxima ocorrência (quinta), atravessando a semana se preciso", () => {
    expect(nextValidWindow({ slot, issuedDay: "2026-11-24", expiresAt: expires, now: instantSP("2026-11-25", 1100) })!.day).toBe("2026-11-26");
    expect(nextValidWindow({ slot, issuedDay: "2026-11-24", expiresAt: expires, now: instantSP("2026-11-26", 1100) })!.day).toBe("2026-12-01");
  });

  it("a próxima janela começa depois do vencimento → null", () => {
    const soon = endOfDaySP(instantSP("2026-11-25", 720));
    expect(nextValidWindow({ slot, issuedDay: "2026-11-25", expiresAt: soon, now: instantSP("2026-11-25", 930) })).toBeNull();
  });

  it("faixa sem dias → null", () => {
    expect(nextValidWindow({ slot: { ...slot, days: [] }, issuedDay: "2026-11-23", expiresAt: expires, now: instantSP("2026-11-23", 780) })).toBeNull();
  });
});

describe("inviteIcs (RFC 5545, 1 evento — D169)", () => {
  const ics = inviteIcs({
    uid: "3f2a@comer-fora",
    restaurant: "Cantina Nonna Lucia; Pizzaria, Massas",
    address: "Rua Nonna Lucia, 120 – São Paulo – SP",
    gain: "Cannoli grátis",
    window: { start: new Date("2026-11-25T18:00:00Z"), end: new Date("2026-11-25T21:00:00Z") },
    journeyUrl: "https://exemplo.invalid/app/jornada",
    now: new Date("2026-11-24T18:30:00Z"),
  });

  it("estrutura: CRLF, cabeçalho, 1 VEVENT, horários em UTC", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("\r\nMETHOD:PUBLISH\r\n");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("\r\nUID:3f2a@comer-fora\r\n");
    expect(ics).toContain("\r\nDTSTAMP:20261124T183000Z\r\n");
    expect(ics).toContain("\r\nDTSTART:20261125T180000Z\r\n");
    expect(ics).toContain("\r\nDTEND:20261125T210000Z\r\n");
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
  });

  it("escapa vírgula, ponto e vírgula e barra invertida", () => {
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("SUMMARY:Cannoli grátis · Cantina Nonna Lucia\\; Pizzaria\\, Massas");
    expect(unfolded).toContain("LOCATION:Rua Nonna Lucia\\, 120 – São Paulo – SP");
  });

  it("dobra linhas em até 75 octetos sem cortar caracteres UTF-8", () => {
    for (const line of ics.split("\r\n"))
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    const desc = ics
      .replace(/\r\n /g, "")
      .split("\r\n")
      .find((l) => l.startsWith("DESCRIPTION:"))!;
    expect(desc).toContain(
      "Chegando ao restaurante\\, faça check-in no app e mostre ao garçom o código do benefício.",
    );
    expect(desc).toContain("https://exemplo.invalid/app/jornada");
    expect(ics).not.toContain("�");
  });
});
