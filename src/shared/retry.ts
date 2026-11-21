export type RetryOptions = {
  totalMs: number;
  initialDelayMs: number;
  maxDelayMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type RetryResult<T> = { ok: true; value: T; attempts: number } | { ok: false; error: unknown; attempts: number };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Tenta `fn` com espera crescente (dobra até `maxDelayMs`) até dar certo ou estourar `totalMs`. */
export async function retryUntil<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<RetryResult<T>> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? defaultSleep;
  const maxDelay = opts.maxDelayMs ?? Number.POSITIVE_INFINITY;
  const deadline = now() + opts.totalMs;
  let delay = opts.initialDelayMs;
  let attempts = 0;
  let lastError: unknown;

  for (;;) {
    attempts += 1;
    try {
      return { ok: true, value: await fn(), attempts };
    } catch (err) {
      lastError = err;
    }
    const remaining = deadline - now();
    if (remaining <= 0) return { ok: false, error: lastError, attempts };
    await sleep(Math.min(delay, remaining));
    delay = Math.min(delay * 2, maxDelay);
  }
}
