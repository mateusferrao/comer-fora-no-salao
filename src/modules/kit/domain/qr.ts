/** URL do QR por versão (espec. 3.4): `/r/<slug>?p=<token>`, sempre a partir de `PUBLIC_BASE_URL` (não do Host). */
export function qrUrl(baseUrl: string, slug: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/r/${encodeURIComponent(slug)}?p=${encodeURIComponent(token)}`;
}
