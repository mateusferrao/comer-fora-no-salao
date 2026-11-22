/** Respostas JSON comuns das rotas do Portal. */
export function tooMany(retryAfterSec = 60): Response {
  return Response.json({ erro: "limite", retryAfterSec }, { status: 429, headers: { "retry-after": String(retryAfterSec) } });
}

/**
 * S9 (segurança M4): teto do corpo JSON de todas as rotas (os maiores pedidos legítimos, cardápio e configurações,
 * ficam em poucos KB). O upload do cardápio é multipart e tem limite próprio na rota.
 */
export const MAX_JSON_BYTES = 64 * 1024;

export function tooLarge(): Response {
  return Response.json({ erro: "corpo_grande" }, { status: 413 });
}

/** `content-length` declarado acima do teto. Com o cabeçalho, o Node nunca entrega mais bytes do que ele diz. */
export function declaredTooLarge(req: Request): boolean {
  const n = Number(req.headers.get("content-length"));
  return Number.isFinite(n) && n > MAX_JSON_BYTES;
}

/** Lê no máximo `MAX_JSON_BYTES` (corpo em pedaços, sem `content-length`); passou disso, cancela a leitura. */
async function readLimited(req: Request): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_JSON_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * Corpo JSON ou `null` (inválido ou acima do teto). As rotas que chamam `rejectCrossSite` já respondem 413 pelo
 * `content-length`; aqui fica a 2ª barreira, que nunca guarda mais de 64 KB na memória.
 */
export async function readJson<T>(req: Request): Promise<T | null> {
  if (declaredTooLarge(req)) return null;
  try {
    const text = await readLimited(req);
    return text === null ? null : (JSON.parse(text) as T);
  } catch {
    return null;
  }
}
