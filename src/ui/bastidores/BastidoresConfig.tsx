"use client";

import { confirmDialog } from "../components/ConfirmDialog";
import { useCallback, useEffect, useState } from "react";
import { FLAG_LABEL, FLAGS, PROMPT_TASKS, type Flag, type PromptTask } from "@/src/modules/config/domain/flags";

type Version = { version: number; text: string; note: string | null; createdAt: string; current: boolean };
type State = { prompts: Record<PromptTask, Version[]>; flags: Record<Flag, boolean> };
type TestOut = { ok: true; status: "ok" | "sem_ia"; reasons: string[]; texts: Array<{ label: string; text: string }>; model: string | null } | { ok: false; erro: string };

const TASK_LABEL: Record<PromptTask, string> = { pacote: "Pacote da ativação", plano: "Plano da semana", kit: "Chamadas do kit", cardapio: "Leitura do cardápio" };
const post = (acao: string, body: unknown) => fetch(`/api/bastidores/${acao}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function BastidoresConfig({ logged }: { logged: boolean }) {
  const [ok, setOk] = useState(logged);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [st, setSt] = useState<State | null>(null);
  const [task, setTask] = useState<PromptTask>("kit");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [test, setTest] = useState<TestOut | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/bastidores/estado", { cache: "no-store" });
    if (r.status === 401) return setOk(false);
    const j = (await r.json()) as State;
    setSt(j);
    return j;
  }, []);
  useEffect(() => {
    if (!ok) return;
    let alive = true;
    fetch("/api/bastidores/estado", { cache: "no-store" })
      .then(async (r) => {
        if (!alive) return;
        if (r.status === 401) return setOk(false);
        const j = (await r.json()) as State;
        setSt(j);
        setDraft(j.prompts.kit.find((v) => v.current)?.text ?? "");
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [ok]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    const r = await post("entrar", { senha });
    if (r.ok) setOk(true);
    else setErro(r.status === 429 ? "Muitas tentativas. Tente em alguns minutos." : "Senha incorreta.");
  };
  const pick = (t: PromptTask) => {
    setTask(t);
    setTest(null);
    setDraft(st?.prompts[t].find((v) => v.current)?.text ?? "");
  };
  const act = async (name: string, fn: () => Promise<Response>, done: string) => {
    setBusy(name);
    setMsg("");
    const r = await fn();
    setBusy("");
    if (r.ok) {
      setMsg(done);
      await load();
    } else setMsg("Não deu certo. Confira o texto e tente de novo.");
    return r;
  };

  if (!ok)
    return (
      <form onSubmit={login} className="mt-6 flex max-w-sm flex-col gap-3">
        <label htmlFor="senha-bastidores" className="text-sm font-medium text-ink">
          Senha dos Bastidores
        </label>
        <input id="senha-bastidores" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="min-h-11 rounded-xs border border-border px-3" />
        {erro && (
          <p role="alert" className="text-sm text-red-text">
            {erro}
          </p>
        )}
        <button type="submit" className="min-h-11 rounded-xs bg-red-button px-5 text-sm font-semibold text-white">
          Entrar
        </button>
      </form>
    );
  if (!st) return <p className="mt-6 text-sm text-ink">Carregando…</p>;
  const versions = st.prompts[task];
  return (
    <div className="mt-6 flex flex-col gap-8">
      {msg && (
        <p role="status" className="rounded-sm bg-surface-muted p-3 text-sm text-ink">
          {msg}
        </p>
      )}
      <section aria-labelledby="prompts" className="flex flex-col gap-3">
        <h2 id="prompts" className="text-lg font-bold text-ink">
          Prompts (bloco de instruções e tom)
        </h2>
        <div role="tablist" aria-label="Tarefa" className="flex flex-wrap gap-2">
          {PROMPT_TASKS.map((t) => (
            <button key={t} role="tab" aria-selected={task === t} type="button" onClick={() => pick(t)} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${task === t ? "bg-red-button text-white" : "border border-border bg-white text-ink"}`}>
              {TASK_LABEL[t]}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Instruções da tarefa &quot;{TASK_LABEL[task]}&quot;
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} maxLength={1500} className="rounded-xs border border-border p-2 font-mono text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Nota da versão (opcional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} className="min-h-11 rounded-xs border border-border px-2" />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={task === "cardapio" || !!busy}
            onClick={async () => {
              setBusy("testar");
              setTest(null);
              const r = await post("testar", { task, text: draft });
              setBusy("");
              setTest(r.ok ? ((await r.json()) as TestOut) : { ok: false, erro: r.status === 429 ? "limite" : "erro" });
            }}
            className="min-h-11 rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text disabled:opacity-50"
          >
            {busy === "testar" ? "Testando…" : "Testar com exemplo"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => act("publicar", () => post("publicar", { task, text: draft, note }), "Publicado: a próxima chamada desta tarefa já usa este texto.")} className="min-h-11 rounded-xs bg-red-button px-5 text-sm font-semibold text-white disabled:opacity-50">
            Publicar
          </button>
        </div>
        {task === "cardapio" && <p className="text-xs text-ink-muted">A leitura do cardápio precisa de uma imagem: publique e teste no assistente.</p>}
        {test && (
          <div className="rounded-sm border border-border bg-white p-3 text-sm" data-testid="teste-prompt">
            {!test.ok ? (
              <p>{test.erro === "sem_chave" ? "IA desligada neste ambiente." : test.erro === "limite" ? "Muitos testes nesta hora." : "Não deu para testar."}</p>
            ) : test.status === "sem_ia" ? (
              <>
                <p className="font-semibold text-ink">Reprovado pelas regras (ficaria o texto modelo):</p>
                <ul className="list-disc pl-5">
                  {test.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : (
              <dl className="flex flex-col gap-1">
                {test.texts.map((t, i) => (
                  <div key={i}>
                    <dt className="text-xs text-ink-muted">{t.label}</dt>
                    <dd className="text-ink">{t.text}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-ink">Versões ({versions.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {versions.map((v) => (
              <li key={v.version} className="rounded-sm border border-border bg-white p-2 text-sm">
                <p className="font-semibold text-ink">
                  {v.version === 0 ? "Original do código" : `Versão ${v.version}`} {v.current ? "· em uso" : ""} {v.note ? `· ${v.note}` : ""}
                </p>
                <p className="line-clamp-2 text-xs text-ink-muted">{v.text}</p>
                {!v.current && (
                  <button type="button" onClick={() => act("voltar", () => post("voltar", { task, version: v.version }), "Pronto: voltou para esta versão.").then(() => setDraft(v.text))} className="mt-1 min-h-11 text-sm font-semibold text-red-text underline">
                    Voltar a esta versão
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="flags" className="flex flex-col gap-2">
        <h2 id="flags" className="text-lg font-bold text-ink">
          Recursos com flag
        </h2>
        {FLAGS.map((f) => (
          <label key={f} className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={st.flags[f]}
              onChange={(e) => {
                const on = e.target.checked;
                setSt({ ...st, flags: { ...st.flags, [f]: on } });
                void act("flag", () => post("flag", { flag: f, on }), `${FLAG_LABEL[f]}: ${on ? "ligado" : "desligado"}.`);
              }}
            />
            {FLAG_LABEL[f]}
          </label>
        ))}
      </section>

      <section aria-labelledby="reset" className="flex flex-col gap-2">
        <h2 id="reset" className="text-lg font-bold text-ink">
          Resetar demo
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!!busy}
            onClick={async () =>
              (await confirmDialog({
                title: "Recriar sua demonstração?",
                body: "Apaga os restaurantes da conta logada neste navegador e refaz a demonstração.",
                confirmLabel: "Recriar",
              })) &&
              act(
                "reset",
                () => post("reset", { alvo: "minha" }),
                "Demonstração recriada.",
              )
            }
            className="min-h-11 rounded-xs border border-border bg-white px-5 text-sm font-semibold text-ink"
          >
            Recriar minha demo
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={async () =>
              (await confirmDialog({
                title: "Recriar a vitrine pública?",
                body: "Apaga as visitas reais da vitrine pública e a recria do zero.",
                confirmLabel: "Recriar",
              })) &&
              act(
                "reset",
                () => post("reset", { alvo: "vitrine" }),
                "Vitrine pública recriada.",
              )
            }
            className="min-h-11 rounded-xs border border-border bg-white px-5 text-sm font-semibold text-ink"
          >
            Recriar vitrine pública
          </button>
        </div>
        <p className="text-sm">
          <a className="text-red-text underline" href="/bastidores/avaliador">
            Ferramentas do avaliador (Avançar 1 dia, ver como cliente reativado)
          </a>
        </p>
      </section>
      <button type="button" onClick={async () => (await post("sair", {}), setOk(false))} className="min-h-11 self-start text-sm text-ink underline">
        Sair dos Bastidores
      </button>
    </div>
  );
}
