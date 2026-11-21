import Link from "next/link";
import { Logo } from "@/src/ui/components/Logo";

/**
 * Landing de venda para o dono (S5.2, flag `copy_v2`; textos pela skill de copywriting, situação A). Prova só com o
 * número público real e a fonte exata (D182); só a barra de protótipo como aviso de marca (D183); "Quanto custa?"
 * fala só do benefício (D184). Números e tetos são do código, nunca da IA (espec. 3.7).
 */
const STEPS = [
  "Mande a foto do cardápio do salão. A IA lê os pratos e propõe o benefício e o convite. O teto de convites sai das mesas que você quer encher. Você aprova.",
  "Coloque o QR na mesa. O kit sai pronto para imprimir, com display de mesa e cartão do garçom.",
  "Acompanhe o retorno. O painel compara quem recebeu convite com um grupo sorteado que não recebeu e mostra a diferença em reais.",
];
const CONTROL = ["Teto semanal de convites por faixa", "Custo de cada convite antes de aprovar", "O plano da semana só vale com o seu OK", "Seus clientes ficam na base do seu restaurante"];
const FAQ: Array<[string, string]> = [
  ["Quanto custa?", "Você paga só os benefícios que aprovar, até o teto semanal que você define. Cada convite mostra o custo antes de você aprovar."],
  ["E se o cliente voltaria de qualquer jeito?", "Por isso 1 em cada 10 clientes não recebe convite. O painel conta só a volta a mais."],
  ["Preciso de equipe?", "O garçom digita o código no celular ou no computador do caixa."],
  ["Os dados ficam com quem?", "Você vê o nome, o e-mail e o telefone de quem fez check-in no seu salão, com o aceite do cliente. O contato fica guardado criptografado, e o cliente pode apagar os dados quando quiser."],
  ["Por que a foto do cardápio do salão?", "O cardápio do salão costuma ter itens e preços diferentes do delivery."],
];

export function OwnerLanding({ ctaHref, customerHref }: { ctaHref: string; customerHref: string }) {
  const cta = (
    <Link href={ctaHref} className="flex min-h-12 items-center justify-center rounded-md bg-red-button px-6 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
      Ativar meu salão
    </Link>
  );
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-10">
      <section aria-labelledby="heroi" className="flex flex-col items-center gap-5 text-center">
        <Logo height={28} />
        <h1 id="heroi" className="text-3xl font-bold leading-10 text-ink sm:text-4xl">
          Seu salão cheio divulga seu horário vazio
        </h1>
        <p className="max-w-xl text-lg leading-7 text-ink-muted">
          O cliente que lê o QR na mesa ganha um benefício na hora. Nove em cada dez também podem ganhar um convite para quando sobra mesa, como terça às 15h. Você vê quantos voltaram e quanto rendeu a mais que um grupo sorteado sem convite.
        </p>
        <div className="flex w-full max-w-sm flex-col gap-3">
          {cta}
          <Link href={customerHref} className="flex min-h-12 items-center justify-center rounded-md border border-border bg-surface-muted px-6 text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            Veja o que seu cliente vê
          </Link>
        </div>
      </section>

      <section aria-labelledby="passos" className="flex flex-col gap-4">
        <h2 id="passos" className="text-2xl font-bold text-ink">
          Como funciona
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-sm border border-border bg-white p-4">
              <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-red-button text-base font-bold text-white">
                {i + 1}
              </span>
              <p className="text-base leading-6 text-ink">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="prova" className="flex flex-col gap-3 rounded-sm border border-border bg-white p-6 sm:flex-row sm:items-center sm:gap-6">
        <p aria-hidden="true" className="text-5xl font-bold text-red-text">
          63%
        </p>
        <div className="flex flex-col gap-2">
          <h2 id="prova" className="text-lg font-semibold text-ink">
            Segundo o iFood, 63% de quem usou o Comer Fora no Rio voltou a um restaurante do programa em menos de 1 mês.
          </h2>
          <p className="text-base text-ink">O convite faz essa volta acontecer no seu restaurante, no horário em que sobra mesa.</p>
          <Link href="/bastidores/como-funciona#fontes" className="inline-flex min-h-6 w-fit items-center text-sm font-semibold text-red-text underline">
            Fonte
          </Link>
        </div>
      </section>

      <section aria-labelledby="custo" className="flex flex-col gap-3">
        <h2 id="custo" className="text-2xl font-bold text-ink">
          Você controla o custo
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CONTROL.map((c) => (
            <li key={c} className="flex items-start gap-2 text-base text-ink">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-red-text" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5 9-10" />
              </svg>
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq" className="flex flex-col gap-3">
        <h2 id="faq" className="text-2xl font-bold text-ink">
          Perguntas frequentes
        </h2>
        <div className="flex flex-col divide-y divide-divider rounded-sm border border-border bg-white">
          {FAQ.map(([q, a]) => (
            <details key={q} className="px-4 py-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold text-ink">{q}</summary>
              <p className="pb-2 text-base leading-6 text-ink-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mx-auto w-full max-w-sm">{cta}</div>
    </main>
  );
}
