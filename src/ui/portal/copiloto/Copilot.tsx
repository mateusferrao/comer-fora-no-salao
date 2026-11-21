"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/src/ui/components/Button";
import { useModalDialog } from "@/src/ui/components/useModalDialog";
import { abaHref, ProposalCard, type Card } from "./ProposalCard";

type Msg = {
  role: "user" | "assistant";
  text: string;
  cards?: Card[];
  atalhos?: Array<{ label: string; href: string }>;
  sugestoes?: string[];
  semIa?: boolean;
};
type Chips = Record<string, string[]>;

const STORE = "copiloto:conversa";
const MAX_KEEP = 12;
const PANEL_W = "400px";

const desktopQuery = () => window.matchMedia("(min-width: 1024px)");
function useDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = desktopQuery();
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => desktopQuery().matches,
    () => true,
  );
}

/** Tela atual → id curto mandado ao servidor e chips (sugestões escritas pelo código). */
function pageOf(path: string): string {
  if (path.startsWith("/parceiro/salao/configuracoes")) return "configuracoes";
  if (path.startsWith("/parceiro/salao/plano")) return "plano";
  if (path.startsWith("/parceiro/salao/kit")) return "kit";
  if (path.startsWith("/parceiro/salao/clientes")) return "clientes";
  if (path.startsWith("/parceiro/salao/validar")) return "validar";
  if (path.startsWith("/parceiro/salao/ativar")) return "ativar";
  return "painel";
}

function load(): { msgs: Msg[]; session: string } {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (raw) return JSON.parse(raw) as { msgs: Msg[]; session: string };
  } catch {
    /* sessão sem storage: começa vazio */
  }
  return { msgs: [], session: crypto.randomUUID() };
}

/**
 * Assistente do salão (S8 — D260–D263). Desenho "pedido → cartões": chips em destaque, um campo e poucas mensagens.
 * Computador: painel não modal que empurra o conteúdo (o formulário atrás continua visível). Celular: tela cheia modal.
 * A conversa fica só neste navegador (sessionStorage); o servidor guarda só as propostas.
 */
