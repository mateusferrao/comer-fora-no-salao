import { describe, expect, it } from "vitest";
import { formatDistance, gpsStatusFromDistance, haversineMeters } from "@/src/modules/salao/domain/geo";
import { isBot, shouldCountScan } from "@/src/modules/salao/domain/scan-dedupe";
import { formatPhone, isPhoneFormat, phoneDigits } from "@/src/modules/salao/domain/phone";
import { fictitiousIdentity } from "@/src/modules/salao/domain/fictitious-identity";
import { mulberry32 } from "@/src/shared/rng";

describe("GPS", () => {
  it("300 m → perto; 301 m → longe", () => {
    expect(gpsStatusFromDistance(300)).toBe("perto");
    expect(gpsStatusFromDistance(301)).toBe("longe");
  });
  it("haversine com valor conhecido (~1 km por 0,009° de latitude)", () => {
    const d = haversineMeters({ lat: -23.56, lng: -46.65 }, { lat: -23.569, lng: -46.65 });
    expect(d).toBeGreaterThan(990);
    expect(d).toBeLessThan(1010);
  });
  it("distância formatada e escondida acima de 5 km", () => {
    expect(formatDistance(379)).toBe("379 m");
    expect(formatDistance(1234)).toBe("1,2 km");
    expect(formatDistance(5001)).toBeNull();
  });
});

describe("leituras do QR", () => {
  it("mesmo aparelho e versão: 29 min = 1 leitura; 31 min = 2", () => {
    const t0 = new Date("2026-11-23T20:00:00Z");
    expect(shouldCountScan(t0, new Date(t0.getTime() + 29 * 60_000))).toBe(false);
    expect(shouldCountScan(t0, new Date(t0.getTime() + 31 * 60_000))).toBe(true);
    expect(shouldCountScan(null, t0)).toBe(true);
  });
  it("robôs de prévia de link são ignorados", () => {
    for (const ua of [
      "WhatsApp/2.23.20.0 A",
      "facebookexternalhit/1.1",
      "Slackbot-LinkExpanding 1.0",
      "TelegramBot (like TwitterBot)",
      "Twitterbot/1.0",
      "LinkedInBot/1.0",
      "Mozilla/5.0 (compatible; Discordbot/2.0)",
      "Mozilla/5.0 (compatible; Googlebot/2.1)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
    ]) expect(isBot(ua)).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148 Safari/604.1")).toBe(false);
    expect(isBot("Mozilla/5.0 HeadlessChrome/140.0")).toBe(false);
  });
});

describe("telefone e identidade fictícia", () => {
  it("aceita qualquer número no formato (D106)", () => {
    expect(isPhoneFormat("(00) 91234-5678")).toBe(true);
    expect(isPhoneFormat("(11) 98765-4321")).toBe(true);
    expect(isPhoneFormat("11987654321")).toBe(false);
    expect(isPhoneFormat("(11) 8765-4321")).toBe(false);
    expect(phoneDigits("(00) 91234-5678")).toBe("00912345678");
    expect(formatPhone("00912345678")).toBe("(00) 91234-5678");
  });
  it("gera nome e telefone fictícios com DDD 00", () => {
    const id = fictitiousIdentity(mulberry32(3));
    expect(id.name).toMatch(/^\S+ \S+/);
    expect(id.phone).toMatch(/^\(00\) 9\d{4}-\d{4}$/);
  });
});

import { maskPhone } from "@/src/modules/salao/domain/phone";
describe("máscara do telefone", () => {
  it("formata enquanto digita", () => {
    expect(maskPhone("0")).toBe("(0");
    expect(maskPhone("0091")).toBe("(00) 91");
    expect(maskPhone("00912345678")).toBe("(00) 91234-5678");
    expect(maskPhone("(00) 91234-56789")).toBe("(00) 91234-5678");
  });
});
