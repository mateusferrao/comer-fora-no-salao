import { describe, expect, it } from "vitest";
import { listPage, parseListQuery, DEFAULT_QUERY } from "@/src/modules/analytics/domain/customer-list";

const row = (displayName: string, lastDay: string, stamps = 0, piece: string | null = null, email = false) => ({
  displayName,
  firstDay: "2026-10-01",
  lastDay,
  stamps,
  piece,
  optIn: { email, app: false },
});

describe("lista de clientes: busca, ordenação e páginas (ajuste de 21/11)", () => {
  const rows = [row("Ana S.", "2026-11-10", 3, "Display A"), row("Júlia M.", "2026-11-20", 5, null, true), row("Bruno C.", "2026-11-15", 1, "Cartaz A"), row("Álvaro P.", "2026-11-01", 2)];

  it("padrão: última visita mais recente primeiro", () => {
    expect(listPage(rows, DEFAULT_QUERY).items.map((r) => r.displayName)).toEqual(["Júlia M.", "Bruno C.", "Ana S.", "Álvaro P."]);
  });
  it("busca sem acento nem caixa, pelo nome mostrado", () => {
    expect(listPage(rows, { ...DEFAULT_QUERY, q: "julia" }).items.map((r) => r.displayName)).toEqual(["Júlia M."]);
    expect(listPage(rows, { ...DEFAULT_QUERY, q: "ALV" }).total).toBe(1);
    expect(listPage(rows, { ...DEFAULT_QUERY, q: "zzz" })).toMatchObject({ items: [], total: 0, page: 1, pages: 1 });
  });
  it("ordena por coluna nas 2 direções; sem peça fica no fim", () => {
    expect(listPage(rows, { ...DEFAULT_QUERY, sort: "selos", dir: "asc" }).items.map((r) => r.stamps)).toEqual([1, 2, 3, 5]);
    expect(listPage(rows, { ...DEFAULT_QUERY, sort: "selos", dir: "desc" }).items.map((r) => r.stamps)).toEqual([5, 3, 2, 1]);
    expect(listPage(rows, { ...DEFAULT_QUERY, sort: "cliente", dir: "asc" }).items.map((r) => r.displayName)).toEqual(["Álvaro P.", "Ana S.", "Bruno C.", "Júlia M."]);
    expect(listPage(rows, { ...DEFAULT_QUERY, sort: "peca", dir: "desc" }).items.map((r) => r.piece)).toEqual(["Display A", "Cartaz A", null, null]);
    expect(listPage(rows, { ...DEFAULT_QUERY, sort: "optin", dir: "desc" }).items[0]!.displayName).toBe("Júlia M.");
  });
  it("20 por página; página fora do intervalo vai para a última", () => {
    const many = Array.from({ length: 45 }, (_, i) => row(`Cliente ${String(i).padStart(2, "0")}`, `2026-11-${String((i % 28) + 1).padStart(2, "0")}`));
    expect(listPage(many, DEFAULT_QUERY)).toMatchObject({ total: 45, page: 1, pages: 3 });
    expect(listPage(many, { ...DEFAULT_QUERY, page: 3 }).items).toHaveLength(5);
    expect(listPage(many, { ...DEFAULT_QUERY, page: 9 }).page).toBe(3);
  });
  it("URL inválida volta ao padrão; nome e peça começam em ordem crescente", () => {
    expect(parseListQuery({ ordem: "x", pagina: "-2" })).toEqual(DEFAULT_QUERY);
    expect(parseListQuery({ ordem: "cliente" })).toMatchObject({ sort: "cliente", dir: "asc" });
    expect(parseListQuery({ ordem: "selos", dir: "asc", pagina: "2", q: "ana" })).toEqual({ q: "ana", sort: "selos", dir: "asc", page: 2 });
  });
});
