"use client";

import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { Button } from "@/src/ui/components/Button";
import { useModalDialog } from "@/src/ui/components/useModalDialog";
import { abaHref, ProposalCard, type Card, type CardEstado } from "./ProposalCard";

type Msg = {
  role: "user" | "assistant";
  text: string;
  cards?: Card[];
  /** Estado de cada cartão depois da decisão (revisão S8: voltar/atualizar não reabre "Aplicar"). */
  estados?: Record<string, CardEstado>;
  /** Quando a resposta chegou (cartão com mais de 30 min aparece vencido). */
  at?: number;
  atalhos?: Array<{ label: string; href: string }>;
  sugestoes?: string[];
  semIa?: boolean;
};
type Chips = Record<string, string[]>;
type Conversa = { msgs: Msg[]; session: string };

const PREFIX = "copiloto:conversa:";
const MAX_KEEP = 12;
const PANEL_W = "400px";
const PROPOSAL_TTL_MS = 30 * 60_000;
const noopSubscribe = () => () => {};
/** Relógio fora do render (o compilador do React acusa `Date.now()` dentro do componente). */
const clockNow = () => Date.now();

function useMedia(q: string, server: boolean): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(q).matches,
    () => server,
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

/**
 * Conversa por dono + restaurante (revisão S8, segurança 1): outra conta ou outra loja na mesma aba não vê nomes de
 * clientes nem manda o histórico de outro restaurante ao modelo. Conversas de outros escopos são apagadas.
 */
function load(scope: string): Conversa {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(PREFIX) && k !== PREFIX + scope) sessionStorage.removeItem(k);
    const raw = sessionStorage.getItem(PREFIX + scope);
    if (raw) return JSON.parse(raw) as Conversa;
  } catch {
    /* sessão sem storage: começa vazio */
  }
  return { msgs: [], session: crypto.randomUUID() };
}

/** Sair do Portal apaga a conversa deste navegador. */
export function clearCopilotConversations() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(PREFIX)) sessionStorage.removeItem(k);
  } catch {
    /* sem storage */
  }
}

/**
 * Assistente do salão (S8 — D260–D263). Desenho "pedido → cartões": chips em destaque, um campo e poucas mensagens.
 * Computador largo (≥ 1280 px): painel não modal que empurra o conteúdo. Entre 1024 e 1279 px (modo apresentação):
 * sobrepõe, para o conteúdo não ficar espremido. Celular: tela cheia modal, que fecha ao aplicar ou navegar.
 * A conversa fica só neste navegador (sessionStorage); o servidor guarda só as propostas.
 */
