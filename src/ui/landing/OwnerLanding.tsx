import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { Logo } from "@/src/ui/components/Logo";

/**
 * Landing de venda para o dono (S5.2, flag `copy_v2`; S9: copy da Parte A do plano, skill de copywriting). Prova só com
 * o número público real e a fonte exata (D182); só a barra de protótipo como aviso de marca (D183); "Quanto custa?" fala
 * só do benefício (D184). Números e tetos são do sistema, nunca da IA (espec. 3.7). O herói mostra prints reais do
 * restaurante de exemplo (dados gerados), capturados por Playwright; a legenda diz que o efeito é o do gerador. No
 * celular, um recorte só do cartão "Quanto os convites renderam" (`visao-geral-topo.webp`, recortado do print inteiro).
 */
export const LANDING_TITLE = "Encha a terça à tarde com quem lotou seu sábado à noite";
export const LANDING_EYEBROW = "Comer Fora no salão · para restaurantes com horário sobrando";
// S9 (revisão de produto): o benefício é só do cliente novo; a medida em reais desconta o custo dos convites.
export const LANDING_SUBTITLE =
  "Um QR do Comer Fora na mesa dá ao cliente novo um benefício na 1ª visita e, depois do check-in, um convite para voltar no horário que você precisa encher. O painel mostra em reais quanto essa volta rendeu, já descontado o custo dos convites.";

const VALUE: Array<[string, string]> = [
  [
    "Do cardápio ao kit para imprimir em 5 passos.",
    "Você fotografa o cardápio e marca os horários vazios. A IA lê os pratos e sugere o benefício e o convite de cada horário, e você vê o custo de cada um antes de aprovar. Depois de aprovar, você imprime o kit: display de mesa, cartaz e cartão do garçom.",
  ],
  [
    "O cliente da mesa deixa de ser anônimo.",
    "Com o check-in, ele vira um cliente com nome e histórico de visitas. Nove em cada dez recebem ali mesmo um convite para voltar, enquanto houver vaga no teto semanal. Quem aceitar recebe também convites para outras datas.",
  ],
  [
    "Um plano por semana, aprovado por você.",
    "Quando você gera o plano da semana, a IA sugere a oferta de cada horário vazio, explica a escolha e diz se a oferta da semana anterior deve ficar. Quer mudar? Peça ao Assistente do salão, como “troca a oferta de terça por uma entrada”, confira o antes e depois e aplique com um clique.",
  ],
  ["Só conta a volta a mais.", "1 em cada 10 clientes não recebe convite. O painel compara os dois grupos e mostra a diferença em reais."],
];
const CONTROL = [
  "Teto semanal de convites em cada horário vazio, que você ajusta",
  "Custo do benefício e de cada convite antes de aprovar",
  "O plano da semana só vale com o seu OK",
  "Seus clientes ficam na base do seu restaurante",
];
const FAQ: Array<[string, string]> = [
  [
    "Quanto custa?",
    "Você paga só os benefícios que aprovar. Os convites têm um teto por semana, que você ajusta. O benefício de 1ª visita tem custo por cliente novo, e você vê esse valor antes de ativar.",
  ],
  ["O que a IA decide?", "A IA lê o cardápio, escolhe entre ofertas que o sistema calculou e explica o motivo. Preço, custo, teto e resultado vêm sempre do sistema, e nada muda sem o seu OK."],
  ["E se o cliente já fosse voltar de qualquer jeito?", "Por isso 1 em cada 10 clientes não recebe convite. O painel conta só a volta a mais."],
  ["Preciso de equipe?", "Não. O garçom confere o código no celular ou no computador do caixa."],
  ["Os dados ficam com quem?", "Você vê o nome, o e-mail e o telefone de quem fez check-in no seu salão, com o aceite do cliente. O contato fica guardado criptografado, e o cliente pode apagar os dados quando quiser."],
  ["Por que a foto do cardápio do salão?", "O cardápio do salão costuma ter itens e preços diferentes do delivery."],
];

/** Prints reais do restaurante de exemplo: o histórico é gerado e o efeito do convite é o declarado no gerador (+0,20 em 14 dias, D217). */
const PRINT_ALT =
  "Visão geral do restaurante de exemplo: Quanto os convites renderam, R$ 9.735 de margem a mais, já descontado o custo dos convites, podendo ficar entre R$ 2.259 e R$ 17.210.";
