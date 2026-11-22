"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedItem, TodayFeed as Feed } from "@/src/modules/analytics/application/today-feed";
import { slotLabel } from "@/src/modules/beneficios/domain/slot-text";
import { TZ_SP } from "@/src/shared/tz";
import { int } from "./format";

const hhmm = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ_SP, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const OUTCOME: Record<string, string> = { primeira_visita: "1ª visita", volta_com_convite: "volta com convite", volta_lembrete: "volta", volta: "volta" };
const CODE: Record<string, string> = { primeira_visita: "1ª visita", convite: "convite", recompensa: "recompensa da cartela" };

export function feedText(i: FeedItem): string {
  switch (i.kind) {
    case "leitura":
      return `Leitura do QR${i.piece ? ` · ${i.piece}` : ""}`;
    case "checkin":
      return `${i.name} fez check-in · ${OUTCOME[i.outcome ?? "volta"] ?? "volta"}`;
    case "convite":
      return `Convite emitido para ${i.name}${i.slot ? ` · ${slotLabel(i.slot)}` : ""}`;
    case "codigo":
      return `Código validado · ${CODE[i.codeType ?? ""] ?? i.codeType}${i.name ? ` · ${i.name}` : ""}`;
  }
}

/**
 * "Hoje no salão" (S5.1, D172): eventos do dia, ao vivo (payload de 3 s). O grupo de controle aparece só aqui, para
 * o dono. Linhas novas ganham o selo "novo" por alguns segundos; o leitor de tela ouve só as novas (status polite).
 */
export function TodayFeed({ feed }: { feed: Feed }) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const ids = feed.items.map((i) => i.id);
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const added = feed.items.filter((i) => !seen.current!.has(i.id));
    if (!added.length) return;
    for (const i of added) seen.current.add(i.id);
    setFresh(new Set(added.map((i) => i.id)));
    setAnnounce(`Novo: ${added.map(feedText).join("; ")}`);
    const t = setTimeout(() => setFresh(new Set()), 2_000);
    return () => clearTimeout(t);
  }, [feed]);

  return (
    <section aria-labelledby="hoje" className="flex flex-col gap-2 rounded-sm border border-border bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="hoje" className="text-base font-semibold text-ink">
          Hoje no salão
        </h2>
        <p className="text-sm text-ink-muted" data-testid="hoje-contagens">
          Hoje: {int(feed.counts.leituras)} {feed.counts.leituras === 1 ? "leitura" : "leituras"} · {int(feed.counts.checkins)} {feed.counts.checkins === 1 ? "check-in" : "check-ins"} · {int(feed.counts.validados)}{" "}
          {feed.counts.validados === 1 ? "código validado" : "códigos validados"}
        </p>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {feed.items.length === 0 ? (
        <p className="text-sm text-ink-muted">Assim que alguém ler o QR, aparece aqui.</p>
      ) : (
        <ul className="flex flex-col" data-testid="hoje-no-salao">
          {feed.items.map((i) => (
            <li key={i.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-divider py-2 text-sm first:border-t-0 ${fresh.has(i.id) ? "motion-safe:bg-surface-muted motion-safe:transition-colors" : ""}`}>
              <span className="w-12 tabular-nums text-ink-muted">{hhmm(i.at)}</span>
              <span className="text-ink">{feedText(i)}</span>
              {i.controle && <span className="rounded-xs bg-surface-muted px-1.5 py-0.5 text-xs text-ink">grupo sem convite · sorteado para comparar</span>}
              {fresh.has(i.id) && <span className="rounded-xs border border-red-text bg-white px-1.5 text-xs font-semibold text-red-text">novo</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
