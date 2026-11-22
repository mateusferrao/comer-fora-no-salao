/**
 * Diagramas das páginas que explicam o protótipo (S7, D322). HTML + CSS com os tokens do design system: viram coluna
 * no celular e continuam legíveis para leitor de tela (cada diagrama é uma figura com legenda e lista ordenada).
 */
import type { ReactNode } from "react";
import { REPO_URL, repoFile } from "@/src/shared/links";

const box = "rounded-sm border border-border bg-white p-3 text-sm leading-5 text-ink";
const tag = "text-xs font-semibold uppercase tracking-wide";

function Arrow({ label }: { label?: string }) {
  return (
    <div aria-hidden="true" className="flex shrink-0 items-center justify-center text-ink-muted md:px-1">
      <span className="text-lg leading-none md:hidden">↓</span>
      <span className="hidden text-lg leading-none md:inline">→</span>
      {label ? <span className="ml-1 text-xs">{label}</span> : null}
    </div>
  );
}

function Figure({ id, title, caption, children }: { id: string; title: string; caption: ReactNode; children: ReactNode }) {
  return (
    <figure aria-labelledby={`${id}-t`} className="mt-3 rounded-sm bg-surface-muted p-4">
      <p id={`${id}-t`} className="text-sm font-semibold text-ink">
        {title}
      </p>
      <div className="mt-3">{children}</div>
      <figcaption className="mt-3 text-xs leading-5 text-ink-muted">{caption}</figcaption>
    </figure>
  );
}

function Step({ n, title, children, accent }: { n: number; title: string; children: ReactNode; accent?: boolean }) {
  return (
    <li className={`${box} flex-1 ${accent ? "border-red-text" : ""}`}>
      <p className={`${tag} ${accent ? "text-red-text" : "text-ink-muted"}`}>Passo {n}</p>
      <p className="mt-1 font-semibold">{title}</p>
      <p className="mt-1 text-ink-muted">{children}</p>
    </li>
  );
}

/** Do QR à volta: o produto em 5 passos, com o sorteio do grupo de controle. */
export function FluxoDiagrama() {
  return (
    <Figure
      id="fluxo"
      title="Do QR na mesa à volta no horário vazio"
      caption="O sorteio só acontece entre quem poderia receber convite naquele momento (plano ativo, sem convite ativo, teto livre). Quem fica no grupo de controle recebe um convite invisível com as mesmas datas, para os dois grupos começarem a contar no mesmo dia."
    >
      <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <Step n={1} title="Lê o QR na mesa">
          Display ou cartaz do kit, com um QR por peça e versão.
        </Step>
        <Arrow />
        <Step n={2} title="Faz check‑in">
          E-mail + código. Ganha o benefício de 1ª visita e um selo.
        </Step>
        <Arrow />
        <Step n={3} title="Sorteio" accent>
          9 em 10 recebem o convite. 1 em 10 fica no grupo de controle.
        </Step>
        <Arrow />
        <Step n={4} title="Volta no horário vazio">
          Em outro dia, dentro da faixa: nasce o código do convite.
        </Step>
        <Arrow />
        <Step n={5} title="Garçom valida">
          O painel compara convidados × controle e mostra o resultado em R$.
        </Step>
      </ol>
    </Figure>
  );
}

