"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { KitView } from "@/src/modules/kit/application/kit";
import { FIELD_MAX, PIECE_LABEL, VERSION_FIELDS, type VersionField } from "@/src/modules/kit/domain/templates";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { SidePanel } from "../components/SidePanel";
import { Switch } from "../components/Switch";
import { BillHolder, KitPiece, WaiterCard } from "./KitPiece";

const FIELD_LABEL: Record<VersionField, string> = { titulo: "Título", subtitulo: "Subtítulo", acao: "Frase de ação" };
const ORIGEM: Record<string, string> = { ia: "Escrito pela IA", sem_ia: "Texto modelo (sem IA)", dono: "Editado por você" };
const SCALE = { display: 0.36, cartaz: 0.26 };
const DIM = { display: { w: 148, h: 210 }, cartaz: { w: 210, h: 297 } };

async function call(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

/** Gestão do kit (espec. 3.4): editar, regenerar campo, aprovar, imprimir e marcar "no salão". */
export function KitManager({ initial, restaurantName, qrs, billHolder = false }: { initial: KitView; restaurantName: string; qrs: Record<string, string>; billHolder?: boolean }) {
  const router = useRouter();
  const [kit, setKit] = useState(initial);
  const [editing, setEditing] = useState<"A" | "B" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reviewing = kit.pieces.some((p) => p.variants.some((v) => v.review?.status === "revisando"));
  useEffect(() => {
    if (!kit.generating && !reviewing) return;
    const t = setTimeout(async () => {
      const r = await call("/api/parceiro/kit", "GET").catch(() => null);
      if (r?.ok) {
        setKit(r.data as unknown as KitView);
        if (!(r.data as unknown as KitView).generating) router.refresh();
      } else setKit((k) => ({ ...k })); // erro passageiro: tenta de novo (revisão da S2)
    }, 2000);
    return () => clearTimeout(t);
  }, [kit, router, reviewing]);

  const refresh = async () => {
    const r = await call("/api/parceiro/kit", "GET");
    if (r.ok) setKit(r.data as unknown as KitView);
    router.refresh();
  };

  if (!kit.pieces.length) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink">Seu kit ainda não foi gerado.</p>
        <div>
          <Button
            variant="primary-portal"
            loading={busy === "gerar"}
            onClick={async () => {
              setBusy("gerar");
              const r = await call("/api/parceiro/kit", "POST");
              setBusy(null);
              if (r.ok) {
                setKit(r.data as unknown as KitView);
                router.refresh();
              } else setMsg(r.status === 429 ? "Limite de gerações de hoje atingido." : "Não conseguimos gerar agora. Tente de novo.");
            }}
          >
            Gerar meu kit
          </Button>
        </div>
        {msg && <p role="alert" className="text-sm font-medium text-red-text">{msg}</p>}
      </div>
    );
  }
  if (kit.generating) {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-3">
        <p className="text-sm text-ink">Gerando seu kit: a IA escreve as chamadas das 2 versões; o código confere as regras…</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-64 animate-pulse rounded-sm bg-surface-muted" />
          <div className="h-64 animate-pulse rounded-sm bg-surface-muted" />
        </div>
      </div>
    );
  }

  const piece = (kind: "display" | "cartaz") => kit.pieces.find((p) => p.kind === kind);
  const byLabel = (label: "A" | "B") => piece("display")?.variants.find((v) => v.label === label) ?? piece("cartaz")?.variants.find((v) => v.label === label);
  const waiter = kit.pieces.find((p) => p.kind === "garcom");
  const bill = kit.pieces.find((p) => p.kind === "porta_conta");
  async function addBill() {
    setBusy("porta_conta");
    const r = await call("/api/parceiro/kit/porta-conta", "POST");
    setBusy(null);
    if (r.ok) setKit(r.data as unknown as KitView);
    else setMsg("Não conseguimos adicionar o porta-conta agora. Tente de novo.");
    router.refresh();
  }

  async function pieceAction(pieceId: string, acao: "aprovar" | "no_salao" | "fora_do_salao") {
    setBusy(`${pieceId}:${acao}`);
    const r = await call("/api/parceiro/kit/peca", "POST", { pieceId, acao });
    setBusy(null);
    if (!r.ok) setMsg(r.data.erro === "revisor" ? "O revisor ainda está conferindo ou pediu ajustes nos textos desta peça. Veja os motivos abaixo de cada versão." : r.status === 409 ? "Aprove a peça antes de marcar que está no salão." : "Não conseguimos salvar. Tente de novo.");
    await refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {kit.origem && (
        <p className="text-sm text-ink-muted">
          <Badge tone={kit.origem === "ia" ? "outline-red" : "neutral"}>{ORIGEM[kit.origem]}</Badge>
        </p>
      )}
      {(["display", "cartaz"] as const).map((kind) => {
        const p = piece(kind);
        if (!p) return null;
        return (
          <section key={kind} aria-labelledby={`peca-${kind}`} className="flex flex-col gap-3 rounded-sm border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`peca-${kind}`} className="text-lg font-bold text-ink">
                {PIECE_LABEL[kind]}
              </h2>
              <Badge tone={p.status === "no_salao" ? "green" : "neutral"}>{p.status === "no_salao" ? "No salão" : p.status === "aprovado" ? "Aprovada" : "Rascunho"}</Badge>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {p.variants.map((v) => (
                <li key={v.id} className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-ink">Versão {v.label}</p>
                  <div aria-hidden="true" className="overflow-hidden rounded-sm border border-border bg-white" style={{ width: `${DIM[kind].w * SCALE[kind]}mm`, height: `${DIM[kind].h * SCALE[kind]}mm` }}>
                    <div style={{ transform: `scale(${SCALE[kind]})`, transformOrigin: "top left" }}>
                      <KitPiece kind={kind} restaurantName={restaurantName} versionLabel={v.label} texts={{ titulo: v.rendered.titulo ?? "", subtitulo: v.rendered.subtitulo ?? "", acao: v.rendered.acao ?? "" }} qrSrc={qrs[v.id] ?? ""} />
                    </div>
                  </div>
                  <p className="sr-only">
                    Prévia: {[v.rendered.titulo, v.rendered.subtitulo, v.rendered.acao].map((t = "") => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)).join(" ")}
                  </p>
                  {v.review && <ReviewNote review={v.review} />}
                  {v.locked && (
                    <p className="text-xs text-ink-muted" data-testid={`travada-${kind}-${v.label}`}>
                      {v.scans} {v.scans === 1 ? "leitura" : "leituras"} do QR: o texto fica travado para não misturar o que já foi medido. Para mudar, crie uma nova versão (QR novo; reimprima).
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {v.locked ? (
                      <button
                        type="button"
                        className="min-h-11 font-semibold text-red-text underline disabled:opacity-50"
                        disabled={busy === `nova:${v.label}`}
                        onClick={async () => {
                          if (!window.confirm(`Criar uma nova versão ${v.label}? Ela terá um QR novo (precisa reimprimir o display e o cartaz). O QR atual continua funcionando.`)) return;
                          setBusy(`nova:${v.label}`);
                          const r = await call("/api/parceiro/kit/campo", "PATCH", { label: v.label });
                          setBusy(null);
                          setMsg(r.ok ? null : "Não conseguimos criar a nova versão. Tente de novo.");
                          await refresh();
                          if (r.ok) setEditing(v.label as "A" | "B");
                        }}
                      >
                        Criar nova versão {v.label}
                      </button>
                    ) : (
                      <button type="button" className="min-h-11 font-semibold text-red-text underline" onClick={() => setEditing(v.label as "A" | "B")}>
                        Editar versão {v.label}
                      </button>
                    )}
                    <a className="inline-flex min-h-11 items-center font-semibold text-red-text underline" href={`/parceiro/imprimir/${v.id}`}>
                      Imprimir versão {v.label}
                    </a>
                    <a className="inline-flex min-h-11 items-center font-semibold text-red-text underline" href={`/r/${kit.slug}?p=${v.token}`} target="_blank" rel="noreferrer">
                      Abrir este QR
                    </a>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-4 border-t border-divider pt-3">
              {p.status === "rascunho" ? (
                <Button variant="primary-portal" loading={busy === `${p.id}:aprovar`} onClick={() => pieceAction(p.id, "aprovar")}>
                  Aprovar peça
                </Button>
              ) : (
                <Switch label="Está no salão" checked={p.status === "no_salao"} onChange={(on) => pieceAction(p.id, on ? "no_salao" : "fora_do_salao")} />
              )}
            </div>
          </section>
        );
      })}

      {waiter && (
        <section aria-labelledby="peca-garcom" className="flex flex-col gap-3 rounded-sm border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="peca-garcom" className="text-lg font-bold text-ink">
              {PIECE_LABEL.garcom}
            </h2>
            <Badge tone="neutral">{waiter.status === "rascunho" ? "Rascunho" : "Aprovado"}</Badge>
          </div>
          <p className="text-sm text-ink-muted">Roteiro fixo, só sobre o benefício de 1ª visita (não fala do convite, para não contaminar o grupo de controle).</p>
          <div aria-hidden="true" className="overflow-hidden rounded-sm border border-border" style={{ width: `${105 * 0.5}mm`, height: `${148.5 * 0.5}mm` }}>
            <div style={{ transform: "scale(0.5)", transformOrigin: "top left" }}>
              <WaiterCard restaurantName={restaurantName} frase={waiter.variants[0]?.rendered.frase ?? ""} />
            </div>
          </div>
          <p className="text-sm text-ink">{waiter.variants[0]?.rendered.frase}</p>
          <div className="flex flex-wrap items-center gap-4">
            <a className="inline-flex min-h-11 items-center text-sm font-semibold text-red-text underline" href={`/parceiro/imprimir/${waiter.variants[0]?.id}`}>
              Imprimir cartões do garçom
            </a>
            {waiter.status === "rascunho" && (
              <Button variant="outline-portal" loading={busy === `${waiter.id}:aprovar`} onClick={() => pieceAction(waiter.id, "aprovar")}>
                Aprovar cartão
              </Button>
            )}
          </div>
        </section>
      )}

      {/* S6.4 (D192): porta-conta — texto modelo, 1 versão, QR próprio. */}
      {billHolder && bill && (
        <section aria-labelledby="peca-porta_conta" className="flex flex-col gap-3 rounded-sm border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="peca-porta_conta" className="text-lg font-bold text-ink">
              {PIECE_LABEL.porta_conta}
            </h2>
            <Badge tone={bill.status === "no_salao" ? "green" : "neutral"}>{bill.status === "no_salao" ? "No salão" : bill.status === "aprovado" ? "Aprovada" : "Rascunho"}</Badge>
          </div>
          <p className="text-sm text-ink-muted">Vai junto da conta: lembra o check-in na hora de pagar. Texto fixo, sem IA; fala do convite só como possibilidade, porque quem não recebe convite também vê esta peça.</p>
          {bill.variants[0] && qrs[bill.variants[0].id] && (
            <div aria-hidden="true" className="overflow-hidden rounded-sm border border-border" style={{ width: `${210 * 0.4}mm`, height: `${99 * 0.4}mm` }}>
              <div style={{ transform: "scale(0.4)", transformOrigin: "top left" }}>
                <BillHolder
                  restaurantName={restaurantName}
                  qrSrc={qrs[bill.variants[0].id]!}
                  texts={{ titulo: bill.variants[0].rendered.titulo ?? "", subtitulo: bill.variants[0].rendered.subtitulo ?? "", acao: bill.variants[0].rendered.acao ?? "" }}
                />
              </div>
            </div>
          )}
          <p className="text-sm text-ink" data-testid="porta-conta-texto">
            {bill.variants[0]?.rendered.titulo} · {bill.variants[0]?.rendered.subtitulo}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a className="inline-flex min-h-11 items-center text-sm font-semibold text-red-text underline" href={`/parceiro/imprimir/${bill.variants[0]?.id}`}>
              Imprimir porta-contas (3 por folha)
            </a>
            {bill.variants[0] && (
              <a className="inline-flex min-h-11 items-center text-sm font-semibold text-red-text underline" href={`/r/${kit.slug}?p=${bill.variants[0].token}`} target="_blank" rel="noopener">
                Abrir o QR do porta-conta
              </a>
            )}
            {bill.status === "rascunho" ? (
              <Button variant="outline-portal" loading={busy === `${bill.id}:aprovar`} onClick={() => pieceAction(bill.id, "aprovar")}>
                Aprovar porta-conta
              </Button>
            ) : (
              <Switch label="Está no salão" checked={bill.status === "no_salao"} onChange={(on) => pieceAction(bill.id, on ? "no_salao" : "fora_do_salao")} />
            )}
          </div>
        </section>
      )}
      {billHolder && !bill && (
        <section aria-labelledby="peca-porta_conta-novo" className="flex flex-col gap-2 rounded-sm border border-dashed border-ink-muted p-4">
          <h2 id="peca-porta_conta-novo" className="text-lg font-bold text-ink">
            Porta-conta
          </h2>
          <p className="text-sm text-ink">Uma peça nova que vai junto da conta e lembra o check-in na hora de pagar, com QR próprio.</p>
          <Button variant="outline-portal" className="self-start" loading={busy === "porta_conta"} onClick={() => void addBill()}>
            Adicionar porta-conta
          </Button>
        </section>
      )}

      <RecadoEditor initial={kit.recado ?? ""} />
      {msg && <p role="alert" className="text-sm font-medium text-red-text">{msg}</p>}

      {editing && byLabel(editing) && (
        <VersionEditor
          label={editing}
          texts={byLabel(editing)!.texts as Record<VersionField, string>}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function VersionEditor({ label, texts, onClose, onSaved }: { label: "A" | "B"; texts: Record<VersionField, string>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [vals, setVals] = useState<Record<VersionField, string>>({ titulo: texts.titulo ?? "", subtitulo: texts.subtitulo ?? "", acao: texts.acao ?? "" });
  const [notes, setNotes] = useState<Partial<Record<VersionField, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function save() {
    setBusy("salvar");
    const n: Partial<Record<VersionField, string>> = {};
    for (const f of VERSION_FIELDS) {
      if (vals[f] === (texts[f] ?? "")) continue;
      const r = await call("/api/parceiro/kit/campo", "PUT", { label, field: f, value: vals[f] });
      if (r.status === 409) n[f] = "Esta versão já tem leituras do QR: crie uma nova versão para mudar o texto.";
      else if (!r.ok) n[f] = "Não dá para usar este texto (dados pessoais, HTML, referência desconhecida ou longo demais).";
      else if ((r.data.warnings as string[] | undefined)?.includes("convite")) n[f] = "Salvo. Atenção: dia, horário ou item do convite aparecem para todos os clientes e atrapalham a comparação com quem não recebe convite.";
      else if ((r.data.warnings as string[] | undefined)?.length) n[f] = "Salvo. Atenção: cita número ou promessa — o benefício que vale é o da regra.";
    }
    setNotes(n);
    setBusy(null);
    await onSaved();
    if (!Object.values(n).some((x) => x?.startsWith("Não"))) onClose();
  }

  async function regen(f: VersionField) {
    setBusy(f);
    const r = await call("/api/parceiro/kit/campo", "POST", { label, field: f });
    setBusy(null);
    if (r.ok) {
      await onSaved();
      const k = await call("/api/parceiro/kit", "GET");
      const v = (k.data as unknown as KitView).pieces.find((p) => p.kind === "display")?.variants.find((x) => x.label === label);
      if (v) setVals((x) => ({ ...x, [f]: (v.texts as Record<string, string>)[f] ?? x[f] }));
      setNotes((x) => ({ ...x, [f]: (r.data.warnings as string[] | undefined)?.includes("sem_ia") ? "A IA não respondeu: usamos o texto modelo." : undefined }));
    } else setNotes((x) => ({ ...x, [f]: r.status === 429 ? "Limite de regenerações de hoje atingido." : "Não conseguimos regenerar agora." }));
  }

  return (
    <SidePanel
      open
      onClose={onClose}
      title={`Editar versão ${label}`}
      footer={
        <>
          <Button variant="outline-portal" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary-portal" loading={busy === "salvar"} onClick={save}>
            Salvar
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">Vale para o display e o cartaz desta versão. Use {"{beneficio}"} e {"{recompensa}"} para citar o benefício e a recompensa (o sistema escreve o texto certo).</p>
      <div className="mt-4 flex flex-col gap-5">
        {VERSION_FIELDS.map((f) => (
          <div key={f} className="flex flex-col gap-1.5">
            <label htmlFor={`campo-${f}`} className="text-sm font-medium text-ink">
              {FIELD_LABEL[f]}
            </label>
            <textarea id={`campo-${f}`} className="min-h-16 rounded-md border border-border p-3 text-base" value={vals[f]} maxLength={FIELD_MAX[f] + 20} onChange={(e) => setVals((x) => ({ ...x, [f]: e.target.value }))} aria-describedby={`nota-${f}`} />
            <div id={`nota-${f}`} className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
              <span>
                {vals[f].length}/{FIELD_MAX[f]} (o benefício entra com o texto completo)
              </span>
              <button type="button" className="min-h-11 font-semibold text-red-text underline" disabled={busy === f} onClick={() => regen(f)}>
                {busy === f ? "Regenerando…" : "Regenerar com IA"}
              </button>
            </div>
            {notes[f] && <p className="text-xs font-medium text-red-text">{notes[f]}</p>}
          </div>
        ))}
      </div>
    </SidePanel>
  );
}

function RecadoEditor({ initial }: { initial: string }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section aria-labelledby="recado" className="flex flex-col gap-2 rounded-sm border border-border p-4">
      <h2 id="recado" className="text-lg font-bold text-ink">
        Recado do restaurante
      </h2>
      <p className="text-sm text-ink-muted">Aparece no card do benefício no app, para todos os clientes.</p>
      <textarea aria-labelledby="recado" className="min-h-16 rounded-md border border-border p-3 text-base" maxLength={140} value={v} onChange={(e) => setV(e.target.value)} />
      <div className="flex items-center gap-3">
        <Button
          variant="outline-portal"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const r = await call("/api/parceiro/kit/recado", "PUT", { value: v });
            setBusy(false);
            setMsg(r.ok ? ((r.data.warnings as string[] | undefined)?.includes("convite") ? "Salvo, com aviso: dia, horário ou item do convite atrapalham a comparação com quem não recebe convite." : (r.data.warnings as string[] | undefined)?.length ? "Salvo, com aviso: cita número ou promessa." : "Salvo.") : "Não dá para usar este recado (dados pessoais, HTML ou longo demais).");
          }}
        >
          Salvar recado
        </Button>
        {msg && <p role="status" className="text-sm text-ink">{msg}</p>}
      </div>
    </section>
  );
}

const REVIEW_LABEL: Record<string, string> = { revisando: "Revisor: conferindo…", ok: "Revisor: ok", atencao: "Revisor: atenção", bloquear: "Revisor: ajustar antes de imprimir", nao_revisado: "Revisor: não revisado" };

/** Selo do revisor (flag): estado não depende só de cor; motivos em lista. */
function ReviewNote({ review }: { review: NonNullable<KitView["pieces"][number]["variants"][number]["review"]> }) {
  return (
    <div className="flex flex-col gap-1 text-xs" data-testid="revisor">
      <Badge tone={review.status === "bloquear" ? "outline-red" : "neutral"}>{REVIEW_LABEL[review.status] ?? review.status}</Badge>
      {review.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-ink">
          {review.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
