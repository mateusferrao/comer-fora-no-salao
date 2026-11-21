/**
 * AWS SES pela API v2 (`SendEmail`), assinada com SigV4 via `aws4fetch` (sem o SDK da AWS: menos memória
 * no build). O nome de exibição do remetente vai codificado em RFC 2047 ("Salão" tem acento).
 */
import { AwsClient } from "aws4fetch";
import { MailError, type MailMessage, type MailSender } from "./mail-sender";

export type SesConfig = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** `Nome <endereco@dominio>` ou só o endereço. */
  from: string;
  fetchImpl?: (req: Request) => Promise<Response>;
};

/** `Comer Fora no Salão <a@b.c>` → `=?UTF-8?B?...?= <a@b.c>`; ASCII puro fica como está. */
export function encodeFrom(from: string): string {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!m) return from.trim();
  const [, name = "", addr = ""] = m;
  if (!name) return addr;
  if (/^[\x20-\x7e]*$/.test(name)) return `"${name.replace(/"/g, "")}" <${addr}>`;
  return `=?UTF-8?B?${Buffer.from(name, "utf8").toString("base64")}?= <${addr}>`;
}

export function sesEndpoint(region: string, path: string): string {
  return `https://email.${region}.amazonaws.com${path}`;
}

export function createSesSender(cfg: SesConfig): MailSender {
  const client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region, service: "ses" });
  const doFetch = cfg.fetchImpl ?? ((r: Request) => fetch(r));
  return {
    kind: "ses",
    async send(msg: MailMessage) {
      const body = JSON.stringify({
        FromEmailAddress: encodeFrom(cfg.from),
        Destination: { ToAddresses: [msg.to] },
        Content: {
          Simple: {
            Subject: { Data: msg.subject, Charset: "UTF-8" },
            Body: { Text: { Data: msg.text, Charset: "UTF-8" }, Html: { Data: msg.html, Charset: "UTF-8" } },
          },
        },
      });
      const req = await client.sign(sesEndpoint(cfg.region, "/v2/email/outbound-emails"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      let res: Response;
      try {
        res = await doFetch(req);
      } catch {
        throw new MailError();
      }
      if (!res.ok) throw new MailError(res.status);
    },
  };
}

/** Preflight (planejamento S2 §6.6): a conta saiu do sandbox? Exige `ses:GetAccount` no usuário IAM. */
export async function sesProductionAccess(cfg: Omit<SesConfig, "from">): Promise<{ ok: boolean; productionAccess?: boolean; sendingEnabled?: boolean; status: number }> {
  const client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region, service: "ses" });
  const req = await client.sign(sesEndpoint(cfg.region, "/v2/email/account"), { method: "GET" });
  const res = await (cfg.fetchImpl ?? ((r: Request) => fetch(r)))(req);
  if (!res.ok) return { ok: false, status: res.status };
  const j = (await res.json()) as { ProductionAccessEnabled?: boolean; SendingEnabled?: boolean };
  return { ok: true, productionAccess: j.ProductionAccessEnabled, sendingEnabled: j.SendingEnabled, status: res.status };
}
