"use client";

import { useState, type ReactNode } from "react";
import { confirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/Button";

type Tok = { id: string; hint: string; createdAt: string; active: boolean };

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => void navigator.clipboard?.writeText(text).then(() => setDone(true), () => setDone(false))}
      className="min-h-11 shrink-0 rounded-xs border border-red-text bg-white px-4 text-sm font-semibold text-red-text hover:bg-red-text/5"
    >
      {done ? "Copiado ✓" : "Copiar"}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-button text-sm font-bold text-white">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-ink">
        <h3 className="font-semibold">{title}</h3>
        {children}
      </div>
    </li>
  );
}

/**
 * Configurações › Agente (MCP; flag): token do dono para um agente ler e aprovar o plano (D219). D246: passo a passo para
 * quem não é técnico — o que é, o que o assistente pode fazer, onde colar endereço e token, como testar e como cortar o
 * acesso; exemplo pronto só para o assistente cuja configuração conhecemos (Claude Code).
 */
export function AgentSection({ initial, endpoint }: { initial: Tok[]; endpoint: string }) {
  const [tokens, setTokens] = useState(initial);
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const active = tokens.find((t) => t.active);
  const call = async (acao: string) => {
    setBusy(acao);
    setMsg("");
    const r = await fetch("/api/parceiro/configuracoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao }) }).catch(() => null);
    const j = ((await r?.json().catch(() => ({}))) ?? {}) as { token?: string; hint?: string };
    setBusy("");
    return { ok: !!r?.ok, j };
  };
  const command = `claude mcp add --transport http comer-fora ${endpoint} --header "Authorization: Bearer ${shown ?? "SEU_TOKEN"}"`;
  return (
    <section aria-labelledby="agente" className="flex flex-col gap-4 rounded-sm border border-border p-4">
      <div className="flex flex-col gap-1">
        <h2 id="agente" className="font-semibold text-ink">
          Conectar um assistente de IA (MCP)
        </h2>
        <p className="text-sm text-ink-muted">
          Opcional. Se você já usa um assistente de IA (como o Claude), pode conectá-lo ao seu restaurante e pedir em conversa: &quot;como foram os convites?&quot;,
          &quot;gere o plano da semana&quot;, &quot;aprove o plano&quot;. Não usa? Tudo isso já dá para fazer aqui no Portal.
        </p>
      </div>

      <div className="rounded-sm bg-surface-muted p-3 text-sm text-ink">
        <p className="font-semibold">O que o assistente pode fazer</p>
        <ul className="mt-1 list-disc pl-5 leading-6">
          <li>Ler os números dos últimos 30 dias (convites, clientes, horários).</li>
          <li>Ver o plano da semana e gerar um novo.</li>
          <li>Aprovar o plano proposto: passa a valer no salão e fica registrado como &quot;aprovado via agente&quot;.</li>
        </ul>
        <p className="mt-1">Ele só enxerga este restaurante e não vê nome, telefone nem e-mail de clientes.</p>
      </div>

      <ol className="flex flex-col gap-5" aria-label="Como conectar, passo a passo">
        <Step n={1} title="Gere a sua chave de acesso (token)">
          <p>O token funciona como uma senha só para o assistente. Ele aparece uma vez só: copie e guarde.</p>
          <p>{active ? `Você já tem um token ativo (termina em ${active.hint}).` : "Você ainda não tem token."}</p>
          {shown && (
            <div role="status" className="flex flex-col gap-2 rounded-sm border border-red-text/40 bg-nav-active p-3" data-testid="token-agente">
              <p className="font-semibold">Copie agora: este token não aparece de novo.</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-xs bg-white px-2 py-1">{shown}</code>
                <CopyButton text={shown} label="Copiar o token" />
              </div>
            </div>
          )}
          <div>
            <Button
              variant="primary-portal"
              loading={busy === "agente_gerar"}
              onClick={async () => {
                if (active && !(await confirmDialog({ title: "Gerar um novo token?", body: "O token atual para de funcionar na hora.", confirmLabel: "Gerar novo token" }))) return;
                const r = await call("agente_gerar");
                if (r.ok && r.j.token) {
                  setShown(r.j.token);
                  setTokens([{ id: "novo", hint: r.j.hint ?? "", createdAt: new Date().toISOString(), active: true }, ...tokens.map((t) => ({ ...t, active: false }))]);
                } else setMsg("Não deu para gerar o token agora. Tente de novo em instantes.");
              }}
            >
              {active ? "Gerar novo token" : "Gerar token"}
            </Button>
          </div>
        </Step>

        <Step n={2} title="Copie o endereço do seu restaurante">
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xs bg-surface-muted px-2 py-1">{endpoint}</code>
            <CopyButton text={endpoint} label="Copiar o endereço" />
          </div>
        </Step>

        <Step n={3} title="Cole os dois no seu assistente">
          <p>
            No seu assistente, procure a opção de adicionar um <strong>servidor MCP</strong> (às vezes chamado de &quot;conector&quot; ou &quot;integração
            personalizada&quot;) e preencha:
          </p>
          <ul className="list-disc pl-5 leading-6">
            <li>
              <strong>Endereço (URL):</strong> o do passo 2. Se perguntar o tipo de conexão, escolha <strong>HTTP</strong>.
            </li>
            <li>
              <strong>Autenticação:</strong> não use login/OAuth (escolha &quot;Sem login&quot; ou &quot;Bearer token&quot;) e cole o token do passo 1. Se pedir um cabeçalho, o nome é{" "}
              <code className="rounded-xs bg-surface-muted px-1">Authorization</code> e o valor é <code className="rounded-xs bg-surface-muted px-1">Bearer</code>, um
              espaço e o token.
            </li>
          </ul>
          <details className="rounded-sm border border-border px-3">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold text-red-text">Exemplo pronto: Claude (site ou app)</summary>
            <ol className="mb-3 list-decimal pl-5 leading-6">
              <li>
                Na tela de conectores do Claude, toque em <strong>Adicionar conector personalizado</strong>.
              </li>
              <li>Dê um nome (ex.: Comer Fora no Salão) e cole o endereço do passo 2 na URL.</li>
              <li>
                Na autenticação, marque <strong>Sem login</strong>. Não use &quot;Cliente OAuth&quot;: com ele, o Claude não deixa usar o cabeçalho
                Authorization.
              </li>
              <li>
                Em <strong>Cabeçalhos de requisição</strong>, toque em <strong>Adicionar cabeçalho</strong>, escolha cabeçalho personalizado e preencha: nome{" "}
                <code className="rounded-xs bg-surface-muted px-1">Authorization</code>; valor: o texto abaixo{shown ? "" : " (gere o token no passo 1 para ele aparecer completo)"}.
              </li>
            </ol>
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded-xs bg-surface-muted px-2 py-1">{`Bearer ${shown ?? "SEU_TOKEN"}`}</code>
              <CopyButton text={`Bearer ${shown ?? "SEU_TOKEN"}`} label="Copiar o valor do cabeçalho" />
            </div>
            <p className="mb-3">Salve e ative o conector na conversa. O token só aparece uma vez: se você já fechou a tela sem copiar, gere um novo.</p>
          </details>
          <details className="rounded-sm border border-border px-3">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold text-red-text">Exemplo pronto: Claude Code (no terminal)</summary>
            <p className="mt-1">Abra o terminal, cole este comando e aperte Enter{shown ? "" : " (troque SEU_TOKEN pelo token do passo 1)"}:</p>
            <div className="my-3 flex flex-wrap items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded-xs bg-surface-muted px-2 py-1">{command}</code>
              <CopyButton text={command} label="Copiar o comando do Claude Code" />
            </div>
          </details>
          <p className="text-ink-muted">Cada assistente tem a sua tela de configuração. Se não achar a opção, procure &quot;MCP&quot; na ajuda dele.</p>
        </Step>

        <Step n={4} title="Teste">
          <p>
            Pergunte ao assistente: <em>&quot;Como estão os convites do meu restaurante?&quot;</em> Ele deve responder com os números dos últimos 30 dias. Se disser
            que não tem acesso, confira se o token foi colado inteiro, com &quot;Bearer&quot; e um espaço antes.
          </p>
        </Step>

        <Step n={5} title="Para cortar o acesso">
          <p>Revogue o token: o assistente perde o acesso na hora. Para voltar a usar, gere um novo e troque no assistente.</p>
          {active && (
            <div>
              <Button
                variant="outline-portal"
                loading={busy === "agente_revogar"}
                onClick={async () => {
                  if (!(await confirmDialog({ title: "Revogar o token?", body: "O assistente perde o acesso ao restaurante na hora.", confirmLabel: "Revogar" }))) return;
                  const r = await call("agente_revogar");
                  if (r.ok) {
                    setShown(null);
                    setTokens(tokens.map((t) => ({ ...t, active: false })));
                    setMsg("Token revogado: o assistente não tem mais acesso.");
                  } else setMsg("Não deu para revogar agora. Tente de novo em instantes.");
                }}
              >
                Revogar token
              </Button>
            </div>
          )}
        </Step>
      </ol>
      <p className="text-xs text-ink-muted">Guarde o token como uma senha: quem tiver o token pode aprovar o plano. Limite de 60 pedidos por hora.</p>
      {msg && (
        <p role="status" className="text-sm text-ink">
          {msg}
        </p>
      )}
    </section>
  );
}
