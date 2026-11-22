import { describe, expect, it } from "vitest";
import { numbersIn, toSalonFill, type SalonOut } from "@/src/modules/ia/tasks/salon";

const TEXT = "Cantina da Vila, 12 mesas. Abro de terça a domingo das 11h às 23h. Terça e quarta à tarde, das 15h às 18h, fica muito vazio e quero 4 mesas a mais. Ticket de uns 85 reais.";
const out: SalonOut = {
  nome: "Cantina da Vila",
  mesas: 12,
  clientes_semana: 300, // não está no texto → descartado
  funcionamento: [{ dias: [2, 3, 4, 5, 6, 0], inicio: "11:00", fim: "23:00" }],
  faixas: [{ dias: [2, 3], inicio: "15:00", fim: "18:00", intensidade: "muito", mesas_a_mais: 4 }],
  ticket_reais: 85,
  margem_pct: 60, // inventado → descartado
};

describe("Seu salão por frase (S8 — D265)", () => {
  it("números do texto: algarismos e palavras", () => {
    const n = numbersIn("doze mesas, ticket de 85,50 e 1.200 clientes");
    expect(n.has(12)).toBe(true);
    expect(n.has(85.5)).toBe(true);
    expect(n.has(1200)).toBe(true);
  });
  it("preenche só o que o texto diz; número inventado vira 'não informado'", () => {
    const f = toSalonFill(TEXT, out);
    expect(f.name).toBe("Cantina da Vila");
    expect(f.tables).toBe(12);
    expect(f.weeklyCustomers).toBeNull();
    expect(f.marginPct).toBeNull();
    expect(f.ticketCents).toBe(8500);
    expect(f.opening).toEqual([{ days: [0, 2, 3, 4, 5, 6], startMin: 660, endMin: 1380 }]);
    expect(f.slots).toEqual([{ days: [2, 3], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 4 }]);
    expect(f.naoInformado).toEqual(["clientes por semana", "margem"]);
  });
  it("horário que o texto não cita é descartado", () => {
    const f = toSalonFill("abro de terça a domingo", { ...out, nome: null, mesas: null, ticket_reais: null, faixas: null });
    expect(f.opening).toBeNull();
  });
});
