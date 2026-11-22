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
 * Corpo JSON lido com o teto (S9). `erro: "grande"` (acima de 64 KB, declarado ou lido em pedaços): a rota
 * responde `tooLarge()` (413). `erro: "invalido"` (JSON quebrado ou corpo vazio): `value` é `null` e o schema da
 * rota responde 400 como sempre. Uso nas rotas:
 *
 *   const raw = await readJson(req);
 *   if (raw.erro === "grande") return tooLarge();
 *   const body = input.safeParse(raw.value);
 *
 * As rotas que chamam `rejectCrossSite` já respondem 413 pelo `content-length`; aqui fica a 2ª barreira, que nunca
 * guarda mais de 64 KB na memória. Ler o corpo direto (`req.json()`) fura o teto: `tests/unit/web/routes-body.test.ts`.
 */
export type JsonBody = { ok: true; value: unknown; erro?: undefined } | { ok: false; erro: "grande" | "invalido"; value: null };

export async function readJson(req: Request): Promise<JsonBody> {
  if (declaredTooLarge(req)) return { ok: false, erro: "grande", value: null };
  let text: string | null;
  try {
    text = await readLimited(req);
  } catch {
    return { ok: false, erro: "invalido", value: null };
  }
  if (text === null) return { ok: false, erro: "grande", value: null };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, erro: "invalido", value: null };
  }
}
