import Link from "next/link";
import type { Topline } from "@/src/modules/analytics/domain/value";
import { brl, int } from "./format";

const CONFIG_VALORES = "/parceiro/salao/configuracoes?aba=restaurante";
const PLANO = "/parceiro/salao/plano";
const linkCls = "inline-flex min-h-11 items-center self-start text-sm font-semibold text-red-text underline";
const buttonCls = "flex min-h-11 max-w-xs items-center justify-center self-start rounded-xs border border-red-text bg-white px-5 text-sm font-semibold text-red-text hover:bg-red-text/5";

/**
 * Topo em R$ (S5.1, D179; S9: auditoria do Portal §3). Um título para os 4 estados ("Quanto os convites renderam").
 * Camada causal: o valor já desconta o custo dos convites e o texto sai do estado da MARGEM (A5): "a mais" só com o
 * intervalo inteiro acima de zero. Camada antecipada: um número líquido (margem − custo dos convites) e a conta embaixo.
 */
export function ValueHero({ topline: t }: { topline: Topline }) {
  return (
    <section aria-labelledby="valor" data-testid="valor-topo" data-kind={t.kind} className="flex flex-col gap-2 rounded-sm border border-border bg-white p-5">
      <h2 id="valor" className="text-base font-semibold text-ink">
        Quanto os convites renderam
      </h2>
      {"cents" in t ? <Causal t={t} /> : <Early t={t} />}
    </section>
  );
}

function Causal({ t }: { t: Extract<Topline, { cents: number }> }) {
  const base = `Conta feita com ${int(t.nT)} ${t.nT === 1 ? "cliente" : "clientes"} com convite, comparados com quem ficou sem, e com o ticket e a margem que você informou.`;
  if (t.kind === "causal_positivo")
    return (
      <>
        <p className="text-3xl font-bold text-ink">{brl(t.cents)} de margem a mais</p>
        <p className="text-base text-ink">
          Já descontado o custo dos convites. Pode ficar entre {brl(t.lo)} e {brl(t.hi)}.
        </p>
        <p className="text-sm text-ink-muted">{base}</p>
      </>
    );
  if (t.kind === "causal_negativo")
    return (
      <>
        <p className="text-3xl font-bold text-ink">Os convites custaram {brl(Math.abs(t.cents))} a mais do que renderam de margem</p>
        {t.visitas === "positivo" && <p className="text-base text-ink">Eles trouxeram visitas a mais, mas o custo dos convites passou da margem dessas visitas.</p>}
        <p className="text-sm text-ink-muted">{base}</p>
        <Link href={PLANO} className={buttonCls}>
          Trocar a oferta no plano da semana
        </Link>
      </>
    );
  return (
    <>
      <p className="text-2xl font-bold text-ink">{t.visitas === "positivo" ? "Os convites trouxeram visitas a mais" : "Quem recebeu convite voltou menos do que quem ficou sem"}</p>
      <p className="text-base text-ink">
        Em reais, ainda não dá para garantir lucro: pode ficar entre {brl(t.lo)} e {brl(t.hi)}, já descontado o custo dos convites.
      </p>
      <p className="text-sm text-ink-muted">{base}</p>
    </>
  );
}

function Early({ t }: { t: Extract<Topline, { kind: "antecipado" | "sem_valores" }> }) {
  const usados = `${int(t.usados)} ${t.usados === 1 ? "convite usado" : "convites usados"}`;
  if (t.kind === "sem_valores" && t.motivo === "causal")
    return (
      <>
        <p className="text-2xl font-bold text-ink">Já dá para medir o resultado. Informe ticket e margem para ver em reais.</p>
        <Link href={CONFIG_VALORES} className={buttonCls}>
          Informar ticket e margem
        </Link>
      </>
    );
  return (
    <>
      {t.usados === 0 ? (
        <>
          <p className="text-2xl font-bold text-ink">Nenhum cliente voltou com convite ainda</p>
          <p className="text-sm text-ink">O primeiro resultado aparece quando um cliente voltar no horário vazio e o garçom validar o código do convite.</p>
        </>
      ) : t.kind === "antecipado" ? (
        <>
          <p className="text-3xl font-bold text-ink">
            {t.liquidoCents >= 0 ? `≈ ${brl(t.liquidoCents)} de margem depois de pagar os convites` : `Os convites custaram ≈ ${brl(Math.abs(t.liquidoCents))} a mais do que a margem dessas visitas`}
          </p>
          <p className="text-sm text-ink">
            {usados} · consumo {brl(t.consumoCents)} · margem {brl(t.margemCents)} · convites {brl(t.custoCents)}. Só conta código validado pelo garçom.
          </p>
          <p className="text-sm text-ink">Parte desses clientes voltaria mesmo sem convite.</p>
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-ink">
            {usados}. Os convites custaram {brl(t.custoCents)}.
          </p>
          <p className="text-sm text-ink">Só conta código validado pelo garçom.</p>
        </>
      )}
      {t.kind === "sem_valores" && (
        <>
          <p className="text-sm text-ink">Com o ticket médio e a margem, mostramos o resultado em reais.</p>
          <Link href={CONFIG_VALORES} className={linkCls}>
            Informar ticket e margem
          </Link>
        </>
      )}
      <p className="text-sm text-ink-muted" data-testid="valor-falta">
        {missingText(t)}
      </p>
    </>
  );
}

function missingText(t: Extract<Topline, { kind: "antecipado" | "sem_valores" }>): string {
  if (t.motivo === "inconclusivo") return "Ainda não dá para dizer se os convites trouxeram gente a mais: a diferença para quem ficou sem convite ainda pode ser acaso.";
  const parts = [
    t.faltamControle > 0 ? `${int(t.faltamControle)} ${t.faltamControle === 1 ? "cliente sem convite" : "clientes sem convite"}` : null,
    t.faltamConvidados > 0 ? `${int(t.faltamConvidados)} ${t.faltamConvidados === 1 ? "cliente com convite" : "clientes com convite"}` : null,
  ].filter(Boolean);
  return parts.length
    ? `O valor confirmado aparece quando houver clientes suficientes nos dois grupos. Faltam ${parts.join(" e ")} acompanhados por 14 dias.`
    : "O valor confirmado aparece quando os primeiros clientes completarem 14 dias de acompanhamento.";
}
