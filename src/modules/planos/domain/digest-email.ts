/**
 * E-mail do resumo semanal do dono (S6.1 — D163, D188): texto simples, sem logo, links só para o nosso domínio,
 * rodapé de protótipo (D164) e "Não quero mais receber" (D193). Números e reais vêm do código (topo da S5, D179).
 */
import type { Topline } from "@/src/modules/analytics/domain/value";
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

function toplineLines(t: Topline | null): string[] {
  if (!t) return [];
  if ("cents" in t) return t.kind === "causal_positivo" ? causalPos(t) : causalNeg(t);
  return earlyLines(t);
}

const causalPos = (t: { cents: number; lo: number; hi: number; nT: number }) => [`${brl(t.cents)} a mais em margem entre ${int(t.nT)} convidados até agora (provavelmente entre ${brl(t.lo)} e ${brl(t.hi)}).`];
const causalNeg = (t: { cents: number; nT: number }) => [`${brl(Math.abs(t.cents))} a menos em margem entre ${int(t.nT)} convidados. Reveja a oferta no plano da semana.`];

function earlyLines(t: Extract<Topline, { kind: "antecipado" | "sem_valores" }>): string[] {
  if (t.usados === 0) return ["Nenhum convite usado ainda."];
  const head = `${plural(t.usados, "convite usado", "convites usados")} (código validado pelo garçom)`;
  if (t.kind === "antecipado") return [`${head} · ≈ ${brl(t.consumoCents)} em consumo (${brl(t.margemCents)} de margem) · custo dos convites ${brl(t.custoCents)}.`, "Estimativa, não causal: parte dessas pessoas voltaria sem convite."];
  return [`${head} · custo dos convites ${brl(t.custoCents)}.`];
}

export function digestEmail(v: DigestView): { subject: string; text: string; html: string } {
  const r = oneLine(v.restaurant);
  const subject = v.plan && v.links.aprovar ? `${r}: seu plano da semana está pronto para aprovar` : `${r}: sua semana em números`;
  const stats = `${plural(v.stats.checkins, "check-in", "check-ins")} · ${plural(v.stats.validados, "código validado", "códigos validados")} · ${plural(v.stats.convitesUsados, "convite usado", "convites usados")}`;
  const top = toplineLines(v.topline);
  const planLines = v.plan
    ? ["Plano proposto para esta semana:", ...v.plan.slots.flatMap((s) => [`• ${s.phrase}: ${s.gain} · teto ${int(s.cap)} convites · custo máximo ${brl(s.maxCostCents)}`, `  ${oneLine(s.justificativa)}`])]
    : [`Gere o plano da semana no Portal: ${v.links.portal}`];
  const actions = v.plan ? [...(v.links.aprovar ? [`Revisar e aprovar: ${v.links.aprovar}`] : []), `Abrir no Portal: ${v.links.portal}`] : [];
  const lines = [
    `Resultado da semana passada (${ddmm(v.week.from)} a ${ddmm(v.week.to)})`,
    stats,
    ...(top.length ? ["", ...top] : []),
    "",
    ...planLines,
    ...(actions.length ? ["", ...actions] : []),
    "",
    `Não quero mais receber este resumo: ${v.links.parar}`,
    PROTOTYPE_FOOTER,
  ];
  const link = (href: string, label: string) => `<a href="${esc(href)}">${esc(label)}</a>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#151515">
<p><strong>${esc(r)}</strong> · Resultado da semana passada (${ddmm(v.week.from)} a ${ddmm(v.week.to)})</p>
<p>${esc(stats)}</p>
${top.map((l) => `<p>${esc(l)}</p>`).join("\n")}
${
  v.plan
    ? `<p><strong>Plano proposto para esta semana:</strong></p><ul>${v.plan.slots.map((s) => `<li><strong>${esc(s.phrase)}</strong>: ${esc(s.gain)} · teto ${int(s.cap)} convites · custo máximo ${esc(brl(s.maxCostCents))}<br>${esc(oneLine(s.justificativa))}</li>`).join("")}</ul>
<p>${v.links.aprovar ? `${link(v.links.aprovar, "Revisar e aprovar")} · ` : ""}${link(v.links.portal, "Abrir no Portal")}</p>`
    : `<p>${link(v.links.portal, "Gere o plano da semana no Portal")}</p>`
}
<p style="color:#666;font-size:12px">${link(v.links.parar, "Não quero mais receber este resumo")}<br>${PROTOTYPE_FOOTER}</p>
</div>`;
  return { subject, text: lines.join("\n"), html };
}
