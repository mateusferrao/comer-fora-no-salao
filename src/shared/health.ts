export type SeedStatus = { state: "rodando" | "ok" | "falhou"; reason?: string };
export type MailState = "configurado" | "memoria" | "ausente" | "falhou";
export type KeyState = "ok" | "ajustada" | "ausente";
export type HealthBody = { ok: boolean; db: "up" | "down"; sha: string; seed?: SeedStatus["state"]; mail?: MailState; ia?: { publica: KeyState; demo: KeyState } };

export type HealthDeps = {
  /** Consulta trivial ao banco; rejeita se o banco estiver fora. */
  ping: () => Promise<void>;
  sha: string;
  timeoutMs?: number;
  /** Estado do seed da vitrine (S1): "rodando" e "falhou" deixam o health em 503. */
  seed?: () => SeedStatus;
  /** Envio do código de login (S2, D118): só o estado, nunca credenciais; não derruba o `ok` (o cliente segue funcionando). */
  mail?: () => MailState;
  /** Estado das chaves do OpenRouter (só o estado; "ajustada" = tinha aspas/espaços em volta). Não derruba o `ok`. */
  ia?: () => { publica: KeyState; demo: KeyState };
};

const DEFAULT_TIMEOUT_MS = 2_000;

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ping timeout")), ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function createHealthHandler({ ping, sha, timeoutMs = DEFAULT_TIMEOUT_MS, seed, mail, ia }: HealthDeps) {
  return async function health(): Promise<Response> {
    let db: HealthBody["db"] = "up";
    try {
      await withTimeout(Promise.resolve().then(ping), timeoutMs);
    } catch {
      db = "down";
    }
    const body: HealthBody = { ok: db === "up", db, sha };
    if (seed) {
      const s = seed();
      body.seed = s.state;
      body.ok = body.ok && s.state === "ok";
    }
    if (mail) body.mail = mail();
    if (ia) body.ia = ia();
    return Response.json(body, { status: body.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
  };
}
