/**
 * Google Cloud Vision (DOCUMENT_TEXT_DETECTION) para a linha de base da T1 (D128) — só no script de
 * avaliação, nunca no produto. Autenticação por service account: JWT RS256 assinado com o `crypto` do Node.
 */
import { createSign } from "node:crypto";

type ServiceAccount = { client_email: string; private_key: string; token_uri: string };

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export async function visionToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-vision", aud: sa.token_uri, iat: now, exp: now + 3000 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`token do Google: HTTP ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function visionText(token: string, image: Uint8Array): Promise<string> {
  const res = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: Buffer.from(image).toString("base64") }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }], imageContext: { languageHints: ["pt"] } }],
    }),
  });
  if (!res.ok) throw new Error(`Vision: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { responses: Array<{ fullTextAnnotation?: { text: string }; error?: { message: string } }> };
  const r = j.responses[0];
  if (r?.error) throw new Error(`Vision: ${r.error.message}`);
  return r?.fullTextAnnotation?.text ?? "";
}