export function Copilot({ chips, scope }: { chips: Chips; scope: string }) {
  const desktop = useMedia("(min-width: 1024px)", true);
  const wide = useMedia("(min-width: 1280px)", true);
  const path = usePathname() ?? "";
  const page = pageOf(path);
  const onboarding = page === "ativar";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // A conversa só existe no navegador: o painel só aparece depois de um clique, então o 1º render bate com o servidor.
  const [state, setState] = useState<Conversa | null>(() => (typeof window === "undefined" ? null : load(scope)));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(clockNow);
  const dirty = useRef(false);
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  // Onde fica o botão: na barra lateral (computador) ou no cabeçalho fixo (celular) — nada flutua sobre o conteúdo.
  const slotId = desktop ? "copiloto-slot-side" : "copiloto-slot-head";
  const slot = useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById(slotId),
    () => null,
  );
  const endRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const wasOpen = useRef(false);
  const { ref: dialogRef, dialogProps } = useModalDialog(open && !desktop, close);

  useEffect(() => {
    if (!state) return;
    try {
      sessionStorage.setItem(PREFIX + scope, JSON.stringify({ ...state, msgs: state.msgs.slice(-MAX_KEEP) }));
    } catch {
      /* sem storage: segue só na memória */
    }
  }, [state, scope]);
  // Painel aberto empurra o conteúdo só em tela larga (revisão S8, produto 1).
  useEffect(() => {
    document.documentElement.style.setProperty("--copiloto-w", open && wide ? PANEL_W : "0px");
    return () => document.documentElement.style.setProperty("--copiloto-w", "0px");
  }, [open, wide]);
  // Edição não salva no formulário da tela; salvar (submit ou botão "Salvar…") zera (revisão S8, produto 10).
  useEffect(() => {
    dirty.current = false;
    const main = document.getElementById("conteudo");
    const mark = () => (dirty.current = true);
    const clear = (e: Event) => {
      const b = (e.target as HTMLElement | null)?.closest("button");
      if (e.type === "submit" || (b && /^(Salvar|Adicionar|Usar|Continuar)/.test(b.textContent?.trim() ?? ""))) dirty.current = false;
    };
    main?.addEventListener("input", mark);
    main?.addEventListener("submit", clear, true);
    main?.addEventListener("click", clear, true);
    return () => {
      main?.removeEventListener("input", mark);
      main?.removeEventListener("submit", clear, true);
      main?.removeEventListener("click", clear, true);
    };
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
      const turns = msgs.slice(-MAX_KEEP).map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }));
      const res = await fetch("/api/parceiro/copiloto", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ turns, page, sessionId: state.session }), cache: "no-store" });
      if (res.status === 429) throw new Error("Limite de pedidos atingido. Tente mais tarde ou faça a mudança pelo formulário.");
      if (!res.ok) throw new Error("Não consegui responder agora. Tente de novo.");
      const d = (await res.json()) as { resposta: string; propostas: Card[]; sugestoes: string[]; atalhos: Array<{ label: string; href: string }>; generatedBy: "ia" | "sem_ia" };
      const at = clockNow();
      setNow(at);
      setState((s) => (s ? { ...s, msgs: [...msgs, { role: "assistant", text: d.resposta, cards: d.propostas, at, atalhos: d.atalhos, sugestoes: d.sugestoes, semIa: d.generatedBy === "sem_ia" }] } : s));
    } catch (e) {
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sem conexão com o servidor.");
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
  const onEstado = (i: number) => (id: string, e: CardEstado) => setState((s) => (s ? { ...s, msgs: s.msgs.map((m, k) => (k === i ? { ...m, estados: { ...m.estados, [id]: e } } : m)) } : s));
  const onApplied = (aba: string, id: string) => {
    dirty.current = false;
    // No celular, o painel fecha para mostrar a tela atualizada (revisão S8, produto 8).
    if (!desktop) close();
    // Vai à aba alterada; `v` remonta o formulário e mostra a faixa "Atualizado pelo assistente".
    if (aba !== "plano" && (path.startsWith("/parceiro/salao/configuracoes") || !desktop)) router.push(abaHref(aba, id));
    else router.refresh();
  };
  const onNavigate = () => {
    if (!desktop) close();
  };
  const reset = () => setState({ msgs: [], session: crypto.randomUUID() });
  // Chip que termina em "…" só preenche o campo para o dono completar (revisão S8, produto 7).
  const pickChip = (c: string) => {
    if (c.endsWith("…")) {
      setText(`${c.slice(0, -1)} `);
      inputRef.current?.focus();
    } else void send(c);
  };

  const pageChips = chips[page] ?? chips.painel ?? [];
  const last = state?.msgs.at(-1);
  const lastAsked = [...(state?.msgs ?? [])].reverse().find((m) => m.role === "user")?.text;
  const suggestions = (last?.role === "assistant" && last.sugestoes?.length ? last.sugestoes : pageChips).filter((s) => s !== lastAsked);

  const body: ReactNode = (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-divider px-4 py-3">
        <div>
          <h2 id={titleId} className="text-base font-bold text-ink">
            Assistente do salão
          </h2>
          <p className="text-xs text-ink-muted">{onboarding ? "Tire dúvidas sobre a ativação." : "Peça uma mudança ou tire uma dúvida."}</p>
        </div>
        <div className="flex items-center">
          {state && state.msgs.length > 0 && (
            <button type="button" onClick={reset} className="min-h-11 px-2 text-xs whitespace-nowrap text-ink-muted underline">
              Nova conversa
            </button>
          )}
          <button type="button" aria-label="Fechar o assistente" onClick={close} className="inline-flex size-11 items-center justify-center rounded-sm text-ink hover:bg-surface-muted">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" role="log" aria-label="Conversa com o assistente" aria-busy={busy}>
        {state?.msgs.length === 0 && (
          <p className="text-sm text-ink-muted">
            {onboarding ? "Pergunte o que quiser sobre os passos: o que é horário vazio, teto de convites, margem…" : "Exemplos: trocar a oferta de um convite, tirar um prato das ofertas, mudar o teto de um horário, ou perguntar como foi a semana."}
          </p>
        )}
        {state?.msgs.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-8 rounded-md bg-surface-muted px-3 py-2 text-sm text-ink">
              {m.text}
            </p>
          ) : (
            <div key={i} className="space-y-2">
              <p className="text-sm text-ink">{m.text}</p>
              {m.cards?.map((c, j) => (
                <ProposalCard
                  key={c.id ?? `r${i}-${j}`}
                  card={c}
                  estado={c.id ? m.estados?.[c.id] : undefined}
                  stale={!!m.at && now - m.at > PROPOSAL_TTL_MS}
                  dirty={() => dirty.current}
                  onApplied={onApplied}
                  onEstado={onEstado(i)}
                  onNavigate={onNavigate}
                />
              ))}
              {m.atalhos && m.atalhos.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Atalhos">
                  {m.atalhos.map((a) => (
                    <li key={a.href}>
                      <a href={a.href} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-sm text-ink hover:bg-surface-muted">
                        {a.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        )}
        {busy && <p className="text-sm text-ink-muted">{onboarding ? "Pensando…" : "Consultando os dados do restaurante…"}</p>}
        <div ref={endRef} />
      </div>
      {error && (
        <p role="alert" className="px-4 pb-1 text-sm text-red-text">
          {error}
        </p>
      )}
      <div className="border-t border-divider px-4 py-3">
        {suggestions.length > 0 && (
          // Uma linha só, com rolagem lateral (revisão S8, produto 11: a área fixa ocupava 1/3 da altura).
          <ul className="no-scrollbar mb-2 flex gap-2 overflow-x-auto" aria-label="Sugestões">
            {suggestions.map((s) => (
              <li key={s} className="shrink-0">
                <button type="button" disabled={busy} onClick={() => pickChip(s)} className="min-h-11 rounded-full bg-surface-muted px-3 text-sm whitespace-nowrap text-ink hover:bg-divider disabled:opacity-60">
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
            placeholder={onboarding ? "Ex.: o que é o teto de convites?" : "Ex.: troca a oferta do convite da tarde por uma sobremesa"}
            className="min-h-11 flex-1 resize-none rounded-sm border border-border px-3 py-2 text-sm text-ink"
          />
          <Button variant="primary-portal" type="submit" loading={busy} disabled={!text.trim()}>
            Enviar
          </Button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">As respostas usam IA e passam por provedores fora do Brasil. Nomes de clientes podem ser enviados; contatos não. Aqui, nada muda sem o seu clique.</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Sempre montado (no painel aberto, desabilitado): o foco volta para ele ao fechar. */}
      {slot &&
        createPortal(
          <button
            ref={launcher}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup={desktop ? undefined : "dialog"}
            className={
              desktop
                ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-red-text px-3 text-sm font-semibold text-red-text hover:bg-nav-active"
                : "inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-sm font-semibold text-red-text hover:bg-surface-muted"
            }
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
            </svg>
            Assistente
          </button>,
          slot,
        )}
      {desktop && open && (
        <aside
          aria-labelledby={titleId}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          className="fixed right-0 bottom-0 z-30 w-[400px] max-w-full border-l border-divider bg-surface shadow-high"
          style={{ top: "var(--proto-h, 24px)" }}
        >
          {body}
        </aside>
      )}
      {/* Celular: tela cheia modal. O elemento existe sempre (o 1º render bate com o servidor); só abre fora do computador. */}
      <dialog ref={dialogRef} aria-labelledby={desktop ? undefined : titleId} {...dialogProps} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-surface p-0">
        {open && !desktop && body}
      </dialog>
    </>
  );
}