/** Como o painel decide o que mostrar: os 4 estados do incremento. */
export function MedidaDiagrama() {
  const states = [
    { t: "Amostra insuficiente", d: "menos de 30 clientes num dos grupos" },
    { t: "Ainda não dá para afirmar", d: "o intervalo de 95% cruza o zero" },
    { t: "Positivo", d: "o intervalo inteiro acima de zero" },
    { t: "Negativo", d: "o intervalo inteiro abaixo de zero" },
  ];
  return (
    <Figure
      id="medida"
      title="Como o painel chega a “R$ X de margem a mais”"
      caption="Diferença de visitas por cliente em 14 dias (só janelas já fechadas), com erro padrão de Welch. A margem em R$ usa o ticket e a margem que o dono informou e desconta o custo dos convites. As visitas fora do horário vazio passam pela mesma conta, para pegar a migração de horário."
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <div className="flex flex-1 flex-col gap-2">
          <div className={box}>
            <p className={`${tag} text-red-text`}>Convidados (9 em 10)</p>
            <p className="mt-1">Visitas registradas por cliente em 14 dias</p>
          </div>
          <div className={box}>
            <p className={`${tag} text-ink-muted`}>Grupo de controle (1 em 10)</p>
            <p className="mt-1">Visitas registradas por cliente em 14 dias</p>
          </div>
        </div>
        <Arrow label="diferença ± 1,96 × erro" />
        <ul className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Os 4 estados do resultado">
          {states.map((s) => (
            <li key={s.t} className={box}>
              <p className="font-semibold">{s.t}</p>
              <p className="text-ink-muted">{s.d}</p>
            </li>
          ))}
        </ul>
      </div>
    </Figure>
  );
}

/** Divisão de trabalho entre o código e a IA, guardrails e caminho de reserva. */
export function IaDiagrama() {
  const layers = ["Contrato (schema)", "Regras fixas: valores por referência, palavras proibidas, escolha só entre candidatas", "Revisor de outro provedor", "Aprovação do dono", "Rastro sem dados pessoais"];
  return (
    <>
      <Figure id="ia-divisao" title="Quem decide o quê" caption="Preço, custo, teto, sorteio e resultado nunca passam pela IA. A IA escreve com referências ({prato}, {horario}, {fato}) que o código troca pelos valores reais.">
        <div className="grid gap-2 md:grid-cols-2">
          <div className={box}>
            <p className={`${tag} text-ink-muted`}>O código decide</p>
            <ul className="mt-2 list-disc pl-5">
              <li>as ofertas possíveis de cada horário vazio, com custo e teto</li>
              <li>o sorteio do grupo de controle e os códigos</li>
              <li>o veredito de cada oferta e o resultado em R$</li>
              <li>se a proposta do assistente é válida, e o “antes → depois”</li>
            </ul>
          </div>
          <div className={`${box} border-red-text`}>
            <p className={`${tag} text-red-text`}>A IA faz</p>
            <ul className="mt-2 list-disc pl-5">
              <li>lê a foto do cardápio</li>
              <li>escolhe uma oferta entre as do código, casando item e horário</li>
              <li>escreve o convite, a justificativa e “o que aprendemos”</li>
              <li>entende o pedido do dono e propõe a mudança</li>
            </ul>
          </div>
        </div>
      </Figure>
      <Figure
        id="ia-camadas"
        title="Camadas de proteção e caminho de reserva"
        caption="Cada modelo é tentado uma vez: se o principal falha no schema ou nas regras, entra o modelo de reserva, de outro provedor. Sem chave, sem crédito ou depois de ~45 s, o produto segue no modo sem IA (oferta de maior nota e texto modelo, rotulados). O revisor não tem reserva: se falhar, o texto segue sem revisão e o dono aprova."
      >
        <ol className="flex flex-col gap-1">
          {layers.map((l, i) => (
            <li key={l} className={`${box} py-2`} style={{ marginLeft: `${i * 4}%` }}>
              <span className="mr-2 font-semibold text-red-text">{i + 1}</span>
              {l}
            </li>
          ))}
        </ol>
        <ol className="mt-3 flex flex-col gap-2 md:flex-row md:items-stretch" aria-label="Caminho de reserva">
          <li className={`${box} flex-1`}>Modelo principal</li>
          <Arrow label="falhou" />
          <li className={`${box} flex-1`}>Reserva de outro provedor</li>
          <Arrow label="falhou" />
          <li className={`${box} flex-1`}>Modo sem IA</li>
        </ol>
      </Figure>
    </>
  );
}

