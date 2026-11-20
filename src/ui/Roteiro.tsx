import Link from "next/link";

/** Roteiro curto do avaliador (S1 #9, revisão P-B1): na entrada, no link de acesso e no Início do teste. */
export function Roteiro({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="roteiro-curto" className={`rounded-sm border border-border bg-white p-4 text-left text-sm leading-6 text-ink ${className}`}>
      <h2 id="roteiro-curto" className="mb-1 text-base font-semibold">
        Como testar sozinho
      </h2>
      <ul className="list-disc pl-5">
        <li>Se o convite não aparecer depois do check-in, esse cliente caiu no grupo de controle (1 em 10): toque em &quot;Testar como outro cliente&quot;.</li>
        <li>Para ver a volta com convite: crie seu restaurante de teste e use &quot;Antecipar 1 dia&quot;.</li>
        <li>
          <Link className="text-red-text underline" href="/bastidores/como-funciona">
            Como este protótipo funciona
          </Link>{" "}
          (o que é real e o que é simulado).
        </li>
      </ul>
    </section>
  );
}
