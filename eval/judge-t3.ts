/** Juiz da T3 (D137): fixo, cego, de um provedor que não concorre (Moonshot); nunca Anthropic. */
import { z } from "zod";
import type { ModelRef } from "@/src/modules/ia/gateway";

export const JUDGE: ModelRef = { id: "moonshotai/kimi-k3.1-pro", provider: "moonshotai", sort: "latency", reasoningEffort: "low" };

export const rub = z.object({ item_turno: z.number().int().min(1).max(5), fato: z.number().int().min(1).max(5), voz: z.number().int().min(1).max(5) });
export const judgeSchema = z.object({ A: rub, B: rub, preferencia: z.enum(["A", "B", "empate"]), motivo: z.string().max(600) });
export const JUDGE_SYSTEM = `Você avalia, às cegas, duas propostas (A e B) de convite de volta para os horários vazios de um restaurante. Uma pode ter sido escrita por um sistema simples e a outra por IA; você não sabe qual. Avalie só o que está escrito.
Rubrica (1 a 5 cada, para A e para B):
- item_turno: a oferta combina com o horário e o turno (ex.: sobremesa/café à tarde, porção para dividir à noite, prato no almoço)?
- fato: a justificativa ao dono cita fatos pertinentes e concretos do restaurante (não genéricos)?
- voz: o convite ao cliente é caloroso, natural e na voz da casa, sem exageros?
Depois diga qual prefere no geral (A, B ou empate) e um motivo curto. Responda em JSON.`;

