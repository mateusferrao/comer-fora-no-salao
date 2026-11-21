import { describe, expect, it } from "vitest";
import { createSesSender, encodeFrom } from "@/src/modules/contas/adapters/ses-sender";
import { getMailSender, mailConfigured } from "@/src/modules/contas/adapters/mail-factory";

describe("SES (forma da requisição)", () => {
  it("remetente com acento vai em RFC 2047; ASCII entre aspas", () => {
    expect(encodeFrom("Comer Fora no Salão <acesso@case.exemplo.com>")).toBe(
      `=?UTF-8?B?${Buffer.from("Comer Fora no Salão").toString("base64")}?= <acesso@case.exemplo.com>`,
    );
    expect(encodeFrom("Portal <a@b.com>")).toBe('"Portal" <a@b.com>');
    expect(encodeFrom("a@b.com")).toBe("a@b.com");
  });

  it("POST SESv2 assinado (SigV4, serviço ses) com Content.Simple", async () => {
    let captured: Request | null = null;
    const sender = createSesSender({
      region: "sa-east-1",
      accessKeyId: "AKIDEXEMPLO",
      secretAccessKey: "segredo-de-teste",
      from: "Comer Fora no Salão <acesso@case.exemplo.com>",
      fetchImpl: async (r) => {
        captured = r;
        return new Response("{}", { status: 200 });
      },
    });
    await sender.send({ to: "dono@exemplo.com", subject: "Seu código de acesso: 123456", text: "t", html: "<p>t</p>" });
    const req = captured as unknown as Request;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://email.sa-east-1.amazonaws.com/v2/email/outbound-emails");
    const auth = req.headers.get("authorization") ?? "";
    expect(auth).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXEMPLO\/\d{8}\/sa-east-1\/ses\/aws4_request/);
    const body = (await req.json()) as { Destination: { ToAddresses: string[] }; Content: { Simple: { Subject: { Data: string } } } };
    expect(body.Destination.ToAddresses).toEqual(["dono@exemplo.com"]);
    expect(body.Content.Simple.Subject.Data).toBe("Seu código de acesso: 123456");
  });

  it("erro HTTP vira MailError sem o corpo nem o endereço", async () => {
    const sender = createSesSender({ region: "sa-east-1", accessKeyId: "a", secretAccessKey: "b", from: "a@b.com", fetchImpl: async () => new Response("MessageRejected: dono@exemplo.com", { status: 400 }) });
    await expect(sender.send({ to: "dono@exemplo.com", subject: "s", text: "t", html: "h" })).rejects.toThrow(/HTTP 400/);
    await expect(sender.send({ to: "dono@exemplo.com", subject: "s", text: "t", html: "h" })).rejects.not.toThrow(/dono@exemplo/);
  });

  it("memória só com MAIL_TRANSPORT=memory; sem SES nem flag → ausente", () => {
    expect(mailConfigured({} as unknown as NodeJS.ProcessEnv)).toBe("ausente");
    expect(getMailSender({ MAIL_TRANSPORT: "memory" } as unknown as NodeJS.ProcessEnv)?.kind).toBe("memory");
    expect(mailConfigured({ SES_REGION: "x", SES_ACCESS_KEY_ID: "x", SES_SECRET_ACCESS_KEY: "x", MAIL_FROM: "a@b.c" } as unknown as NodeJS.ProcessEnv)).toBe("configurado");
  });
});
