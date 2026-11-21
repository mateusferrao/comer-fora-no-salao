import Link from "next/link";
import type { Topline } from "@/src/modules/analytics/domain/value";
import { brl, int } from "./format";

/**
 * Topo em R$ (S5.1, D179): camada causal quando há resultado contra o grupo de controle; senão, a camada antecipada
 * ("convites usados · consumo · margem · custo"), sempre rotulada como estimativa não causal.
 */
export function ValueHero({ topline: t }: { topline: Topline }) {
  return (
    <section aria-labelledby="valor" data-testid="valor-topo" data-kind={t.kind} className="flex flex-col gap-2 rounded-sm border border-border bg-white p-5">
      <h2 id="valor" className="text-base font-semibold text-ink">
        Retorno em reais
      </h2>
      {t.kind === "causal_positivo" && (
        <>
          <p className="text-3xl font-bold text-ink">
            {brl(t.cents)} a mais em margem entre {int(t.nT)} convidados até agora
          </p>
          <p className="text-sm text-ink-muted">Provavelmente entre {brl(t.lo)} e {brl(t.hi)} · estimativa com os valores que você declarou, comparada ao grupo de controle.</p>
        </>
      )}
      {t.kind === "causal_negativo" && (
        <>
          <p className="text-3xl font-bold text-ink">
            {brl(Math.abs(t.cents))} a menos em margem entre {int(t.nT)} convidados
          </p>
          <p className="text-sm text-ink-muted">Reveja a oferta no plano da semana. Estimativa com os valores que você declarou, comparada ao grupo de controle.</p>
        </>
      )}
      {(t.kind === "antecipado" || t.kind === "sem_valores") && (
        <>
          <p className="text-2xl font-bold text-ink">
            {t.usados === 0 ? "Nenhum convite usado ainda" : `${int(t.usados)} ${t.usados === 1 ? "convite usado" : "convites usados"} (código validado pelo garçom)`}
            {t.kind === "antecipado" && t.usados > 0 && (
              <span className="block text-lg font-semibold">
                ≈ {brl(t.consumoCents)} em consumo ({brl(t.margemCents)} de margem) · custo dos convites {brl(t.custoCents)}
              </span>
            )}
            {t.kind === "sem_valores" && t.usados > 0 && <span className="block text-lg font-semibold">Custo dos convites {brl(t.custoCents)}</span>}
          </p>
          {t.kind === "antecipado" && <p className="text-sm text-ink">Estimativa, não causal: parte dessas pessoas voltaria sem convite.</p>}
          {t.kind === "sem_valores" && (
            <p className="text-sm text-ink">
              Declare ticket médio e margem em{" "}
              <Link href="/parceiro/salao/configuracoes" className="font-semibold text-red-text underline">
                Configurações
              </Link>{" "}
              para ver em reais.
            </p>
          )}
          <p className="text-sm text-ink-muted" data-testid="valor-falta">
            {missingText(t)}
          </p>
        </>
      )}
    </section>
  );
}

function missingText(t: Extract<Topline, { kind: "antecipado" | "sem_valores" }>): string {
  if (t.motivo === "inconclusivo") return "Ainda não dá para afirmar o efeito: o resultado está dentro da margem de erro.";
  if (t.motivo === "causal") return "Já há resultado contra o grupo de controle: declare os valores para vê-lo em reais.";
  const parts = [
    t.faltamControle > 0 ? `${int(t.faltamControle)} ${t.faltamControle === 1 ? "cliente" : "clientes"} do grupo de controle` : null,
    t.faltamConvidados > 0 ? `${int(t.faltamConvidados)} ${t.faltamConvidados === 1 ? "convidado" : "convidados"}` : null,
  ].filter(Boolean);
  return parts.length ? `Para medir o efeito faltam ${parts.join(" e ")} com 14 dias completos.` : "O efeito aparece quando as janelas de 14 dias fecharem.";
}