/** Arquitetura em camadas. */
export function ArquiteturaDiagrama() {
  const row = "flex flex-col gap-2 md:flex-row";
  return (
    <Figure
      id="arquitetura"
      title="Arquitetura"
      caption={
        <>
          Monólito modular em Next.js 16 sobre Postgres 16, num deploy só. O domínio não importa banco, IA nem framework, e isso é conferido no CI. Detalhes em{" "}
          {/* Legenda sobre fundo cinza: vermelho pequeno fica abaixo de 4,5:1 (axe) → texto principal sublinhado. */}
          <a className="font-semibold text-ink underline" href={repoFile("docs/arquitetura.md")} rel="noopener noreferrer" target="_blank">
            docs/arquitetura.md
          </a>
          .
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <div className={row}>
          <div className={`${box} flex-1`}>
            <p className={`${tag} text-ink-muted`}>Quem usa</p>
            <p className="mt-1">Dono (Portal), cliente (celular, pelo QR), garçom (link) e agentes de IA externos (MCP, com o token do dono)</p>
          </div>
        </div>
        <div className={row}>
          <div className={`${box} flex-1`}>
            <p className={`${tag} text-ink-muted`}>Telas e rotas</p>
            <p className="mt-1">Next.js; toda entrada validada com Zod; restaurante sempre tirado da sessão</p>
          </div>
          <div className={`${box} flex-1`}>
            <p className={`${tag} text-ink-muted`}>Casos de uso</p>
            <p className="mt-1">Ativação, check-in, plano da semana, kit, assistente, MCP e agendador usam as mesmas operações</p>
          </div>
          <div className={`${box} flex-1 border-red-text`}>
            <p className={`${tag} text-red-text`}>Domínio puro</p>
            <p className="mt-1">Sorteio, teto, convite, códigos, incremento: funções testadas, usadas também pelo simulador</p>
          </div>
        </div>
        <div className={row}>
          <div className={`${box} flex-1`}>
            <p className={`${tag} text-ink-muted`}>Dados</p>
            <p className="mt-1">Postgres 16 (Drizzle): eventos só por inserção, teto reservado de forma atômica</p>
          </div>
          <div className={`${box} flex-1`}>
            <p className={`${tag} text-ink-muted`}>IA</p>
            <p className="mt-1">OpenRouter (Gemini, GPT, DeepSeek) por uma porta única, com rastro no Langfuse</p>
          </div>
          <div className={`${box} flex-1`}>
            <p className={`${tag} text-ink-muted`}>Entrega</p>
            <p className="mt-1">CI com testes e E2E → deploy no Easypanel → E2E contra produção</p>
          </div>
        </div>
      </div>
    </Figure>
  );
}

/** Links do material do case (repositório, documentos, vídeo e slides). */
export function MaterialDoCaso() {
  const links: Array<[string, string, string]> = [
    ["Repositório", REPO_URL, "código, testes, avaliações e o histórico da construção"],
    ["Como ler a documentação", repoFile("docs/README.md"), "ordem de leitura e glossário"],
    ["Decisões principais", repoFile("docs/decisoes-principais.md"), "as 18 escolhas que definem o produto, com trade-offs"],
    ["IA no produto", repoFile("docs/ia-no-produto.md"), "tarefas, guardrails, custo e o que foi medido"],
    ["Como foi construído com IA", repoFile("docs/processo-com-ia.md"), "prompts, ferramentas e riscos"],
    ["Slide do processo e apresentação", `${REPO_URL}#material-do-case`, "PDF e PPTX; o vídeo também está lá"],
  ];
  return (
    <section aria-labelledby="material" className="mt-4 rounded-sm border border-border bg-white p-4">
      <h2 id="material" className="text-base font-bold text-ink">
        Material do case
      </h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {links.map(([t, href, d]) => (
          <li key={t} className="text-sm leading-6 text-ink">
            <a className="font-semibold text-red-text underline" href={href} rel="noopener noreferrer" target="_blank">
              {t}
            </a>{" "}
            <span className="text-ink-muted">· {d}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RepoLink({ path, children }: { path: string; children: ReactNode }) {
  return (
    <a className="font-semibold text-red-text underline" href={repoFile(path)} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  );
}
