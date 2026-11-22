"use client";

import { Checkbox } from "../components/Checkbox";
import { confirmDialog } from "../components/ConfirmDialog";
import { UnsavedHint, useUnsavedGuard } from "../components/Unsaved";
import {
  inviteIssues,
  reasonMessage,
} from "@/src/modules/ia/guardrails/messages";
import {
  INTENSITIES,
  INTENSITY_LABEL,
  type Intensity,
} from "@/src/modules/beneficios/domain/slots";

const TABLES_HINT =
  "Com isso calculamos quantos convites entregar. Ex.: 4 mesas ≈ 16 convites por semana; depois o número se ajusta pelo uso real.";
import { Select } from "../components/Select";
import { useNumberField } from "../components/use-number-field";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { MenuCategory } from "@/src/modules/beneficios/domain/menu";
import { describeOffer } from "@/src/modules/beneficios/domain/offers";
import type { NotifyView, SettingsView } from "@/src/modules/config/application/update-settings";
import { NotifySettingsTab } from "./NotifySettingsTab";
import { Button } from "../components/Button";
import { DaySelector } from "../components/DaySelector";
import { Field } from "../components/Field";
import { Tabs } from "../components/Tabs";
import { TimeRange } from "../components/TimeRange";
import { OfferEditor, type OfferValue } from "./OfferEditor";
import { Switch } from "../components/Switch";
import { NAME_PROBLEM_TEXT } from "@/src/modules/onboarding/domain/safe-name";

const CATS: Array<[MenuCategory, string]> = [
  ["entrada", "Entrada"],
  ["prato", "Prato"],
  ["porcao", "Porção"],
  ["sobremesa", "Sobremesa"],
  ["bebida", "Bebida"],
];
const reais = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));
const cents = (s: string) => {
  const v = Number(s.replace(/\./g, "").replace(",", "."));
  return s.trim() === "" || !Number.isFinite(v) ? null : Math.round(v * 100);
};
const ERR: Record<string, string> = {
  oferta: "Oferta inválida: confira o item (categoria) e o desconto (até 50%).",
  texto: "Escreva o texto com até 160 caracteres, sem e-mail, telefone ou sinais como < >.",
  rede: "Sem conexão com o servidor. Verifique a internet e tente de novo.",
  em_uso:
    "Este item está numa oferta em vigor. Troque a oferta antes de excluir.",
  ...NAME_PROBLEM_TEXT,
  ultima_faixa: "O restaurante precisa de pelo menos um horário vazio.",
  faixa: "Horário inválido: precisa caber no funcionamento, com fim depois do início.",
  funcionamento: "O novo funcionamento não cobre algum horário vazio. Ajuste os horários vazios antes.",
  sem_candidatas: "Não há oferta válida no cardápio para este horário.",
  sem_opcao: "Os convites ficariam sem nenhuma oferta possível. Deixe outro prato entrar em ofertas antes.",
  limite_faixas: "Já são 8 horários vazios. Desative um antes de criar outro.",
  formato: "Confira os campos.",
};

function okWithWarnings(okText: string, w: string[]): string {
  if (w.includes("prato_fora_da_oferta")) return `${okText}. Atenção: o texto do convite cita um prato que não é mais a oferta; revise o texto.`;
  // S6.3a (D197): avisos de "Pode entrar em ofertas".
  const offer = [w.includes("em_uso_ate_trocar") ? "está numa oferta em vigor e continua nela até a próxima troca" : null, w.includes("uma_opcao") ? "sobrou só 1 opção de oferta para os convites" : null].filter(Boolean);
  if (offer.length) return `${okText}. Atenção: ${offer.join("; ")}.`;
  return w.length ? `${okText}. Atenção: o texto cita número ou promessa; vale a oferta escolhida acima.` : okText;
}

