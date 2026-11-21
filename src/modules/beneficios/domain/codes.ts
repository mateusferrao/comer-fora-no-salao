/**
 * Códigos dos 3 tipos (1ª visita, convite, recompensa): 6 caracteres sem ambíguos, únicos por restaurante,
 * válidos até 23:59:59 SP do dia em que nascem, uso único (espec. 3.3, D218).
 */
import { daySP } from "@/src/shared/tz";

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const CODE_TYPES = ["primeira_visita", "convite", "recompensa"] as const;
export type CodeType = (typeof CODE_TYPES)[number];
export type CodeStatus = "emitido" | "validado";
export type CodeCheck = "OK" | "INVALIDO" | "JA_USADO" | "EXPIRADO" | "OUTRO_RESTAURANTE";

/** `randInt(n)` devolve um inteiro uniforme em [0, n). Em produção: `crypto.randomInt`. */
export function generateCode(randInt: (n: number) => number): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[randInt(CODE_ALPHABET.length)];
  return s;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isCodeFormat(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}

export function checkCode(
  found: { restaurantId: string; status: CodeStatus; validDay: string } | null,
  ctx: { restaurantId: string; now: Date },
): CodeCheck {
  if (!found) return "INVALIDO";
  if (found.restaurantId !== ctx.restaurantId) return "OUTRO_RESTAURANTE";
  if (found.status === "validado") return "JA_USADO";
  if (found.validDay < daySP(ctx.now)) return "EXPIRADO";
  return "OK";
}