export function Copilot({ chips }: { chips: Chips }) {
  const desktop = useDesktop();
  const path = usePathname() ?? "";
  const page = pageOf(path);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // A conversa só existe no navegador: o painel só aparece depois de um clique, então o 1º render bate com o servidor.
  const [state, setState] = useState<{ msgs: Msg[]; session: string } | null>(
    () => (typeof window === "undefined" ? null : load()),
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const wasOpen = useRef(false);
  const { ref: dialogRef, dialogProps } = useModalDialog(
    open && !desktop,
    close,
  );

  useEffect(() => {
    if (!state) return;
    try {
      sessionStorage.setItem(
        STORE,
        JSON.stringify({ ...state, msgs: state.msgs.slice(-MAX_KEEP) }),
      );
    } catch {
      /* sem storage: segue só na memória */
    }
  }, [state]);
  // Painel aberto no computador empurra o conteúdo (revisão de produto I1).
  useEffect(() => {
    const on = open && desktop;
    document.documentElement.style.setProperty(
      "--copiloto-w",
      on ? PANEL_W : "0px",
    );
    return () =>
      document.documentElement.style.setProperty("--copiloto-w", "0px");
  }, [open, desktop]);
  // Edição não salva no formulário da tela (aviso antes de aplicar — revisão de produto I5).
  useEffect(() => {
    dirty.current = false;
    const main = document.getElementById("conteudo");
    const mark = () => (dirty.current = true);
    main?.addEventListener("input", mark);
    return () => main?.removeEventListener("input", mark);
  }, [path]);
  // Corpo em bloco: no Chromium recente `scrollIntoView` devolve uma Promise, e o React a chamaria como limpeza.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [state?.msgs.length, busy]);
  useEffect(() => {
    if (open && desktop) inputRef.current?.focus();
    // Computador: ao fechar, o foco volta ao botão (no celular, o <dialog> já devolve).
    if (!open && wasOpen.current && desktop) launcher.current?.focus();
    wasOpen.current = open;
  }, [open, desktop]);

  const send = async (q: string) => {
    const ask = q.trim().slice(0, 1000);
    if (!ask || busy || !state) return;
    setError(null);
    const msgs: Msg[] = [...state.msgs, { role: "user", text: ask }];
    setState({ ...state, msgs });
    setText("");
    setBusy(true);
    try {
      const turns = msgs
        .slice(-MAX_KEEP)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }));
      const res = await fetch("/api/parceiro/copiloto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turns, page, sessionId: state.session }),
        cache: "no-store",
      });
      if (res.status === 429)
        throw new Error(
          "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.",
        );
      if (!res.ok)
        throw new Error("Não consegui responder agora. Tente de novo.");
      const d = (await res.json()) as {
        resposta: string;
        propostas: Card[];
        sugestoes: string[];
        atalhos: Array<{ label: string; href: string }>;
        generatedBy: "ia" | "sem_ia";
      };
      setState((s) =>
        s
          ? {
              ...s,
              msgs: [
                ...msgs,
                {
                  role: "assistant",
                  text: d.resposta,
                  cards: d.propostas,
                  atalhos: d.atalhos,
                  sugestoes: d.sugestoes,
                  semIa: d.generatedBy === "sem_ia",
                },
              ],
            }
          : s,
      );
    } catch (e) {
      setError(
        e instanceof Error && e.message !== "Failed to fetch"
          ? e.message
          : "Sem conexão com o servidor.",
      );
      setState((s) => (s ? { ...s, msgs: msgs.slice(0, -1) } : s));
      setText(ask);
    } finally {
      setBusy(false);
    }
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };
  const onApplied = (aba: string, id: string) => {
    dirty.current = false;
    // Vai à aba alterada; `v` remonta o formulário com os dados novos (revisão técnica I7).
    if (path.startsWith("/parceiro/salao/configuracoes"))
      router.push(abaHref(aba, id));
    else router.refresh();
  };
  const reset = () => setState({ msgs: [], session: crypto.randomUUID() });

  const pageChips = chips[page] ?? chips.painel ?? [];
  const last = state?.msgs.at(-1);
  const suggestions =
    last?.role === "assistant" && last.sugestoes?.length
      ? last.sugestoes
      : pageChips;

  const body: ReactNode = (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-divider px-4 py-3">
        <div>
          <h2 id={titleId} className="text-base font-bold text-ink">
            Assistente do salão
          </h2>
          <p className="text-xs text-ink-muted">
            Peça uma mudança ou tire uma dúvida. Nada muda sem o seu clique.
          </p>
        </div>
        <div className="flex items-center">
          {state && state.msgs.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="min-h-11 px-2 text-xs text-ink-muted underline"
            >
              Nova conversa
            </button>
          )}
          <button
            type="button"
            aria-label="Fechar o assistente"
            onClick={close}
            className="inline-flex size-11 items-center justify-center rounded-sm text-ink hover:bg-surface-muted"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </header>
      <div
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
        aria-live="polite"
        aria-busy={busy}
      >
        {state?.msgs.length === 0 && (
          <p className="text-sm text-ink-muted">
            Exemplos: trocar a oferta de um convite, tirar um prato das ofertas,
            mudar o teto de um horário, ou perguntar como foi a semana.
          </p>
        )}
        {state?.msgs.map((m, i) =>
          m.role === "user" ? (
            <p
              key={i}
              className="ml-8 rounded-md bg-surface-muted px-3 py-2 text-sm text-ink"
            >
              {m.text}
            </p>
          ) : (
            <div key={i} className="space-y-2">
              <p className="text-sm text-ink">{m.text}</p>
              {m.cards?.map((c, j) => (
                <ProposalCard
                  key={c.id ?? `r${i}-${j}`}
                  card={c}
                  dirty={() => dirty.current}
                  onApplied={onApplied}
                />
              ))}
              {m.atalhos && m.atalhos.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Atalhos">
                  {m.atalhos.map((a) => (
                    <li key={a.href}>
                      <a
                        href={a.href}
                        className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-sm text-ink hover:bg-surface-muted"
                      >
                        {a.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        )}
        {busy && (
          <p className="text-sm text-ink-muted">
            Consultando os dados do restaurante…
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-text">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-divider px-4 py-3">
        {suggestions.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2" aria-label="Sugestões">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send(s)}
                  className="min-h-11 rounded-full bg-surface-muted px-3 text-left text-sm text-ink hover:bg-divider disabled:opacity-60"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <label className="sr-only" htmlFor={`${titleId}-q`}>
            Seu pedido
          </label>
          <textarea
            id={`${titleId}-q`}
            ref={inputRef}
            value={text}
            maxLength={1000}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
            placeholder="Ex.: troca a oferta do convite da tarde por uma sobremesa"
            className="min-h-11 flex-1 resize-none rounded-sm border border-border px-3 py-2 text-sm text-ink"
          />
          <Button
            variant="primary-portal"
            type="submit"
            loading={busy}
            disabled={!text.trim()}
          >
            Enviar
          </Button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          As respostas usam IA e passam por provedores fora do Brasil. Nomes de
          clientes podem ser enviados; contatos não. No Portal, nada muda sem o
          seu clique.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Sempre montado (escondido com o painel aberto): o foco volta para ele ao fechar. */}
      {
        <button
          ref={launcher}
          hidden={open}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-haspopup={desktop ? undefined : "dialog"}
          className="fixed right-4 bottom-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full bg-red-button px-4 py-2 text-sm font-semibold text-white shadow-high hover:brightness-95"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
          Assistente
        </button>
      }
      {desktop && open && (
        <aside
          aria-labelledby={titleId}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          className="fixed right-0 bottom-0 z-30 w-[400px] border-l border-divider bg-surface shadow-high"
          style={{ top: "var(--proto-h, 24px)" }}
        >
          {body}
        </aside>
      )}
      {/* Celular: tela cheia modal. O elemento existe sempre (o 1º render bate com o servidor); só abre fora do computador. */}
      <dialog
        ref={dialogRef}
        aria-labelledby={desktop ? undefined : titleId}
        {...dialogProps}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-surface p-0"
      >
        {open && !desktop && body}
      </dialog>
    </>
  );
}