const PHONE_ALT = "Celular do cliente depois do check-in no restaurante de exemplo: o código do benefício de 1ª visita e, logo abaixo, o convite para voltar no horário vazio.";
export const PRINT_CAPTION = "Restaurante de exemplo: histórico gerado, com o efeito do convite fixado em +0,2 visita por cliente com convite em 14 dias. Não é resultado medido.";

export function OwnerLanding({ ctaHref, customerHref }: { ctaHref: string; customerHref: string }) {
  const { props: printTop } = getImageProps({ src: "/landing/visao-geral-topo.webp", alt: "", width: 950, height: 267, unoptimized: true });
  const { props: print } = getImageProps({ src: "/landing/visao-geral.webp", alt: "", width: 1600, height: 843, sizes: "(min-width: 1024px) 752px, 100vw", unoptimized: true, loading: "eager", fetchPriority: "high" });
  const cta = (
    <Link href={ctaHref} className="flex min-h-12 items-center justify-center rounded-md bg-red-button px-6 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
      Ativar meu salão
    </Link>
  );
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10">
      <section aria-labelledby="heroi" className="flex flex-col items-center gap-10">
        <div className="flex max-w-3xl flex-col items-center gap-5 text-center">
          <Logo height={28} />
          <p className="text-sm font-semibold text-red-text">{LANDING_EYEBROW}</p>
          <h1 id="heroi" className="text-3xl font-bold leading-10 text-ink sm:text-4xl sm:leading-[1.15]">
            {LANDING_TITLE}
          </h1>
          <p className="max-w-xl text-lg leading-7 text-ink-muted">{LANDING_SUBTITLE}</p>
          <div className="flex w-full max-w-sm flex-col gap-3">
            {cta}
            <Link href={customerHref} className="flex min-h-12 items-center justify-center rounded-md border border-border bg-surface-muted px-6 text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              Veja o que seu cliente vê
            </Link>
          </div>
          <p className="text-sm text-ink-muted">Seu salão cheio divulga seu horário vazio.</p>
        </div>

        <figure className="flex w-full min-w-0 max-w-4xl flex-col gap-3">
          {/* Abaixo de 640 px, só o cartão "Quanto os convites renderam" (o print inteiro fica ilegível) e o celular embaixo. */}
          <div className="flex flex-col items-center gap-4 sm:relative sm:block sm:pb-16 sm:pr-36">
            <picture className="block w-full">
              <source media="(max-width: 639px)" srcSet={printTop.srcSet ?? printTop.src} width={printTop.width} height={printTop.height} />
              <img {...print} alt={PRINT_ALT} className="h-auto w-full rounded-sm border border-border bg-white shadow-low" />
            </picture>
            <Image
              src="/landing/celular-convite.webp"
              alt={PHONE_ALT}
              width={390}
              height={780}
              sizes="(min-width: 640px) 170px, 160px"
              unoptimized
              className="h-auto w-[160px] rounded-xl border-4 border-ink bg-white shadow-medium sm:absolute sm:right-0 sm:bottom-0 sm:w-[170px]"
            />
          </div>
          <figcaption className="text-center text-sm text-ink-muted">{PRINT_CAPTION}</figcaption>
        </figure>
      </section>

      <section aria-labelledby="valor" className="flex flex-col gap-4">
        <h2 id="valor" className="text-2xl font-bold text-ink">
          O que você ganha
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {VALUE.map(([t, d]) => (
            <li key={t} className="flex flex-col gap-1 rounded-sm border border-border bg-white p-4">
              <h3 className="text-base font-bold text-ink">{t}</h3>
              <p className="text-base leading-6 text-ink">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="prova" className="flex flex-col gap-2 rounded-sm border border-border bg-white p-6">
        <h2 id="prova" className="text-2xl font-bold text-ink">
          <span className="text-red-text">63%</span> voltaram em menos de 1 mês
        </h2>
        <p className="text-base text-ink">Segundo o iFood, 63% de quem usou o Comer Fora no Rio voltou a um restaurante do programa em menos de 1 mês.</p>
        <p className="text-base text-ink">O convite pede essa volta para o seu restaurante, no horário em que sobra mesa.</p>
        <Link href="/bastidores/como-funciona#fontes" className="inline-flex min-h-6 w-fit items-center text-sm font-semibold text-red-text underline">
          Fonte
        </Link>
      </section>

      <section aria-labelledby="custo" className="flex flex-col gap-3">
        <h2 id="custo" className="text-2xl font-bold text-ink">
          Você vê o custo antes de aprovar, e os convites têm teto semanal
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
            <details key={q} className="group px-4 py-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="pb-2 text-base leading-6 text-ink-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mx-auto w-full max-w-sm">{cta}</div>
    </main>
  );
}
