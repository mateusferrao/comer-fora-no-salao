/** Respostas JSON comuns das rotas do Portal. */
export function tooMany(retryAfterSec = 60): Response {
  return Response.json({ erro: "limite", retryAfterSec }, { status: 429, headers: { "retry-after": String(retryAfterSec) } });
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
