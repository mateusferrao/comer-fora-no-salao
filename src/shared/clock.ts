/** Relógio como porta (D47): o domínio nunca chama `new Date()` solto. */
export interface Clock {
  now(): Date;
}

export type AdjustableClock = Clock & { set(iso: string): void; advance(ms: number): void };

function parseIso(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`instante inválido: ${iso}`);
  return t;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(iso: string): Clock {
  const t = parseIso(iso);
  return { now: () => new Date(t) };
}

/** Relógio ajustável (Tarefa 3.6: avançar o tempo na demo e nos testes). */
export function adjustableClock(iso: string): AdjustableClock {
  let t = parseIso(iso);
  return {
    now: () => new Date(t),
    set: (next: string) => {
      t = parseIso(next);
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}
