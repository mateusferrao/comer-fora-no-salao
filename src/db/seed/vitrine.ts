/**
 * Vitrine (D108): cantina italiana fictícia. Nada aqui é dado real (nome, endereço e coordenada inventados).
 * O recado e a descrição não citam ofertas nem horários do convite (holdout — P-I7).
 */
import type { RestaurantSpec } from "./builder";
import { WAITER_TEMPLATE } from "@/src/modules/kit/domain/templates";

export const VITRINE_SLUG = "cantina-nonna-lucia";
export const VITRINE_OWNER_ID = "00000000-0000-4000-8000-000000000001";
/** Id fixo: o grupo (hash de cliente + restaurante) e a simulação ficam reprodutíveis entre deploys. */
export const VITRINE_ID = "00000000-0000-4000-8000-0000000000a1";
const ALL = [0, 1, 2, 3, 4, 5, 6];

export const VITRINE_TOKENS = ["nl-display-a", "nl-display-b", "nl-cartaz-a", "nl-cartaz-b"] as const;

/** Opções da cópia por conta (D119): outro id, dono, slug e tokens; mesmo conteúdo e mesma simulação. */
export type VitrineOptions = { id?: string; ownerId?: string; slug?: string; tokenSuffix?: string; copy?: boolean };

export function vitrineSpec(activatedAt: Date, o: VitrineOptions = {}): RestaurantSpec {
  const tok = (t: string) => (o.tokenSuffix ? `${t}-${o.tokenSuffix}` : t);
  return {
    owner: o.ownerId ? { id: o.ownerId, kind: "teste" } : { id: VITRINE_OWNER_ID, kind: "demo" },
    id: o.id ?? VITRINE_ID,
    slug: o.slug ?? VITRINE_SLUG,
    ...(o.copy ? { copiedFrom: VITRINE_ID, setupStatus: "criando" } : {}),
    kind: "vitrine",
    name: "Cantina Nonna Lúcia",
    cuisine: "Italiana",
    priceBand: "$$$",
    opening: [{ days: ALL, startMin: 11 * 60, endMin: 23 * 60 + 30 }],
    tables: 40,
    weeklyCustomers: 1400,
    lat: -23.5631,
    lng: -46.6544,
    ticketCents: 8500,
    marginPct: 65,
    description:
      "Cantina de bairro com massas frescas, pizzas de fermentação longa e sobremesas da casa.",
    address: "Rua Nonna Lucia, 120 – São Paulo – SP",
    heroImage: "/fotos/salao.jpg",
    recado: "Massa fresca feita todo dia.",
    protected: !o.copy,
    activatedAt,
    menu: [
      { key: "bruschetta", category: "entrada", name: "Bruschetta", priceCents: 2600 },
      { key: "burrata", category: "entrada", name: "Burrata com tomate", priceCents: 4200 },
      { key: "carpaccio", category: "entrada", name: "Carpaccio", priceCents: 3900 },
      { key: "fritto", category: "porcao", name: "Fritto misto", priceCents: 4800 },
      { key: "arancini", category: "porcao", name: "Arancini", priceCents: 3200 },
      { key: "polpette", category: "porcao", name: "Polpette ao sugo", priceCents: 3600 },
      { key: "carbonara", category: "prato", name: "Spaghetti à carbonara", priceCents: 6200 },
      { key: "lasanha", category: "prato", name: "Lasanha à bolonhesa", priceCents: 6400 },
      { key: "risoto", category: "prato", name: "Risoto de funghi", priceCents: 6800 },
      { key: "margherita", category: "prato", name: "Pizza margherita", priceCents: 5800 },
      { key: "calabresa", category: "prato", name: "Pizza calabresa", priceCents: 5600 },
      { key: "nhoque", category: "prato", name: "Nhoque ao sugo", priceCents: 5200 },
      { key: "panna", category: "sobremesa", name: "Panna cotta", priceCents: 1800 },
      { key: "cannoli", category: "sobremesa", name: "Cannoli", priceCents: 2200 },
      { key: "tiramisu", category: "sobremesa", name: "Tiramisù", priceCents: 2600 },
      { key: "gelato", category: "sobremesa", name: "Gelato artesanal", priceCents: 1600 },
      { key: "soda", category: "bebida", name: "Soda italiana", priceCents: 1600 },
      { key: "limonada", category: "bebida", name: "Limonada siciliana", priceCents: 1400 },
      { key: "agua", category: "bebida", name: "Água com gás", priceCents: 800 },
      { key: "vinho", category: "bebida", name: "Taça de vinho da casa", priceCents: 2800 },
    ],
    agora: { kind: "doce_gratis", item: "panna" },
    recompensa: { kind: "doce_gratis", item: "tiramisu" },
    slots: [
      { key: "A", days: [2, 3, 4], startMin: 15 * 60, endMin: 18 * 60, intensity: "muito", extraTables: 85, convite: { kind: "doce_gratis", item: "cannoli" }, weeklyCap: 340, inviteText: "Volte {horario} e ganhe {oferta}: o doce da casa com o seu café." },
      { key: "B", days: [1, 2, 3], startMin: 21 * 60, endMin: 23 * 60, intensity: "um_pouco", extraTables: 40, convite: { kind: "entrada_gratis", item: "bruschetta" }, weeklyCap: 160, inviteText: "Volte {horario} e ganhe {oferta} para petiscar." },
    ],
    pieces: [
      {
        kind: "display",
        variants: [
          { label: "A", token: tok("nl-display-a"), texts: { titulo: "Ganhe um doce no seu 1º check-in" } },
          { label: "B", token: tok("nl-display-b"), texts: { titulo: "Na 1ª visita, a sobremesa é por conta da casa" } },
        ],
      },
      {
        kind: "cartaz",
        variants: [
          { label: "A", token: tok("nl-cartaz-a"), texts: { titulo: "Na 1ª visita, faça check-in e ganhe um doce" } },
          { label: "B", token: tok("nl-cartaz-b"), texts: { titulo: "Sobremesa por conta da casa no 1º check-in" } },
        ],
      },
      // Revisão S2 #32: a cópia também mostra o cartão do garçom (roteiro fixo, só sobre a 1ª visita).
      { kind: "garcom", variants: [{ label: "A", token: tok("nl-garcom"), texts: { frase: WAITER_TEMPLATE } }] },
    ],
  };
}
