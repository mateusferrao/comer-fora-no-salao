/**
 * Fixtures da T3 (D137): 5 cenários fictícios. 3 cardápios de exemplo (1º plano, só fatos declarados), a vitrine
 * (plano da semana com veredito do código) e 1 borda (cardápio pequeno, 1 faixa). Faixas e fatos [C], fictícios.
 */
import { readFileSync } from "node:fs";
import type { MenuItem, MenuCategory } from "@/src/modules/beneficios/domain/menu";
import type { Slot } from "@/src/modules/beneficios/domain/slots";
import type { LearnedInput } from "@/src/modules/ia/tasks/package";

export type Fixture = {
  id: string;
  nota: string;
  restaurantName: string;
  cuisine: string;
  menu: MenuItem[];
  slots: Slot[];
  declared: { tables: number; weeklyCustomers: number; ticketCents: number; marginPct: number | null };
  extraFacts?: Record<string, number | string>;
  learned?: LearnedInput[];
  exclude: string[];
};

function menuFrom(id: string): MenuItem[] {
  const g = JSON.parse(readFileSync(`eval/cardapios/${id}.gabarito.json`, "utf8")) as { itens: Array<{ categoria: MenuCategory; nome: string; precoCentavos: number }> };
  return g.itens.map((i, k) => ({ id: `${id}-${k + 1}`, category: i.categoria, name: i.nome, priceCents: i.precoCentavos }));
}
const firstOf = (m: MenuItem[], c: MenuCategory) => m.find((i) => i.category === c)?.id;

const boteco = menuFrom("boteco");
const burger = menuFrom("burger");
const sushi = menuFrom("sushi");

const VITRINE: MenuItem[] = [
  ["entrada", "Bruschetta", 2600],
  ["entrada", "Burrata com tomate", 4200],
  ["porcao", "Fritto misto", 4800],
  ["porcao", "Arancini", 3200],
  ["porcao", "Polpette ao sugo", 3600],
  ["prato", "Spaghetti à carbonara", 6200],
  ["prato", "Lasanha à bolonhesa", 6400],
  ["sobremesa", "Panna cotta", 1800],
  ["sobremesa", "Cannoli", 2200],
  ["sobremesa", "Tiramisù", 2600],
  ["sobremesa", "Gelato artesanal", 1600],
  ["bebida", "Soda italiana", 1600],
  ["bebida", "Limonada siciliana", 1400],
  ["bebida", "Taça de vinho da casa", 2800],
].map(([c, n, p], k) => ({ id: `vit-${k + 1}`, category: c as MenuCategory, name: n as string, priceCents: p as number }));

export const FIXTURES: Fixture[] = [
  {
    id: "boteco",
    nota: "boteco, tarde vazia de semana e domingo à noite",
    restaurantName: "Boteco do Seu Zé",
    cuisine: "Brasileira",
    menu: boteco,
    slots: [
      { id: "bot-tarde", days: [1, 2, 3], startMin: 15 * 60, endMin: 18 * 60, intensity: "muito", extraTables: 3 },
      { id: "bot-dom", days: [0], startMin: 18 * 60, endMin: 22 * 60, intensity: "um_pouco", extraTables: 2 },
    ],
    declared: { tables: 14, weeklyCustomers: 350, ticketCents: 7000, marginPct: 60 },
    exclude: [firstOf(boteco, "sobremesa"), firstOf(boteco, "entrada")].filter((x): x is string => !!x),
  },
  {
    id: "burger",
    nota: "hamburgueria, almoço de terça a quinta vazio",
    restaurantName: "Burger da Esquina",
    cuisine: "Hamburgueria",
    menu: burger,
    slots: [{ id: "bur-almoco", days: [2, 3, 4], startMin: 11 * 60 + 30, endMin: 14 * 60 + 30, intensity: "muito", extraTables: 4 }],
    declared: { tables: 18, weeklyCustomers: 500, ticketCents: 6500, marginPct: null },
    exclude: [firstOf(burger, "sobremesa"), firstOf(burger, "bebida")].filter((x): x is string => !!x),
  },
  {
    id: "sushi",
    nota: "japonês, segunda e terça à noite vazias",
    restaurantName: "Sushi Kaze",
    cuisine: "Japonesa",
    menu: sushi,
    slots: [{ id: "sus-noite", days: [1, 2], startMin: 19 * 60, endMin: 22 * 60, intensity: "muito", extraTables: 3 }],
    declared: { tables: 12, weeklyCustomers: 280, ticketCents: 12000, marginPct: 55 },
    exclude: [firstOf(sushi, "sobremesa"), firstOf(sushi, "entrada")].filter((x): x is string => !!x),
  },
  {
    id: "vitrine",
    nota: "cantina com histórico: plano da semana com veredito do código",
    restaurantName: "Cantina Nonna Lúcia",
    cuisine: "Italiana",
    menu: VITRINE,
    slots: [
      { id: "vit-A", days: [2, 3, 4], startMin: 15 * 60, endMin: 18 * 60, intensity: "muito", extraTables: 85 },
      { id: "vit-B", days: [1, 2, 3], startMin: 21 * 60, endMin: 23 * 60, intensity: "um_pouco", extraTables: 40 },
    ],
    declared: { tables: 30, weeklyCustomers: 900, ticketCents: 8500, marginPct: 65 },
    extraFacts: { checkins_30d: 1612, uso7d_A_pct: 13, convites7d_A: 1146, uso7d_B_pct: 9, convites7d_B: 80, segmento_sumiu: 570, segmento_perto: 120, turno_pouco_1: "segunda à tarde" },
    learned: [
      { key: "vit-A:v1", slotId: "vit-A", verdict: "trocar", gain: "Cannoli grátis", title: "Doce grátis" },
      { key: "vit-B:v2", slotId: "vit-B", verdict: "trocar", gain: "Arancini grátis", title: "Entrada grátis" },
    ],
    exclude: ["vit-8", "vit-10"],
  },
  {
    id: "borda",
    nota: "borda: cardápio pequeno (5 itens), 1 faixa de café da tarde",
    restaurantName: "Café Miúdo",
    cuisine: "Café",
    menu: [
      { id: "b-1", category: "bebida", name: "Café coado", priceCents: 900 },
      { id: "b-2", category: "bebida", name: "Cappuccino", priceCents: 1400 },
      { id: "b-3", category: "sobremesa", name: "Bolo de cenoura", priceCents: 1200 },
      { id: "b-4", category: "sobremesa", name: "Pão de queijo (porção)", priceCents: 1600 },
      { id: "b-5", category: "prato", name: "Misto quente", priceCents: 1800 },
    ],
    slots: [{ id: "caf-tarde", days: [1, 2, 3, 4, 5], startMin: 14 * 60, endMin: 17 * 60, intensity: "muito", extraTables: 2 }],
    declared: { tables: 6, weeklyCustomers: 150, ticketCents: 3000, marginPct: 70 },
    exclude: ["b-1"],
  },
];
