/**
 * Retrato da Cantina usado na T4 do copiloto (S8 — D266) e no teste do portão de escopo (S9): o mesmo do seed
 * (Tiramisù é a recompensa, faixa A = Ter–Qui 15h–18h, faixa B = Seg–Qua 21h–23h, sem horário no sábado).
 */
import type { CopilotInput } from "../src/modules/ia/tasks/copilot";
import type { Snapshot } from "../src/modules/agente/domain/proposals";

export const T4_SNAP: Snapshot = {
  marginPct: 60,
  opening: [{ days: [0, 1, 2, 3, 4, 5, 6], startMin: 11 * 60, endMin: 24 * 60 }],
  agora: { kind: "doce_gratis", itemId: "panna" },
  recompensa: { kind: "doce_gratis", itemId: "tiramisu" },
  slots: [
    { id: "slotA", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 2, offer: { kind: "doce_gratis", itemId: "cannoli" }, weeklyCap: 8, inviteText: "Volte {horario:slotA} e aproveite {oferta}." },
    { id: "slotB", days: [1, 2, 3], startMin: 1260, endMin: 1380, intensity: "um_pouco", extraTables: 1, offer: { kind: "entrada_gratis", itemId: "bruschetta" }, weeklyCap: 4, inviteText: "" },
  ],
  menu: [
    { id: "bruschetta", name: "Bruschetta", category: "entrada", priceCents: 2400, active: true, inUse: true, offerAllowed: true },
    { id: "lasanha", name: "Lasanha à bolonhesa", category: "prato", priceCents: 5800, active: true, inUse: false, offerAllowed: true },
    { id: "nhoque", name: "Nhoque ao sugo", category: "prato", priceCents: 5200, active: true, inUse: false, offerAllowed: true },
    { id: "panna", name: "Panna cotta", category: "sobremesa", priceCents: 1800, active: true, inUse: true, offerAllowed: true },
    { id: "cannoli", name: "Cannoli", category: "sobremesa", priceCents: 2200, active: true, inUse: true, offerAllowed: true },
    { id: "tiramisu", name: "Tiramisù", category: "sobremesa", priceCents: 2600, active: true, inUse: true, offerAllowed: true },
    { id: "gelato", name: "Gelato artesanal", category: "sobremesa", priceCents: 1600, active: true, inUse: false, offerAllowed: true },
    { id: "soda", name: "Soda italiana", category: "bebida", priceCents: 1600, active: true, inUse: false, offerAllowed: true },
  ],
};

export const T4_INPUT: CopilotInput = {
  restaurantName: "Cantina Nonna Lúcia",
  snap: T4_SNAP,
  facts: { checkins_30d: 812, clientes_30d: 540, uso7d_A_pct: 38, convites7d_A: 61, uso7d_B_pct: 22, convites7d_B: 27, segmento_sumiu: 120, segmento_perto: 34, segmento_frequente: 58, ticket_medio: 7800, margem_pct: 60 },
  slotAliases: [
    { alias: "A", slotId: "slotA" },
    { alias: "B", slotId: "slotB" },
  ],
  customers: [
    { alias: "C1", name: "Ana S.", visits: 5, stamps: 5, lastDay: "2026-11-20", segments: ["perto", "frequente"] },
    { alias: "C2", name: "Bruno M.", visits: 1, stamps: 1, lastDay: "2026-10-30", segments: ["sumiu"] },
    { alias: "C3", name: "Carla T.", visits: 5, stamps: 5, lastDay: "2026-11-18", segments: ["perto"] },
  ],
  plan: { id: "plano-1", status: "proposto", slots: [] },
  page: "configuracoes",
};
