"use client";

import { Select } from "../components/Select";
import { useEffect, useRef, useState } from "react";

type Store = { id: string; name: string; slug: string; label: string };

/**
 * Modo apresentação: Portal à esquerda (largura = janela − 430 px) e app numa moldura de 390 px à direita.
 * Seletor de restaurante troca os dois lados; aviso do último check-in a cada 3 s; zoom de 125% opcional.
 */
export function Presenter({ stores, currentId }: { stores: Store[]; currentId: string | null }) {
  const [cur, setCur] = useState(currentId);
  const [nonce, setNonce] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const since = useRef(0);
  // O Portal só mostra a barra lateral a partir de 1024 px (lg). Com menos espaço (ex.: janela de 1280 px), o iframe
  // fica com 1024 px de largura lógica e é reduzido em escala, em vez de cair no layout de celular (revisão S3 #24).
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1024, h: 720 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const PORTAL_MIN = 1024;
  const scale = size.w > 0 && size.w < PORTAL_MIN ? size.w / PORTAL_MIN : 1;
  const store = stores.find((s) => s.id === cur) ?? stores[0];

  useEffect(() => {
    if (!since.current) since.current = Date.now();
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const r = await fetch(`/api/parceiro/painel/eventos?desde=${since.current}`, { cache: "no-store" }).catch(() => null);
      if (!r?.ok) return;
      const j = (await r.json()) as { last: { at: string; piece: string | null; holdout: boolean } | null };
      if (j.last) {
        since.current = new Date(j.last.at).getTime();
        setToast(`Novo check-in${j.last.piece ? ` · ${j.last.piece}` : ""}${j.last.holdout ? " · grupo de controle" : ""}`);
        setTimeout(() => setToast(null), 6_000);
      }
    }, 3_000);
    return () => clearInterval(t);
  }, [cur]);

  const choose = async (id: string) => {
    const r = await fetch("/api/parceiro/loja", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restaurantId: id }) });
    if (r.ok) {
      setCur(id);
      since.current = Date.now();
      setNonce((n) => n + 1);
    }
  };

  if (!store) return <main className="p-8 text-sm text-ink">Ative um restaurante ou espere o restaurante de exemplo ficar pronto para usar o modo apresentação.</main>;
  return (
    <main className="flex min-h-[calc(100dvh-1.75rem)] flex-col bg-page">
      <p className="p-6 text-sm text-ink lg:hidden">Use uma tela maior (pelo menos 1100 px) para o modo apresentação.</p>
      <div className="hidden items-center gap-3 border-b border-border bg-white px-4 py-2 lg:flex">
        <Select
          label="Restaurante"
          size="sm"
          className="flex-row items-center gap-2"
          labelClassName="text-sm text-ink"
          triggerClassName="w-auto"
          value={store.id}
          options={stores.map((s) => ({ value: s.id, label: `${s.name} (${s.label})` }))}
          onChange={(v) => void choose(v)}
        />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={zoom} onChange={(e) => setZoom(e.target.checked)} /> Zoom 125%
        </label>
        <a className="ml-auto text-sm text-red-text underline" href="/bastidores/config" target="_blank" rel="noreferrer">
          Bastidores
        </a>
        {toast && (
          <p role="status" className="rounded-full bg-red-button px-4 py-1 text-sm font-semibold text-white motion-safe:animate-pulse">
            {toast}
          </p>
        )}
      </div>
      <div className="hidden flex-1 gap-4 p-4 lg:flex" style={zoom ? { zoom: 1.25 } : undefined}>
        <div ref={box} className="relative min-h-[720px] flex-1 overflow-hidden rounded-sm border border-border bg-white" data-testid="portal-box" data-scale={scale.toFixed(3)}>
          <iframe
            key={`p${nonce}`}
            title="Portal do Parceiro"
            src="/parceiro/salao"
            className="absolute left-0 top-0 origin-top-left bg-white"
            style={scale < 1 ? { width: PORTAL_MIN, height: size.h / scale, transform: `scale(${scale})` } : { width: "100%", height: "100%" }}
          />
        </div>
        <div className="flex w-[410px] shrink-0 items-start justify-center">
          <div className="rounded-[2.5rem] border-[10px] border-ink bg-ink p-0.5 shadow-lg">
            <iframe key={`a${nonce}`} title="App do cliente" src={`/r/${store.slug}`} className="h-[780px] w-[390px] rounded-[2rem] bg-white" />
          </div>
        </div>
      </div>
    </main>
  );
}
