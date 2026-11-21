/** Guardas das rotas do Portal: sessão do dono + restaurante atual (sempre da sessão — espec. 4.6). */
import type { OwnedRestaurant } from "@/src/modules/contas/application/owner-access";
import { getOwnerSession, type OwnerSession } from "./owner-session";

export type PortalAuth = { s: OwnerSession; r: OwnedRestaurant };

export async function requireStore(opts: { draft?: boolean } = {}): Promise<PortalAuth | Response> {
  const s = await getOwnerSession();
  if (!s) return Response.json({ erro: "sessao" }, { status: 401 });
  const r = s.current;
  if (!r) return Response.json({ erro: "sem_loja" }, { status: 409 });
  if (opts.draft && (r.kind !== "teste" || r.status === "ativo")) return Response.json({ erro: "ja_ativo" }, { status: 409 });
  return { s, r };
}

/** Tipo pelos primeiros bytes (regras: "tipos verificados por bytes"). */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
