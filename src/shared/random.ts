/** Sufixo aleatório legível (sem 0/o/1/l) para slugs e tokens de cópia (movido de onboarding — revisão S2 #37). */
import { secureRandInt } from "./crypto";

const ALPHA = "abcdefghijkmnpqrstuvwxyz23456789";

export function randomSuffix(n = 6, randInt: (n: number) => number = secureRandInt): string {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHA[randInt(ALPHA.length)];
  return s;
}
