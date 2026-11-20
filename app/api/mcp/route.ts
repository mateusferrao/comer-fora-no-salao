/**
 * MCP (flag `mcp`): Streamable HTTP só com POST e respostas JSON (sem SSE, sem sessão). Autenticação por
 * `Authorization: Bearer <token do dono>`; `Origin` de outro site é recusado (DNS rebinding); 60 chamadas/h
 * por token.
 */
import { after } from "next/server";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { handleRpc } from "@/src/modules/mcp/server";
import { resolveToken } from "@/src/modules/mcp/tokens";
import { consume } from "@/src/shared/rate-limit";
import { readJson } from "@/src/web/http";
import { publicBaseUrl } from "@/src/web/qr";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const err = (status: number, code: number, message: string, headers: Record<string, string> = {}) => Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers });

export async function POST(req: Request) {
  const db = getDb();
  if (!(await getFlags(db)).mcp) return new Response(null, { status: 404 });
  const origin = req.headers.get("origin");
  // Atrás do proxy, `req.url` pode não ter o host público: vale a origem pública configurada (ou a da própria URL).
  if (origin && origin !== new URL(req.url).origin && origin !== new URL(publicBaseUrl()).origin) return err(403, -32600, "Origin not allowed");
  const auth = req.headers.get("authorization") ?? "";
  const tok = await resolveToken(db, auth.startsWith("Bearer ") ? auth.slice(7).trim() : null);
  if (!tok) return err(401, -32001, "Unauthorized", { "www-authenticate": 'Bearer realm="comer-fora-no-salao"' });
  const now = new Date();
  const lim = await consume(db, `mcp:${tok.tokenId}`, 60, 3600, now);
  if (!lim.ok) return err(429, -32002, "Too many requests", { "retry-after": String(lim.retryAfterSec ?? 3600) });
  const body = await readJson(req);
  if (Array.isArray(body)) return err(400, -32600, "Batch not supported");
  if (body === null || typeof body !== "object") return err(400, -32700, "Parse error");
  const res = await handleRpc(db, tok.restaurantId, body, now, { schedule: (fn) => after(fn) });
  if (!res) return new Response(null, { status: 202 });
  return Response.json(res, { headers: { "cache-control": "no-store", "mcp-protocol-version": "2025-06-18" } });
}

export function GET() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}
