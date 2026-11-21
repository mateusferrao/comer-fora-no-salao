/** Chamadas JSON do assistente (mesma origem; o servidor confere sessão e restaurante). */
export async function api<T = unknown>(
  url: string,
  method: "GET" | "POST" | "PUT" = "GET",
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T }> {
  // Sem rede: status 0 (a tela diz "sem conexão" em vez de quebrar no meio do passo).
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { ok: false, status: 0, data: {} as T };
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export function markStep(step: number) {
  void api("/api/parceiro/passo", "POST", { step }).catch(() => {});
}

export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
