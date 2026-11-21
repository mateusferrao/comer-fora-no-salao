/** Restaurante E2E oculto (D109): `teste`, protegido, teto alto, aberto o dia todo, sem simulação. */
import type { RestaurantSpec } from "./builder";

export const E2E_SLUG = "e2e-salao-teste";
export const E2E_OWNER_ID = "00000000-0000-4000-8000-0000000000e2";
const ALL = [0, 1, 2, 3, 4, 5, 6];

export function e2eSpec(activatedAt: Date): RestaurantSpec {
  return {
    owner: { id: E2E_OWNER_ID, kind: "teste" },
    slug: E2E_SLUG,
    kind: "teste",
    name: "Restaurante E2E (teste)",
    cuisine: "Italiana",
    priceBand: "$$",
    opening: [{ days: ALL, startMin: 0, endMin: 1440 }],
    lat: -23.5631,
    lng: -46.6544,
    description: "Restaurante fictício usado só pelos testes automáticos.",
    address: "Rua de Teste, 0 – São Paulo – SP",
    heroImage: "/fotos/salao.jpg",
    recado: "Restaurante de teste.",
    protected: true,
    activatedAt,
    menu: [
      { key: "panna", category: "sobremesa", name: "Panna cotta", priceCents: 1800 },
      { key: "cannoli", category: "sobremesa", name: "Cannoli", priceCents: 2200 },
      { key: "tiramisu", category: "sobremesa", name: "Tiramisù", priceCents: 2600 },
    ],
    agora: { kind: "doce_gratis", item: "panna" },
    recompensa: { kind: "doce_gratis", item: "tiramisu" },
    slots: [{ key: "T", days: ALL, startMin: 0, endMin: 1440, intensity: "muito", extraTables: 250_000, convite: { kind: "doce_gratis", item: "cannoli" }, weeklyCap: 1_000_000 }],
    pieces: [{ kind: "display", variants: [{ label: "A", token: "e2e-display-a", texts: { titulo: "Teste" } }] }],
  };
}