async function post(body: unknown) {
  const r = await fetch("/api/parceiro/configuracoes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!r)
    return { ok: false, erro: "rede", warnings: [], motivos: [] as string[] };
  const j = (await r.json().catch(() => ({}))) as {
    erro?: string;
    warnings?: string[];
    motivos?: string[];
  };
  return {
    ok: r.ok,
    erro: j.erro,
    warnings: j.warnings ?? [],
    motivos: j.motivos ?? [],
  };
}

/** Erro do servidor → o que fazer. Texto: o motivo exato (ajuste de 21/11), não a lista genérica. */
function errorText(r: { erro?: string; motivos: string[] }): string {
  if (r.erro === "texto" && r.motivos[0])
    return r.motivos[0] === "nome"
      ? "O nome precisa ter pelo menos 2 letras."
      : reasonMessage(r.motivos[0], { maxLen: 160, label: "o texto" });
  return (
    ERR[r.erro ?? "formato"] ??
    "Não conseguimos salvar agora. Tente de novo em instantes."
  );
}

function useSaver() {
  const router = useRouter();
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const save = async (key: string, body: unknown, okText = "Salvo · nova versão em vigor") => {
    setBusy(key);
    const r = await post(body);
    setBusy(null);
    setMsg((m) => ({
      ...m,
      [key]: r.ok
        ? { ok: true, text: okWithWarnings(okText, r.warnings) }
        : { ok: false, text: errorText(r) },
    }));
    if (r.ok) router.refresh();
    return r.ok;
  };
  const Msg = ({ k }: { k: string }) =>
    msg[k] ? (
      <p role="status" className={`text-sm ${msg[k]!.ok ? "text-ink" : "font-medium text-red-text"}`}>
        {msg[k]!.text}
      </p>
    ) : null;
  return { save, busy, Msg };
}

/** Configurações (D120): tudo o que a IA criou fica editável; cada mudança vira versão nova. */
export function ConfigManager({
  v,
  isTest,
  restaurantId,
  notify,
  flags,
  initialTab = "agora",
  integrations,
}: {
  v: SettingsView;
  isTest: boolean;
  restaurantId: string;
  notify?: NotifyView;
  flags?: { agendador: boolean; resumo_email: boolean; plano_agente?: boolean; aprende?: boolean };
  initialTab?: string;
  /** D247: aba "Integrações" (hoje, o assistente de IA por MCP), em vez de um card no fim de todas as abas. */
  integrations?: ReactNode;
}) {
  const [tab, setTab] = useState(initialTab);
  // Pratos "fora das ofertas" (D197) não aparecem nos seletores de oferta.
  const menu = v.menu.filter((m) => m.active && m.offerAllowed).map((m) => ({ id: m.id, name: m.name, category: m.category, priceCents: m.priceCents }));
  return (
    <Tabs
      label="Configurações"
      value={tab}
      onValueChange={setTab}
      items={[
        { id: "agora", label: "Benefício de 1ª visita", content: <OfferTab title="Benefício de 1ª visita" note="Vale em qualquer horário de funcionamento, uma vez por cliente." role="agora" value={v.agora} menu={menu} /> },
        { id: "convites", label: "Horários vazios e convites", content: <SlotsTab v={v} menu={menu} /> },
        { id: "cartela", label: "Cartela", content: <OfferTab title="Recompensa da cartela" note="6 selos, 1 por dia, validade de 90 dias após o 1º check-in (regras iguais às do app)." role="recompensa" value={v.recompensa} menu={menu} /> },
        { id: "cardapio", label: "Cardápio", content: <MenuTab v={v} /> },
        { id: "restaurante", label: "Restaurante", content: <RestaurantTab v={v} isTest={isTest} restaurantId={restaurantId} /> },
        // S6.3a (D197): logo depois de "Restaurante" (revisão de produto I6).
        { id: "ia", label: "IA do restaurante", content: <div className="py-4"><ToneSection v={v} agenteGlobal={!!flags?.plano_agente} aprendeGlobal={flags?.aprende ?? true} /></div> },
        ...(notify && flags ? [{ id: "avisos", label: "Avisos e automação", content: <NotifySettingsTab view={notify} flags={flags} /> }] : []),
        ...(integrations ? [{ id: "integracoes", label: "Integrações", content: <div className="py-4">{integrations}</div> }] : []),
      ]}
    />
  );
}

function OfferTab({ title, note, role, value, menu }: { title: string; note: string; role: "agora" | "recompensa"; value: OfferValue | null; menu: Array<{ id: string; name: string; category: MenuCategory; priceCents: number }> }) {
  const [o, setO] = useState<OfferValue>(value ?? { kind: "doce_gratis", itemId: menu[0]?.id ?? "" });
  const { save, busy, Msg } = useSaver();
  const gain = describeOffer({ kind: o.kind, params: { itemId: o.itemId, pct: o.pct } }, menu, role === "agora" ? "agora" : "recompensa").gain;
  return (
    <section className="flex flex-col gap-3 py-4">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="text-sm text-ink-muted">{note}</p>
      <p className="text-base text-ink">
        O cliente ganha: <strong>{gain}</strong>
      </p>
      <OfferEditor label={title} value={o} menu={menu} onChange={setO} />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary-portal" loading={busy === role} onClick={() => save(role, { acao: "oferta", role, offer: o })}>
          Salvar
        </Button>
        <UnsavedHint dirty={!!value && JSON.stringify(o) !== JSON.stringify(value)} />
        <Msg k={role} />
      </div>
    </section>
  );
}

function SlotsTab({ v, menu }: { v: SettingsView; menu: Array<{ id: string; name: string; category: MenuCategory; priceCents: number }> }) {
  const { save, busy, Msg } = useSaver();
  const [nova, setNova] = useState({
    days: [] as number[],
    startMin: 900,
    endMin: 1080,
    intensity: "um_pouco" as Intensity,
    extraTables: 3,
  });
  const novaTables = useNumberField(nova.extraTables, 1, 99, (n) =>
    setNova((x) => ({ ...x, extraTables: n })),
  );
  return (
    <div className="flex flex-col gap-6 py-4">
      {v.slots.map((s) => (
        <SlotCard key={s.id} s={s} menu={menu} canRemove={v.slots.length > 1} />
      ))}
      <section className="flex flex-col gap-3 rounded-sm border border-dashed border-ink-muted p-4">
        <h2 className="font-semibold text-ink">Adicionar horário vazio</h2>
        <p className="text-sm text-ink-muted">A oferta do convite sai das opções válidas do cardápio (a IA escolhe, se disponível); depois você pode trocar.</p>
        <DaySelector label="Dias do novo horário vazio" value={nova.days} onChange={(days) => setNova({ ...nova, days })} />
        <TimeRange label="Horário do novo horário vazio" start={nova.startMin} end={nova.endMin} onChange={(startMin, endMin) => setNova({ ...nova, startMin, endMin })} />
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Quanto fica vazio?"
            className="w-40"
            value={nova.intensity}
            options={INTENSITIES.map((v) => ({
              value: v,
              label: INTENSITY_LABEL[v],
            }))}
            onChange={(v) => setNova({ ...nova, intensity: v as Intensity })}
          />
          <Field
            className="w-full max-w-sm"
            label="Quantas mesas a mais você quer por semana nesse horário?"
            hint={TABLES_HINT}
            inputMode="numeric"
            {...novaTables}
          />
          <Button
            variant="outline-portal"
            loading={busy === "nova"}
            onClick={() =>
              save(
                "nova",
                { acao: "faixa_nova", ...nova },
                "Horário vazio criado com convite",
              )
            }
          >
            Adicionar
          </Button>
        </div>
        <Msg k="nova" />
      </section>
    </div>
  );
}

function SlotCard({ s, menu, canRemove }: { s: SettingsView["slots"][number]; menu: Array<{ id: string; name: string; category: MenuCategory; priceCents: number }>; canRemove: boolean }) {
  const { save, busy, Msg } = useSaver();
  const [f, setF] = useState({ days: s.days, startMin: s.startMin, endMin: s.endMin, intensity: s.intensity, extraTables: s.extraTables });
  const [o, setO] = useState<OfferValue>(s.offer ?? { kind: "doce_gratis", itemId: menu[0]?.id ?? "" });
  const [cap, setCap] = useState(s.weeklyCap ?? s.extraTables * 4);
  const capField = useNumberField(cap, 1, 999, setCap);
  const slotTables = useNumberField(f.extraTables, 1, 99, (n) => setF((x) => ({ ...x, extraTables: n })));
  const [text, setText] = useState(s.inviteRendered);
  const textChanged = text !== s.inviteRendered;
  // Ajuste de 21/11: mesma regra do servidor, na hora (o texto aqui já vem sem marcações).
  const textIssue = textChanged
    ? inviteIssues(text, {
        items: Object.fromEntries(menu.map((m) => [m.id, m.name])),
        slots: {},
        oferta: "",
      })
    : { errors: [] as string[], warnings: [] as string[] };
  return (
    <section aria-label={`Horário vazio ${s.label}`} className="flex flex-col gap-4 rounded-sm border border-border p-4">
      <h2 className="font-semibold text-ink">{s.label}</h2>
      <div className="flex flex-col gap-3">
        <DaySelector label={`Dias de ${s.label}`} value={f.days} onChange={(days) => setF({ ...f, days })} />
        <TimeRange label={`Horário de ${s.label}`} start={f.startMin} end={f.endMin} onChange={(startMin, endMin) => setF({ ...f, startMin, endMin })} />
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Quanto fica vazio?"
            className="w-40"
            value={f.intensity}
            options={INTENSITIES.map((v) => ({
              value: v,
              label: INTENSITY_LABEL[v],
            }))}
            onChange={(v) => setF({ ...f, intensity: v as Intensity })}
          />
          <Field
            className="w-full max-w-sm"
            label="Quantas mesas a mais você quer por semana nesse horário?"
            hint={TABLES_HINT}
            inputMode="numeric"
            {...slotTables}
          />
          <Button
            variant="outline-portal"
            loading={busy === "faixa"}
            onClick={() =>
              save(
                "faixa",
                { acao: "faixa_editar", slotId: s.id, ...f },
                "Horário salvo (convites já entregues não mudam)",
              )
            }
          >
            Salvar horário
          </Button>
          <UnsavedHint dirty={JSON.stringify(f) !== JSON.stringify({ days: s.days, startMin: s.startMin, endMin: s.endMin, intensity: s.intensity, extraTables: s.extraTables })} />
          {canRemove && (
            <button
              type="button"
              className="min-h-11 text-sm font-semibold text-red-text underline"
              onClick={async () =>
                (await confirmDialog({
                  title: "Desativar este horário vazio?",
                  body: "Os clientes deixam de ganhar convite para este horário. Os convites já entregues continuam valendo.",
                  confirmLabel: "Desativar",
                })) &&
                save(
                  "faixa",
                  { acao: "faixa_desativar", slotId: s.id },
                  "Horário desativado",
                )
              }
            >
              Desativar
            </button>
          )}
        </div>
        <Msg k="faixa" />
      </div>
      <div className="flex flex-col gap-3 border-t border-divider pt-3">
        <p className="text-sm font-semibold text-ink">Convite de volta</p>
        <OfferEditor label={`Oferta do convite de ${s.label}`} value={o} menu={menu} onChange={setO} />
        <Field className="w-48" label="Teto semanal de convites" inputMode="numeric" {...capField} />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Texto do convite (o cliente vê no app)
          <textarea
            className={`min-h-16 rounded-md border p-3 text-base ${textIssue.errors.length ? "border-red-text" : "border-border"}`}
            maxLength={160}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={textIssue.errors.length > 0 || undefined}
            aria-describedby={`aviso-convite-${s.id}`}
          />
        </label>
        <div
          id={`aviso-convite-${s.id}`}
          className="flex flex-col gap-1 text-xs text-ink-muted"
        >
          <p>{text.length}/160 caracteres</p>
          {textIssue.errors.map((m) => (
            <p key={m} className="font-medium text-red-text">
              {m}
            </p>
          ))}
          {textIssue.warnings.map((m) => (
            <p key={m} className="text-ink">
              Atenção: {m}
            </p>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary-portal"
            loading={busy === "convite"}
            disabled={textIssue.errors.length > 0}
            onClick={() =>
              save("convite", {
                acao: "oferta",
                role: "convite",
                slotId: s.id,
                offer: o,
                weeklyCap: cap,
                inviteText: textChanged ? text : s.inviteText,
              })
            }
          >
            Salvar convite
          </Button>
          <UnsavedHint dirty={textChanged || cap !== (s.weeklyCap ?? s.extraTables * 4) || (!!s.offer && JSON.stringify(o) !== JSON.stringify(s.offer))} />
          <Msg k="convite" />
        </div>
      </div>
    </section>
  );
}

function MenuTab({ v }: { v: SettingsView }) {
  const { save, busy, Msg } = useSaver();
  const [rows, setRows] = useState(v.menu.map((m) => ({ ...m, preco: reais(m.priceCents) })));
  const [novo, setNovo] = useState({ name: "", preco: "", category: "prato" as MenuCategory });
  // D253: linha alterada e não salva → "Salvar" cheio; sair da página pergunta antes.
  const orig = new Map(v.menu.map((m) => [m.id, m]));
  const rowDirty = (r: (typeof rows)[number]) => {
    const m = orig.get(r.id);
    return !!m && (r.name !== m.name || r.category !== m.category || cents(r.preco) !== m.priceCents);
  };
  useUnsavedGuard(rows.some(rowDirty));
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="relative overflow-x-auto no-scrollbar rounded-sm border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Itens do cardápio</caption>
          <thead className="bg-surface-muted text-left">
            <tr>
              <th scope="col" className="px-3 py-2">Item</th>
              <th scope="col" className="px-3 py-2">Categoria</th>
              <th scope="col" className="px-3 py-2">Preço (R$)</th>
              <th scope="col" className="px-3 py-2">No cardápio</th>
              <th scope="col" className="px-3 py-2">Pode entrar em ofertas</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-divider">
                <td className="px-2 py-1">
                  <input aria-label={`Nome de ${r.name}`} className="min-h-11 w-full rounded-sm border border-border px-2" value={r.name} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                </td>
                <td className="px-2 py-1">
                  <Select
                    label={`Categoria de ${r.name}`}
                    hideLabel
                    className="min-w-32"
                    value={r.category}
                    options={CATS.map(([c, l]) => ({ value: c, label: l }))}
                    onChange={(v) => setRows(rows.map((x, k) => (k === i ? { ...x, category: v as MenuCategory } : x)))}
                  />
                </td>
                <td className="px-2 py-1">
                  <input aria-label={`Preço de ${r.name}`} inputMode="decimal" className="min-h-11 w-24 rounded-sm border border-border px-2" value={r.preco} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, preco: e.target.value } : x)))} />
                </td>
                <td className="px-2 py-1">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2">
                    <Checkbox aria-label={`No cardápio: ${r.name}`} checked={r.active} disabled={r.inUse && r.active} onChange={(e) => save(`ativo-${r.id}`, { acao: "item_ativo", itemId: r.id, active: e.target.checked }, "Cardápio atualizado").then((ok) => ok && setRows(rows.map((x, k) => (k === i ? { ...x, active: !x.active } : x))))} />
                    <span className="text-sm text-ink">{r.inUse ? "Em uso numa oferta" : r.active ? "Ativo" : "Fora"}</span>
                  </label>
                </td>
                <td className="px-2 py-1">
                  {/* S6.3a (D197): fora das ofertas = nunca vira convite, "agora" nem recompensa; a IA nem vê. */}
                  <label className="flex min-h-11 cursor-pointer items-center gap-2">
                    <Checkbox
                      aria-label={`Pode entrar em ofertas: ${r.name}`}
                      checked={r.offerAllowed}
                      onChange={(e) =>
                        save(`oferta-${r.id}`, { acao: "item_oferta", itemId: r.id, allowed: e.target.checked }, e.target.checked ? "Pode entrar em ofertas" : "Fora das ofertas").then((ok) => ok && setRows(rows.map((x, k) => (k === i ? { ...x, offerAllowed: !x.offerAllowed } : x))))
                      }
                    />
                    <span className="text-sm text-ink">{r.offerAllowed ? "Sim" : "Não"}</span>
                  </label>
                </td>
                <td className="px-2 py-1">
                  {/* Ajuste de 21/11 (D247): Salvar e Excluir lado a lado; excluir como ícone de lixeira com nome acessível. */}
                  <div className="flex flex-nowrap items-center justify-end gap-1">
                    <Button variant={rowDirty(r) ? "primary-portal" : "outline-portal"} aria-label={rowDirty(r) ? `Salvar ${r.name} (alterações não salvas)` : undefined} loading={busy === `item-${r.id}`} onClick={() => save(`item-${r.id}`, { acao: "item_editar", itemId: r.id, name: r.name, priceCents: cents(r.preco) ?? 0, category: r.category }, "Item salvo")}>
                      Salvar
                    </Button>
                    {!r.inUse && (
                      <button
                        type="button"
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-xs text-red-text hover:bg-red-text/5 focus-visible:outline-2 focus-visible:outline-ink"
                        aria-label={`Excluir ${r.name}`}
                        title="Excluir do cardápio"
                        onClick={async () =>
                          (await confirmDialog({
                            title: `Excluir "${r.name}" do cardápio?`,
                            body: "Códigos e textos antigos continuam valendo.",
                            confirmLabel: "Excluir",
                          })) &&
                          void save(
                            `item-${r.id}`,
                            { acao: "item_excluir", itemId: r.id },
                            "Item excluído",
                          ).then(
                            (ok) =>
                              ok && setRows(rows.filter((x) => x.id !== r.id)),
                          )
                        }
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                        </svg>
                      </button>
                    )}
                    {/* Em uso numa oferta não se exclui: o espaço fica, para o "Salvar" alinhar com as outras linhas. */}
                    {r.inUse && <span aria-hidden="true" className="size-11 shrink-0" />}
                  </div>
                  <Msg k={`item-${r.id}`} />
                  <Msg k={`ativo-${r.id}`} />
                  <Msg k={`oferta-${r.id}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-sm border border-dashed border-ink-muted p-4">
        <Field label="Novo item" value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} />
        <Select
          label="Categoria"
          size="lg"
          className="gap-1.5"
          value={novo.category}
          options={CATS.map(([c, l]) => ({ value: c, label: l }))}
          onChange={(v) => setNovo({ ...novo, category: v as MenuCategory })}
        />
        <Field className="w-32" label="Preço (R$)" inputMode="decimal" value={novo.preco} onChange={(e) => setNovo({ ...novo, preco: e.target.value })} />
        <Button variant="outline-portal" loading={busy === "novo"} onClick={() => save("novo", { acao: "item_novo", name: novo.name, priceCents: cents(novo.preco) ?? 0, category: novo.category }, "Item acrescentado").then((ok) => ok && location.reload())}>
          Acrescentar
        </Button>
        <Msg k="novo" />
      </div>
    </div>
  );
}

function RestaurantTab({ v, isTest, restaurantId }: { v: SettingsView; isTest: boolean; restaurantId: string }) {
  const router = useRouter();
  const { save, busy, Msg } = useSaver();
  const r = v.restaurant;
  const [f, setF] = useState({ name: r.name, tables: r.tables, weeklyCustomers: r.weeklyCustomers, ticket: reais(r.ticketCents), marginPct: r.marginPct, description: r.description ?? "", address: r.address ?? "", opening: r.opening });
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do restaurante" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="Número de mesas" type="number" min={1} value={f.tables ?? ""} onChange={(e) => setF({ ...f, tables: e.target.value ? Number(e.target.value) : null })} />
        <Field label="Clientes de salão por semana" type="number" min={0} value={f.weeklyCustomers ?? ""} onChange={(e) => setF({ ...f, weeklyCustomers: e.target.value ? Number(e.target.value) : null })} />
        <Field label="Ticket médio por pessoa (R$)" inputMode="decimal" value={f.ticket} onChange={(e) => setF({ ...f, ticket: e.target.value })} hint="Sem ticket e margem, o painel mostra visitas, mas não reais." />
        <Field label="Margem aproximada (%)" type="number" min={1} max={95} value={f.marginPct ?? ""} onChange={(e) => setF({ ...f, marginPct: e.target.value ? Number(e.target.value) : null })} hint="Estimativa sua. Sem ela, o painel não mostra o resultado em reais." />
        <Field label="Endereço" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Descrição (aba Sobre do app)
        <textarea className="min-h-16 rounded-md border border-border p-3 text-base" maxLength={400} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <fieldset className="flex flex-col gap-3 rounded-sm border border-border p-4">
        <legend className="px-1 font-semibold text-ink">Horário de funcionamento</legend>
        {f.opening.map((b, i) => (
          <div key={i} className="flex flex-col gap-2">
            <DaySelector label={`Dias do período ${i + 1}`} value={b.days} onChange={(days) => setF({ ...f, opening: f.opening.map((x, k) => (k === i ? { ...x, days } : x)) })} />
            <TimeRange label={`Horário do período ${i + 1}`} start={b.startMin} end={b.endMin} onChange={(startMin, endMin) => setF({ ...f, opening: f.opening.map((x, k) => (k === i ? { ...x, startMin, endMin } : x)) })} />
          </div>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <Button
          variant="primary-portal"
          loading={busy === "rest"}
          onClick={() =>
            save(
              "rest",
              { acao: "restaurante", name: f.name, tables: f.tables, weeklyCustomers: f.weeklyCustomers, ticketCents: cents(f.ticket), marginPct: f.marginPct, description: f.description || null, address: f.address || null, opening: f.opening },
              "Restaurante salvo",
            )
          }
        >
          Salvar
        </Button>
        <Msg k="rest" />
      </div>
      {isTest && (
        <div className="mt-4 flex flex-col gap-2 border-t border-divider pt-4">
          <p className="text-sm text-ink-muted">Excluir apaga este restaurante e tudo dele (check-ins, códigos, kit).</p>
          {!confirmDel ? (
            <button type="button" className="min-h-11 self-start text-sm font-semibold text-red-text underline" onClick={() => setConfirmDel(true)}>
              Excluir restaurante
            </button>
          ) : (
            <Button
              variant="outline-portal"
              onClick={async () => {
                const res = await fetch("/api/parceiro/restaurantes", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ restaurantId }) });
                if (res.ok) {
                  router.push("/parceiro/salao");
                  router.refresh();
                }
              }}
            >
              Confirmar exclusão
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

const PROFILE_ERR: Record<string, string> = {
  longo: "Texto longo demais.",
  caracteres: "Sem chaves, sinais de < > « », crases ou marcação.",
  contato: "Sem telefone, e-mail ou links: a IA não escreve contato.",
  instrucao: "Escreva só fatos sobre o restaurante (ex.: história, especialidades).",
  termos: "Até 15 termos, cada um com 2 a 30 caracteres.",
};
const TONE_ERR: Record<string, string> = {
  fatos: "Fatos para a IA: escreva só fatos sobre o restaurante, sem contato nem marcação.",
  evitar: "O que evitar: até 15 termos, sem marcação nem contato.",
  longo: "Use até 200 caracteres.",
  caracteres: "Sem chaves, sinais de < > « » ou quebras de linha.",
  dados: "Sem e-mail, telefone ou outros números longos: o tom é só o estilo.",
  url: "Sem links.",
  proibida: "Tire promessas como \"grátis\" ou \"imperdível\": as regras não deixam a IA escrever isso.",
  sem_ia: "A IA não respondeu agora. Tente de novo.",
  limite: "Limite de IA do dia atingido. Tente amanhã.",
};

/**
 * "IA do restaurante" (D138; S6.3a — D197): tom, fatos e termos a evitar, todos opcionais (vazio = padrão com os dados
 * que o sistema já tem). "Ver como fica" regenera o convite de 1 horário vazio com os 3 campos digitados (antes × depois).
 */
function ToneSection({ v, agenteGlobal = false, aprendeGlobal = true }: { v: SettingsView; agenteGlobal?: boolean; aprendeGlobal?: boolean }) {
  const router = useRouter();
  const [tone, setTone] = useState(v.restaurant.aiTone ?? "");
  // Fatos sugeridos a partir da descrição (não gravados até o dono salvar — revisão de produto I3).
  const [about, setAbout] = useState(v.restaurant.aiAbout ?? v.restaurant.description ?? "");
  const [avoid, setAvoid] = useState(v.restaurant.aiAvoid ?? "");
  const [feat, setFeat] = useState(v.restaurant.aiFeatures);
  const [slotId, setSlotId] = useState(v.slots[0]?.id ?? "");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [prev, setPrev] = useState<{ before: string; after: string; afterRaw: string } | null>(null);
  const call = async (body: unknown) => {
    const r = await fetch("/api/parceiro/configuracoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, j: await r.json().catch(() => ({})) };
  };
  const slot = v.slots.find((s) => s.id === slotId);
  return (
    <section aria-labelledby="tom" className="flex flex-col gap-3 rounded-sm border border-border p-4">
      <h2 id="tom" className="text-lg font-bold text-ink">
        Como a IA escreve para o seu restaurante
      </h2>
      <p className="text-sm text-ink-muted">
        Tudo aqui é opcional. Sem nada preenchido, a IA usa o padrão com o que o sistema já sabe do restaurante (nome, culinária, cardápio e horários). As regras, as
        ofertas e os números continuam do sistema.
      </p>
      <Field label="Tom (até 200 caracteres)" value={tone} maxLength={200} placeholder="Ex.: descontraído, com gírias de boteco" onChange={(e) => setTone(e.target.value)} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Fatos para a IA (não aparece no app) · até 500 caracteres
        <textarea
          className="min-h-24 rounded-sm border border-border px-3 py-2 text-base font-normal"
          value={about}
          maxLength={500}
          placeholder="Ex.: cantina de bairro desde 1998, massa fresca feita na casa"
          onChange={(e) => setAbout(e.target.value)}
        />
        <span className="text-xs font-normal text-ink-muted">
          {!v.restaurant.aiAbout && about && about === (v.restaurant.description ?? "") ? "Sugestão a partir da descrição do restaurante: só vale depois de salvar. " : ""}
          Só fatos sobre o restaurante (história, especialidades, público). {about.length}/500
        </span>
      </label>
      <Field label="O que evitar (termos separados por vírgula) · até 200 caracteres" value={avoid} maxLength={200} placeholder="Ex.: gírias, álcool" onChange={(e) => setAvoid(e.target.value)} />
      <p className="-mt-2 text-xs text-ink-muted">{avoid.length}/200</p>
      <div className="flex flex-col">
        {agenteGlobal && <Switch label="IA consulta seus números antes de sugerir" hint="Vale para o plano da semana e para o Assistente do salão. O plano demora mais para ficar pronto." checked={feat.agente} onChange={(agente) => setFeat({ ...feat, agente })} />}
        <Switch
          label="Aprender com minhas edições"
          hint={aprendeGlobal ? "Seus textos aprovados viram exemplo de estilo só para este restaurante." : "Desligado por enquanto."}
          checked={feat.aprende}
          disabled={!aprendeGlobal}
          onChange={(aprende) => setFeat({ ...feat, aprende })}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Button
          variant="primary-portal"
          loading={busy === "perfil"}
          onClick={async () => {
            setBusy("perfil");
            // S9 (auditoria 1.10): um só "Salvar" para tom, fatos e preferências; o tom só é gravado se mudou.
            if (tone !== (v.restaurant.aiTone ?? "")) {
              const t = await call({ acao: "tom", tone });
              if (!t.ok) {
                setBusy("");
                setMsg(TONE_ERR[t.j.erro] ?? "Não deu para salvar.");
                return;
              }
            }
            const r = await call({ acao: "ia_perfil", about, avoid, features: feat });
            setBusy("");
            const w = (r.j.warnings ?? []) as string[];
            const inMenu = w.filter((x) => x.startsWith("no_cardapio:")).map((x) => x.slice(12));
            setMsg(
              r.ok
                ? `Salvo: vale nos próximos textos da IA.${inMenu.length ? ` Atenção: ${inMenu.map((t) => `"${t}"`).join(", ")} aparece no nome de pratos; os pratos continuam, só a IA não usa a palavra.` : ""}`
                : PROFILE_ERR[r.j.motivo] ?? "Não deu para salvar.",
            );
            if (r.ok) router.refresh();
          }}
        >
          Salvar preferências da IA
        </Button>
        {v.slots.length > 0 && (
          <>
            <Select
              label="Prévia no horário"
              labelClassName="text-sm text-ink"
              value={slotId}
              options={v.slots.map((s) => ({ value: s.id, label: s.label }))}
              onChange={setSlotId}
            />
            <Button
              variant="outline-portal"
              loading={busy === "ver"}
              onClick={async () => {
                setBusy("ver");
                setPrev(null);
                const r = await call({ acao: "tom_previa", tone, slotId, about, avoid });
                setBusy("");
                if (r.ok) setPrev(r.j);
                else setMsg(TONE_ERR[r.j.erro] ?? "Não deu para gerar a prévia.");
              }}
            >
              Ver como fica
            </Button>
          </>
        )}
      </div>
      {v.slots.length > 0 && <p className="-mt-1 text-xs text-ink-muted">A prévia usa o que está escrito, mesmo sem salvar.</p>}
      {msg && (
        <p role="status" className="text-sm text-ink">
          {msg}
        </p>
      )}
      {prev && slot && (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="tom-previa">
          <div className="rounded-sm bg-surface-muted p-3 text-sm">
            <p className="text-xs text-ink-muted">Antes</p>
            <p className="text-ink">“{prev.before}”</p>
          </div>
          <div className="rounded-sm bg-surface-muted p-3 text-sm">
            <p className="text-xs text-ink-muted">Depois (com suas preferências)</p>
            <p className="text-ink">“{prev.after}”</p>
            <Button
              variant="outline-portal"
              className="mt-2"
              onClick={async () => {
                const r = await call({ acao: "oferta", role: "convite", slotId, offer: slot.offer, weeklyCap: slot.weeklyCap ?? undefined, inviteText: prev.afterRaw });
                setMsg(r.ok ? "Texto do convite atualizado (nova versão)." : "Não deu para usar este texto.");
                if (r.ok) router.refresh();
              }}
            >
              Usar este texto
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
