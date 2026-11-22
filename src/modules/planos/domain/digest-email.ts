/**
 * E-mail do resumo semanal do dono (S6.1 — D163, D188): texto simples, sem logo, links só para o nosso domínio,
 * rodapé de protótipo (D164) e "Não quero mais receber" (D193). Números e reais vêm do código (topo da S5, D179).
 */
import type { Topline } from "@/src/modules/analytics/domain/value";
import { crossZeroMoneyText, showSwapOffer } from "@/src/modules/analytics/domain/value-text";
import { PROTOTYPE_FOOTER } from "@/src/shared/prototype";

export type DigestView = {
  restaurant: string;
  /** Semana ISO fechada anterior (dias de SP `YYYY-MM-DD`). */
  week: { from: string; to: string };
  stats: { checkins: number; validados: number; convitesUsados: number };
  topline: Topline | null;
  plan: { slots: Array<{ phrase: string; gain: string; cap: number; maxCostCents: number; justificativa: string }> } | null;
  links: { aprovar: string | null; portal: string; parar: string };
};

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = (n: number) => n.toLocaleString("pt-BR");
const ddmm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
const plural = (n: number, one: string, many: string) => `${int(n)} ${n === 1 ? one : many}`;
/** A17: o teto conta convites emitidos na semana (cada um vale 30 dias); o custo máximo é o desses convites. */
const slotLine = (s: { gain: string; cap: number; maxCostCents: number }) => `${s.gain} · até ${plural(s.cap, "convite", "convites")} na semana · custo máximo dos convites emitidos na semana ${brl(s.maxCostCents)}`;

/**
 * Acumulado dos convites (S9, A5 e auditoria 1.7): a frase sai do estado da MARGEM (já descontado o custo dos
 * convites); "a mais" só quando o intervalo inteiro fica acima de zero.
 */
function toplineLines(t: Topline | null): string[] {
  if (!t) return [];
  if ("cents" in t) return causalLines(t);
  return earlyLines(t);
}

function causalLines(t: Extract<Topline, { cents: number }>): string[] {
  const range = `entre ${brl(t.lo)} e ${brl(t.hi)}`;
  const base = `Conta feita com ${plural(t.nT, "cliente", "clientes")} com convite, comparados com quem ficou sem, e com o ticket e a margem que você informou.`;
  if (t.kind === "causal_positivo") return [`${brl(t.cents)} de margem a mais com os convites, já descontado o custo deles. Pode ficar ${range}.`, base];
  if (t.kind === "causal_negativo") {
    const head = t.visitas === "positivo" ? `Os convites trouxeram visitas a mais, mas custaram ${brl(Math.abs(t.cents))} a mais do que renderam de margem.` : `Os convites custaram ${brl(Math.abs(t.cents))} a mais do que renderam de margem.`;
    return [`${head} Vale trocar a oferta no plano da semana.`, base];
  }
  const head = t.visitas === "positivo" ? "Os convites trouxeram visitas a mais." : "Quem recebeu convite voltou menos do que quem ficou sem.";
  const swap = showSwapOffer(t) ? " Vale trocar a oferta no plano da semana." : "";
  return [`${head} ${crossZeroMoneyText(brl(t.lo), brl(t.hi))}${swap}`, base];
}

function earlyLines(t: Extract<Topline, { kind: "antecipado" | "sem_valores" }>): string[] {
  if (t.usados === 0) return ["Nenhum convite usado ainda."];
  const head = `${plural(t.usados, "convite usado", "convites usados")} (só conta código validado pelo garçom).`;
  if (t.kind === "sem_valores") return [head, `Os convites custaram ${brl(t.custoCents)}. Informe ticket médio e margem no Portal para ver o resultado em reais.`];
  const net =
    t.liquidoCents >= 0
      ? `≈ ${brl(t.liquidoCents)} de margem depois de pagar os convites`
      : `≈ ${brl(Math.abs(t.liquidoCents))} a menos: os convites custaram mais do que a margem dessas visitas`;
  return [head, `${net} (consumo ${brl(t.consumoCents)} · margem ${brl(t.margemCents)} · convites ${brl(t.custoCents)}).`, "Parte desses clientes voltaria mesmo sem convite."];
}

const ACC_TITLE = "Até agora, somando todas as semanas:";

export function digestEmail(v: DigestView): { subject: string; text: string; html: string } {
  const r = oneLine(v.restaurant);
  const toApprove = !!(v.plan && v.links.aprovar);
  // Valor no assunto só quando a margem a mais é certa (intervalo acima de zero — auditoria 1.7).
  const gain = v.topline?.kind === "causal_positivo" ? `${brl(v.topline.cents)} de margem a mais com os convites` : null;
  const subject = gain ? `${r}: ${gain}${toApprove ? " · plano para aprovar" : ""}` : toApprove ? `${r}: seu plano da semana está pronto para aprovar` : `${r}: sua semana em números`;
  const stats = `${plural(v.stats.checkins, "check-in", "check-ins")} · ${plural(v.stats.validados, "código validado", "códigos validados")} · ${plural(v.stats.convitesUsados, "convite usado", "convites usados")}`;
  const top = toplineLines(v.topline);
  const planLines = v.plan
    ? ["Plano proposto para esta semana:", ...v.plan.slots.flatMap((s) => [`• ${s.phrase}: ${slotLine(s)}`, `  ${oneLine(s.justificativa)}`])]
    : [`Gere o plano da semana no Portal: ${v.links.portal}`];
  const actions = v.plan ? [...(v.links.aprovar ? [`Revisar e aprovar: ${v.links.aprovar}`] : []), `Abrir no Portal: ${v.links.portal}`] : [];
  const lines = [
    `Semana passada (${ddmm(v.week.from)} a ${ddmm(v.week.to)})`,
    stats,
    ...(top.length ? ["", ACC_TITLE, ...top] : []),
    "",
    ...planLines,
    ...(actions.length ? ["", ...actions] : []),
    "",
    `Não quero mais receber este resumo: ${v.links.parar}`,
    PROTOTYPE_FOOTER,
  ];
  const link = (href: string, label: string) => `<a href="${esc(href)}">${esc(label)}</a>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#151515">
<p><strong>${esc(r)}</strong> · Semana passada (${ddmm(v.week.from)} a ${ddmm(v.week.to)})</p>
<p>${esc(stats)}</p>
${top.length ? `<p><strong>${esc(ACC_TITLE)}</strong></p>\n${top.map((l) => `<p>${esc(l)}</p>`).join("\n")}` : ""}
${
  v.plan
    ? `<p><strong>Plano proposto para esta semana:</strong></p><ul>${v.plan.slots.map((s) => `<li><strong>${esc(s.phrase)}</strong>: ${esc(slotLine(s))}<br>${esc(oneLine(s.justificativa))}</li>`).join("")}</ul>
<p>${v.links.aprovar ? `${link(v.links.aprovar, "Revisar e aprovar")} · ` : ""}${link(v.links.portal, "Abrir no Portal")}</p>`
    : `<p>${link(v.links.portal, "Gere o plano da semana no Portal")}</p>`
}
<p style="color:#666;font-size:12px">${link(v.links.parar, "Não quero mais receber este resumo")}<br>${PROTOTYPE_FOOTER}</p>
</div>`;
  return { subject, text: lines.join("\n"), html };
}
