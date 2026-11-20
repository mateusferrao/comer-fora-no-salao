/**
 * Fonte do cardápio: exemplos fictícios com extração em cache (espec. 4.4 — "processado anteriormente")
 * e predefinições do passo 2 para a demo caber em 0:45–2:30 (revisão P-I1). Tudo fictício.
 */
import boteco from "./exemplos/boteco.json";
import burger from "./exemplos/burger.json";
import sushi from "./exemplos/sushi.json";
import type { CleanExtraction } from "../domain/menu-extraction";
import type { OpeningHours } from "@/src/modules/beneficios/domain/slots";

export const EXAMPLE_IDS = ["boteco", "burger", "sushi"] as const;
export type ExampleId = (typeof EXAMPLE_IDS)[number];

export type SalonPreset = {
  name: string;
  tables: number;
  weeklyCustomers: number;
  opening: OpeningHours;
  slots: Array<{ days: number[]; startMin: number; endMin: number; intensity: "muito" | "um_pouco"; extraTables: number }>;
  ticketCents: number;
  marginPct: number;
};

type Cached = { id: string; inputHash: string; model: string; promptVersion: string; extraction: CleanExtraction };

export const EXAMPLES: Record<ExampleId, { label: string; description: string; files: string[]; cached: Cached; preset: SalonPreset }> = {
  boteco: {
    label: "Boteco do Seu Zé",
    description: "Foto de cardápio em papel (bar brasileiro)",
    files: ["/exemplos/boteco.jpg"],
    cached: boteco as Cached,
    preset: {
      name: "Boteco do Seu Zé",
      tables: 22,
      weeklyCustomers: 700,
      opening: [{ days: [1, 2, 3, 4, 5, 6, 0], startMin: 11 * 60, endMin: 23 * 60 }],
      slots: [
        { days: [1, 2, 3], startMin: 15 * 60, endMin: 18 * 60, intensity: "muito", extraTables: 6 },
        { days: [1, 2], startMin: 21 * 60, endMin: 23 * 60, intensity: "um_pouco", extraTables: 3 },
      ],
      ticketCents: 6500,
      marginPct: 60,
    },
  },
  burger: {
    label: "Burger Lab",
    description: "Cardápio impresso de hamburgueria",
    files: ["/exemplos/burger.jpg"],
    cached: burger as Cached,
    preset: {
      name: "Burger Lab",
      tables: 18,
      weeklyCustomers: 600,
      opening: [{ days: [0, 2, 3, 4, 5, 6], startMin: 12 * 60, endMin: 23 * 60 }],
      slots: [
        { days: [2, 3, 4], startMin: 15 * 60, endMin: 18 * 60, intensity: "muito", extraTables: 5 },
        { days: [2, 3], startMin: 21 * 60, endMin: 23 * 60, intensity: "um_pouco", extraTables: 3 },
      ],
      ticketCents: 5500,
      marginPct: 62,
    },
  },
  sushi: {
    label: "Sushi Hanami",
    description: "PDF de 2 páginas (japonês)",
    files: ["/exemplos/sushi-1.jpg", "/exemplos/sushi-2.jpg"],
    cached: sushi as Cached,
    preset: {
      name: "Sushi Hanami",
      tables: 26,
      weeklyCustomers: 800,
      opening: [{ days: [0, 1, 2, 3, 4, 5, 6], startMin: 12 * 60, endMin: 23 * 60 }],
      slots: [
        { days: [1, 2, 3], startMin: 15 * 60, endMin: 18 * 60, intensity: "muito", extraTables: 6 },
        { days: [0, 1], startMin: 20 * 60 + 30, endMin: 23 * 60, intensity: "um_pouco", extraTables: 4 },
      ],
      ticketCents: 11000,
      marginPct: 58,
    },
  },
};

export function isExampleId(x: string): x is ExampleId {
  return (EXAMPLE_IDS as readonly string[]).includes(x);
}
