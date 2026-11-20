"use client";

import { useNumberField } from "../components/use-number-field";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MenuCategory } from "@/src/modules/beneficios/domain/menu";
import { describeOffer } from "@/src/modules/beneficios/domain/offers";
import type { SettingsView } from "@/src/modules/config/application/update-settings";
import { Button } from "../components/Button";
import { DaySelector } from "../components/DaySelector";
import { Field } from "../components/Field";
import { Tabs } from "../components/Tabs";
import { TimeRange } from "../components/TimeRange";
import { OfferEditor, type OfferValue } from "./OfferEditor";

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
  texto: "Texto não permitido (dados pessoais, HTML, referência desconhecida ou longo demais).",
  em_uso: "Este item está numa oferta em vigor. Troque a oferta antes.",
  ultima_faixa: "O restaurante precisa de pelo menos um horário vazio.",
  faixa: "Horário inválido: precisa caber no funcionamento, com fim depois do início.",
  funcionamento: "O novo funcionamento não cobre algum horário vazio. Ajuste os horários vazios antes.",
  sem_candidatas: "Não há oferta válida no cardápio para este horário.",
  limite_faixas: "Já são 8 horários vazios. Desative um antes de criar outro.",
  formato: "Confira os campos.",
};

async function post(body: unknown) {
  const r = await fetch("/api/parceiro/configuracoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { erro?: string; warnings?: string[] };
  return { ok: r.ok, erro: j.erro, warnings: j.warnings ?? [] };
}

function useSaver() {
  const router = useRouter();
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const save = async (key: string, body: unknown, okText = "Salvo · nova versão em vigor") => {
    setBusy(key);
    const r = await post(body);
    setBusy(null);
    setMsg((m) => ({ ...m, [key]: r.ok ? { ok: true, text: r.warnings.includes("prato_fora_da_oferta") ? `${okText}. Atenção: o texto do convite cita um prato que não é mais a oferta; revise o texto.` : r.warnings.length ? `${okText}. Atenção: o texto cita número ou promessa; vale a oferta da regra.` : okText } : { ok: false, text: ERR[r.erro ?? "formato"] ?? "Não conseguimos salvar." } }));
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
export function ConfigManager({ v, isTest, restaurantId }: { v: SettingsView; isTest: boolean; restaurantId: string }) {
  const [tab, setTab] = useState("agora");
  const menu = v.menu.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name, category: m.category, priceCents: m.priceCents }));
  return (
    <Tabs
      label="Configurações"
      value={tab}
      onValueChange={setTab}
      items={[
        { id: "agora", label: "Benefício agora", content: <OfferTab title="Benefício de 1ª visita (o “agora”)" note="Vale em qualquer horário de funcionamento, uma vez por cliente." role="agora" value={v.agora} menu={menu} /> },
        { id: "convites", label: "Horários vazios e convites", content: <SlotsTab v={v} menu={menu} /> },
        { id: "cartela", label: "Cartela", content: <OfferTab title="Recompensa da cartela" note="6 selos, 1 por dia, validade de 90 dias após o 1º check-in (regras iguais às do app)." role="recompensa" value={v.recompensa} menu={menu} /> },
        { id: "cardapio", label: "Cardápio", content: <MenuTab v={v} /> },
        { id: "restaurante", label: "Restaurante", content: <RestaurantTab v={v} isTest={isTest} restaurantId={restaurantId} /> },
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
        Agora: <strong>{gain}</strong>
      </p>
      <OfferEditor label={title} value={o} menu={menu} onChange={setO} />
      <div className="flex items-center gap-3">
        <Button variant="primary-portal" loading={busy === role} onClick={() => save(role, { acao: "oferta", role, offer: o })}>
          Salvar
        </Button>
        <Msg k={role} />
      </div>
    </section>
  );
}

function SlotsTab({ v, menu }: { v: SettingsView; menu: Array<{ id: string; name: string; category: MenuCategory; priceCents: number }> }) {
  const { save, busy, Msg } = useSaver();
  const [nova, setNova] = useState({ days: [] as number[], startMin: 900, endMin: 1080, intensity: "um_pouco" as "muito" | "um_pouco", extraTables: 3 });
  const novaTables = useNumberField(nova.extraTables, 1, 99, (n) => setNova((x) => ({ ...x, extraTables: n })));
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
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Quanto fica vazio?
            <select className="min-h-11 rounded-sm border border-border bg-white px-2" value={nova.intensity} onChange={(e) => setNova({ ...nova, intensity: e.target.value as "muito" | "um_pouco" })}>
              <option value="muito">Muito</option>
              <option value="um_pouco">Um pouco</option>
            </select>
          </label>
          <Field className="w-48" label="Mesas a mais por semana" inputMode="numeric" {...novaTables} />
          <Button variant="outline-portal" loading={busy === "nova"} onClick={() => save("nova", { acao: "faixa_nova", ...nova }, "Horário vazio criado com convite")}>
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
  return (
    <section aria-label={`Horário vazio ${s.label}`} className="flex flex-col gap-4 rounded-sm border border-border p-4">
      <h2 className="font-semibold text-ink">{s.label}</h2>
      <div className="flex flex-col gap-3">
        <DaySelector label={`Dias de ${s.label}`} value={f.days} onChange={(days) => setF({ ...f, days })} />
        <TimeRange label={`Horário de ${s.label}`} start={f.startMin} end={f.endMin} onChange={(startMin, endMin) => setF({ ...f, startMin, endMin })} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Quanto fica vazio?
            <select className="min-h-11 rounded-sm border border-border bg-white px-2" value={f.intensity} onChange={(e) => setF({ ...f, intensity: e.target.value as "muito" | "um_pouco" })}>
              <option value="muito">Muito</option>
              <option value="um_pouco">Um pouco</option>
            </select>
          </label>
          <Field className="w-48" label="Mesas a mais por semana" inputMode="numeric" {...slotTables} />
          <Button variant="outline-portal" loading={busy === "faixa"} onClick={() => save("faixa", { acao: "faixa_editar", slotId: s.id, ...f }, "Horário salvo (convites já emitidos não mudam)")}>
            Salvar horário
          </Button>
          {canRemove && (
            <button type="button" className="min-h-11 text-sm font-semibold text-red-text underline" onClick={() => window.confirm("Desativar este horário vazio? Ele para de receber convites (os já emitidos continuam valendo).") && save("faixa", { acao: "faixa_desativar", slotId: s.id }, "Horário desativado")}>
              Desativar
            </button>
          )}
        </div>
        <Msg k="faixa" />
      </div>
      <div className="flex flex-col gap-3 border-t border-divider pt-3">
        <p className="text-sm font-semibold text-ink">Convite de volta</p>
        <OfferEditor label={`Oferta do convite de ${s.label}`} value={o} menu={menu} onChange={setO} />
        <Field className="w-48" label="Teto de convites por semana" inputMode="numeric" {...capField} />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Texto do convite (2º card)
          <textarea className="min-h-16 rounded-md border border-border p-3 text-base" maxLength={160} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="flex items-center gap-3">
          <Button
            variant="primary-portal"
            loading={busy === "convite"}
            onClick={() => save("convite", { acao: "oferta", role: "convite", slotId: s.id, offer: o, weeklyCap: cap, inviteText: textChanged ? text : s.inviteText })}
          >
            Salvar convite
          </Button>
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
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="overflow-x-auto rounded-sm border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Itens do cardápio</caption>
          <thead className="bg-surface-muted text-left">
            <tr>
              <th scope="col" className="px-3 py-2">Item</th>
              <th scope="col" className="px-3 py-2">Categoria</th>
              <th scope="col" className="px-3 py-2">Preço (R$)</th>
              <th scope="col" className="px-3 py-2">No cardápio</th>
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
                  <select aria-label={`Categoria de ${r.name}`} className="min-h-11 rounded-sm border border-border bg-white px-2" value={r.category} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, category: e.target.value as MenuCategory } : x)))}>
                    {CATS.map(([c, l]) => (
                      <option key={c} value={c}>{l}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input aria-label={`Preço de ${r.name}`} inputMode="decimal" className="min-h-11 w-24 rounded-sm border border-border px-2" value={r.preco} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, preco: e.target.value } : x)))} />
                </td>
                <td className="px-2 py-1">
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" checked={r.active} disabled={r.inUse && r.active} onChange={(e) => save(`ativo-${r.id}`, { acao: "item_ativo", itemId: r.id, active: e.target.checked }, "Cardápio atualizado").then((ok) => ok && setRows(rows.map((x, k) => (k === i ? { ...x, active: !x.active } : x))))} />
                    <span className="text-xs text-ink-muted">{r.inUse ? "em uso numa oferta" : r.active ? "ativo" : "fora"}</span>
                  </label>
                </td>
                <td className="px-2 py-1">
                  <Button variant="outline-portal" loading={busy === `item-${r.id}`} onClick={() => save(`item-${r.id}`, { acao: "item_editar", itemId: r.id, name: r.name, priceCents: cents(r.preco) ?? 0, category: r.category }, "Item salvo")}>
                    Salvar
                  </Button>
                  <Msg k={`item-${r.id}`} />
                  <Msg k={`ativo-${r.id}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-sm border border-dashed border-ink-muted p-4">
        <Field label="Novo item" value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Categoria
          <select className="min-h-12 rounded-md border border-border bg-white px-2" value={novo.category} onChange={(e) => setNovo({ ...novo, category: e.target.value as MenuCategory })}>
            {CATS.map(([c, l]) => (
              <option key={c} value={c}>{l}</option>
            ))}
          </select>
        </label>
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
        <Field label="Ticket médio por pessoa (R$)" inputMode="decimal" value={f.ticket} onChange={(e) => setF({ ...f, ticket: e.target.value })} hint="Estimativa sua; usada só para calcular retorno." />
        <Field label="Margem aproximada (%)" type="number" min={1} max={95} value={f.marginPct ?? ""} onChange={(e) => setF({ ...f, marginPct: e.target.value ? Number(e.target.value) : null })} hint="Estimativa sua; usada só para calcular retorno." />
        <Field label="Endereço (fictício)" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Descrição (aba Sobre do app)
        <textarea className="min-h-16 rounded-md border border-border p-3 text-base" maxLength={400} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <fieldset className="flex flex-col gap-3 rounded-sm border border-border p-4">
        <legend className="px-1 font-semibold text-ink">Horário de funcionamento</legend>
        {f.opening.map((b, i) => (
          <div key={i} className="flex flex-col gap-2">
            <DaySelector label={`Dias do turno ${i + 1}`} value={b.days} onChange={(days) => setF({ ...f, opening: f.opening.map((x, k) => (k === i ? { ...x, days } : x)) })} />
            <TimeRange label={`Horário do turno ${i + 1}`} start={b.startMin} end={b.endMin} onChange={(startMin, endMin) => setF({ ...f, opening: f.opening.map((x, k) => (k === i ? { ...x, startMin, endMin } : x)) })} />
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
      <ToneSection v={v} />
      {isTest && (
        <div className="mt-4 flex flex-col gap-2 border-t border-divider pt-4">
          <p className="text-sm text-ink-muted">Excluir apaga este restaurante de teste e tudo dele (check-ins, códigos, kit).</p>
          {!confirmDel ? (
            <button type="button" className="min-h-11 self-start text-sm font-semibold text-red-text underline" onClick={() => setConfirmDel(true)}>
              Excluir restaurante de teste
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

const TONE_ERR: Record<string, string> = {
  longo: "Use até 200 caracteres.",
  caracteres: "Sem chaves, sinais de < > « » ou quebras de linha.",
  dados: "Sem e-mail, telefone ou outros números longos: o tom é só o estilo.",
  url: "Sem links.",
  proibida: "Tire promessas como \"grátis\" ou \"imperdível\": as regras não deixam a IA escrever isso.",
  sem_ia: "A IA não respondeu agora. Tente de novo.",
  limite: "Limite de IA do dia atingido. Tente amanhã.",
};

/** Tom da IA do restaurante (D138): muda só o estilo; "Ver como fica" regenera o convite de 1 faixa (antes × depois). */
function ToneSection({ v }: { v: SettingsView }) {
  const router = useRouter();
  const [tone, setTone] = useState(v.restaurant.aiTone ?? "");
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
      <h3 id="tom" className="font-semibold text-ink">
        Tom da IA do seu restaurante
      </h3>
      <p className="text-sm text-ink-muted">Muda só o estilo dos textos da IA; as regras e os números continuam do sistema.</p>
      <Field label="Tom (até 200 caracteres)" value={tone} maxLength={200} placeholder="Ex.: descontraído, com gírias de boteco" onChange={(e) => setTone(e.target.value)} />
      <div className="flex flex-wrap items-end gap-3">
        <Button
          variant="primary-portal"
          loading={busy === "salvar"}
          onClick={async () => {
            setBusy("salvar");
            const r = await call({ acao: "tom", tone });
            setBusy("");
            setMsg(r.ok ? "Tom salvo: vale nos próximos textos da IA." : TONE_ERR[r.j.erro] ?? "Não deu para salvar.");
            if (r.ok) router.refresh();
          }}
        >
          Salvar tom
        </Button>
        {v.slots.length > 0 && (
          <>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Faixa para testar
              <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className="min-h-11 rounded-xs border border-border bg-white px-2">
                {v.slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline-portal"
              loading={busy === "ver"}
              onClick={async () => {
                setBusy("ver");
                setPrev(null);
                const r = await call({ acao: "tom_previa", tone, slotId });
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
            <p className="text-xs text-ink-muted">Depois (com o tom)</p>
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
