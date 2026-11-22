import Link from "next/link";
import type { FirstSteps as Steps } from "@/src/modules/onboarding/application/first-steps";

/**
 * "Primeiros passos" (S4 §4.4): some quando os 4 estão feitos. "Ver minha página" abre pelo QR do display A
 * (`customerPath` com `?p=`, A9), como o cliente chega: o 1º check-in conta como cliente vindo do kit.
 */
export function FirstSteps({ steps, customerPath }: { steps: Steps; customerPath: string }) {
  const items: Array<{ done: boolean; label: string; href: string; cta: string; external?: boolean }> = [
    { done: steps.kitNoSalao, label: "Kit pronto e marcado no salão", href: "/parceiro/salao/kit", cta: "Abrir o kit" },
    { done: steps.primeiroCheckin, label: "1º check-in de um cliente", href: customerPath, cta: "Ver minha página", external: true },
    { done: steps.primeiroCodigo, label: "1º código validado pelo garçom", href: "/parceiro/salao/validar", cta: "Validar código" },
    { done: steps.primeiraVolta, label: "1º cliente voltou com convite", href: "/parceiro/salao/clientes?segmento=convite_ativo", cta: "Ver quem tem convite ativo" },
  ];
  if (items.every((i) => i.done)) return null;
  const done = items.filter((i) => i.done).length;
  return (
    <section aria-labelledby="primeiros-passos" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="primeiros-passos" className="text-lg font-bold text-ink">
          Primeiros passos
        </h2>
        <p className="text-sm text-ink-muted">
          {done} de {items.length}
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.label} className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-2">
            <span className="flex items-center gap-2 text-sm text-ink">
              <span aria-hidden="true" className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${i.done ? "bg-ink text-white" : "border border-border text-ink-muted"}`}>
                {i.done ? "✓" : ""}
              </span>
              <span>
                {i.label}
                <span className="sr-only">{i.done ? " · feito" : " · pendente"}</span>
              </span>
            </span>
            {!i.done && (
              <Link href={i.href} target={i.external ? "_blank" : undefined} rel={i.external ? "noreferrer" : undefined} className="inline-flex min-h-11 items-center text-sm font-semibold text-red-text underline">
                {i.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
