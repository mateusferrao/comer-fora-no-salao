import Link from "next/link";
import type { Metadata } from "next";
import { VITRINE_SIM } from "@/src/modules/simulacao/domain/generator";

export const metadata: Metadata = { title: "Como funciona · Comer Fora no Salão · protótipo de case" };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const h2 = "mt-8 text-lg font-bold text-ink";
const p = "mt-2 text-sm leading-6 text-ink";
const li = "text-sm leading-6 text-ink";

/** "Como este protótipo funciona" (espec. 3.1; S3 §4.6; S4 §4.6): real × histórico gerado, parâmetros, limitações e dados pessoais. */
export default function ComoFunciona() {
  const s = VITRINE_SIM;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm">
        <Link className="text-red-text underline" href="/">
          ← Início
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-ink">Como este protótipo funciona</h1>
      <p className={p}>
        Protótipo de case para o processo seletivo iFood GenAI 2027. Não é produto oficial do iFood. O produto funciona de verdade: login, check-in, códigos, convites,
        e-mails e IA. O único dado gerado é o histórico do restaurante de exemplo. A ideia: o salão cheio
        divulga o horário vazio. O cliente que já está na mesa ganha algo agora e um convite para voltar no horário vazio; o dono vê o retorno medido contra um grupo de controle.
      </p>

      <h2 className={h2}>O que é real e o que é gerado</h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <section className="rounded-sm border border-border bg-white p-4">
          <h3 className="font-semibold text-ink">Real (funciona de verdade)</h3>
          <ul className="mt-1 list-disc pl-5">
            {["IA ao vivo no restaurante que você cadastra: leitura do cardápio, pacote, kit e plano da semana", "Login do dono e do cliente por e-mail com código (AWS SES)", "GPS (a distância é calculada no seu aparelho; só o status vai ao servidor)", "Check-ins, códigos, convites, grupo de controle, teto e validação", "Reativação: o convite chega na Jornada do cliente", "Banco de dados, regras, insights, funil e métrica com intervalo"].map((x) => (
              <li key={x} className={li}>
                {x}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-sm border border-border bg-white p-4">
          <h3 className="font-semibold text-ink">Gerado ou de exemplo</h3>
          <ul className="mt-1 list-disc pl-5">
            {["Os 60 dias de histórico do restaurante de exemplo (selo \"Restaurante de exemplo · histórico gerado\") e os clientes desse histórico", "Coordenada do restaurante", "Leituras dos 3 cardápios de exemplo (processadas antes e guardadas)", "\"Avançar 1 dia\" nas Ferramentas do avaliador (só para ver a volta no mesmo dia)"].map((x) => (
              <li key={x} className={li}>
                {x}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <h2 className={h2}>Como medimos (e os limites da medida)</h2>
      <ul className="mt-2 list-disc pl-5">
        <li className={li}>Quem poderia receber convite é sorteado: 9 em 10 recebem; 1 em 10 fica no grupo de controle e recebe um convite invisível (intenção de tratar). A comparação conta todas as visitas registradas nos 14 dias depois do sorteio, só com janelas já fechadas.</li>
        <li className={li}>Estimador de Welch com intervalo de 95%. Quatro estados: positivo (intervalo todo acima de zero), negativo (todo abaixo), ainda não dá para afirmar (cruza o zero) e amostra insuficiente (menos de 30 clientes num dos grupos).</li>
        <li className={li}>&quot;Visitas registradas&quot; são check-ins: quem volta sem fazer check-in não aparece. Em produção, cruzaríamos com pagamento ou reserva.</li>
        <li className={li}>Proteção contra migração: as visitas fora do horário vazio também são comparadas, para ver se o convite só troca o cliente de horário.</li>
        <li className={li}>Num restaurante, o grupo de controle é pequeno: o resultado tem intervalo largo. A prova estatística fica para um piloto com ~50 restaurantes.</li>
        <li className={li}>O veredito por oferta (manter, trocar, cedo demais) usa indicadores antecipados (uso em uma semana) e não é causal. O incremento só aparece no total do restaurante.</li>
      </ul>

      <h2 className={h2}>A simulação (baseada em agentes, sem IA)</h2>
      <p className={p}>
        Os 60 dias do restaurante de exemplo usam as mesmas regras do produto (as mesmas funções do check-in, do sorteio, do teto e da reativação), com um relógio
        falso. Cada cliente simulado tem uma taxa de volta; quem recebe convite ganha um efeito programado. O painel &quot;mede&quot; o que foi programado: é isso que mostramos.
      </p>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {[
            ["Efeito programado do convite", `+${s.effect.toFixed(2).replace(".", ",")} visita por cliente em 14 dias (convidados × grupo de controle)`],
            ["Parte do efeito que é migração do pico", pct(s.migrationShare)],
            ["Clientes novos identificados por semana", `${s.weeklyNew}`],
            ["Visitas-base de volta em 14 dias", s.baseVisits14.toFixed(1).replace(".", ",")],
            ["Códigos validados pelo garçom", `${pct(s.validationP)} (${pct(s.validationPSatNight)} no sábado à noite)`],
            ["Clientes com opt-in", pct(s.optInP)],
            ["Semente da vitrine", `${s.seed}`],
          ].map(([k, v]) => (
            <tr key={k} className="border-b border-divider">
              <th scope="row" className="py-2 pr-4 text-left font-normal text-ink-muted">
                {k}
              </th>
              <td className="py-2 text-ink">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={p}>
        Robustez: com o efeito programado, o intervalo fica acima de zero em 132 de 140 combinações (20 sementes × 7 dias da semana de início). A semente da vitrine foi escolhida
        entre as que dão resultado positivo, com o efeito programado dentro do intervalo, em qualquer dia da semana. O restaurante que você cadastra começa vazio e mostra
        &quot;amostra insuficiente&quot; até ter dados: é o comportamento honesto com pouco tempo de uso.
      </p>

      <h2 className={h2}>O que já existe no Comer Fora × o que é novo aqui</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th scope="col" className="py-2 font-normal">Já existe (pesquisa pública e app)</th>
            <th scope="col" className="py-2 font-normal">Novo neste protótipo</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Benefício de 1ª visita, cartela, cashback, benefício por dia e turno", "Convite de volta nascido na mesa para o horário vazio, com teto e custo controlados"],
            ["Configurar trilha de marketing no Portal", "Ativação proposta: foto do cardápio → pacote pronto → kit para imprimir"],
            ["Check-in no app", "Peças físicas com QR por peça e versão (atribuição, A/B)"],
            ["Resultados de campanha, histórico do cliente", "Plano da semana: insights do código + IA que escolhe e explica + \"o que aprendemos\""],
            ["(não encontrado em fontes públicas)", "Incremento medido contra grupo de controle, com intervalo"],
          ].map(([a, b]) => (
            <tr key={a} className="border-b border-divider align-top">
              <td className="py-2 pr-4 text-ink">{a}</td>
              <td className="py-2 text-ink">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className={h2}>Hipóteses (por que 80% não divulgam) e como cada uma é medida</h2>
      <ul className="mt-2 list-disc pl-5">
        <li className={li}>H1 — falta material: % de restaurantes ativados com peça no salão e com leituras.</li>
        <li className={li}>H2 — o dono não vê retorno: visitas e margem incrementais contra o grupo de controle.</li>
        <li className={li}>H3 — a equipe não engaja: check-ins sem código validado, por turno.</li>
        <li className={li}>H4 — o custo assusta: custo por cliente identificado, custo × margem e ajustes do dono no pacote.</li>
        <li className={li}>H5 — o dono desconfia de divulgar o iFood no próprio salão: abandono por passo do assistente. A base de clientes é declarada do restaurante (o iFood afirma que, no Comer Fora, &quot;os dados ficam com o restaurante&quot; — fonte pública citada na especificação).</li>
      </ul>

      <h2 className={h2}>Dados pessoais, IA e segurança</h2>
      <ul className="mt-2 list-disc pl-5">
        <li className={li}>O cliente entra com o próprio e-mail e um código de 6 dígitos. O e-mail fica guardado como código (HMAC) e criptografado (AES-256-GCM), só para enviar convites; o nome aparece para o restaurante como primeiro nome + inicial; o telefone é opcional e fica só como código + 4 últimos dígitos.</li>
        <li className={li}>Os dados do cliente não são apagados sozinhos: ficam enquanto houver relação com o restaurante, como num CRM real, e o cliente apaga tudo quando quiser em &quot;Sua jornada&quot; › engrenagem › &quot;Apagar meus dados&quot;. Por ser um protótipo que recebe dados reais, isso é um risco aceito e declarado.</li>
        <li className={li}>Os interruptores de comunicação (e-mail e notificação no app) vêm ligados, como no app. Em produção, a LGPD pede consentimento ativo.</li>
        <li className={li}>O e-mail do dono é guardado só como código (HMAC) + uma dica mascarada; o AWS SES processa o endereço para entregar o código de login.</li>
        <li className={li}>IA só pelo OpenRouter, com saída validada, valores sempre por referência (o código escreve números, preços e nomes), palavras proibidas, aprovação do dono e rastro sem dados pessoais (Langfuse). Nenhum dado pessoal entra em prompt.</li>
        <li className={li}>O agendador roda no próprio servidor, uma vez por minuto: no dia e na hora escolhidos pelo dono (padrão segunda 08:30), gera o plano da semana e manda o resumo por e-mail com &quot;Revisar e aprovar&quot;; no dia do convite, manda 1 lembrete ao cliente, X horas antes do horário. Os e-mails são reais (remetente compartilhado msg.automato.pro), só para quem aceitou, sempre com &quot;Preferências de e-mail · Descadastrar&quot;. Não há data para parar: o envio automático é desligado nos Bastidores.</li>
        <li className={li}>O link &quot;Revisar e aprovar&quot; vale uma vez, só para aquele plano, por 7 dias; abrir o link não aprova nada (é preciso tocar em &quot;Aprovar plano&quot;). O dono pode desligar a aprovação pelo e-mail. A página leva o logo do iFood, com o risco de confusão aceito.</li>
        <li className={li}>Tudo é configurável: o dono escolhe dia e hora do resumo, plano automático, aprovação pelo e-mail, quais e-mails vão aos clientes e a antecedência do lembrete; o cliente escolhe por restaurante em &quot;Gerenciar notificações&quot;. Quando o dono desliga e-mails aos clientes, o convite continua no app: a medida segue por intenção de tratar, mas a intensidade do tratamento muda (o motivo fica registrado em cada mensagem pulada).</li>
        <li className={li}>&quot;IA do restaurante&quot; é opcional: sem nada preenchido, a IA usa o padrão com os dados que o sistema já tem. Fatos e termos a evitar passam por validação (sem contato, links, marcação nem frases de comando), entram no prompt só como dado delimitado (nunca como instrução) e a saída continua presa às ofertas do código, aos guardrails, ao revisor e à aprovação do dono. O banco só é acessado com consultas parametrizadas.</li>
        <li className={li}>Plano como agente: a IA pode consultar ferramentas só de leitura (números, ofertas possíveis, custo da semana e conferência dos textos) antes de responder. Ele só liga se ganhar da chamada única na medida com juiz cego (eval/relatorio-t3-agente.md); se falhar, o plano cai na chamada única e depois no modo sem IA.</li>
        <li className={li}>&quot;Avançar 1 dia&quot; fica nas Ferramentas do avaliador, fora do produto: recua a visita e o convite de hoje (só de clientes reais) para mostrar a volta com código no mesmo dia, e tira esses check-ins de &quot;Hoje&quot;.</li>
      </ul>

      <h2 id="fontes" className={h2}>Fontes</h2>
      <ul className="mt-2 list-disc pl-5">
        <li className={li}>
          &quot;63% de quem usou o Comer Fora no Rio voltou a um restaurante do programa em menos de 1 mês&quot;: número declarado pelo iFood, citado pelo Diário do Rio em 12/11/2026 (
          <a className="font-semibold text-red-text underline" href="https://diariodorio.com/rio-de-janeiro/2026/11/12/ifood-lanca-no-rio-aplicativo-de-descontos-para-quem-prefere-comer-fora.html" rel="noopener noreferrer" target="_blank">
            reportagem
          </a>
          ). Mede a volta a qualquer restaurante do programa, sem método publicado; não é resultado deste protótipo.
        </li>
        <li className={li}>Os números do briefing do case (como &quot;só 20% divulgam&quot;) são marcados pelo próprio briefing como dados fictícios: aparecem só no contexto do case, nunca como prova ao dono.</li>
      </ul>

      <h2 className={h2}>Créditos das fotos</h2>
      <p className={p}>Fotos de banco livre do Wikimedia Commons (nenhuma mostra pessoas, marcas ou letreiros reais):</p>
      <ul className="mt-1 list-disc pl-5">
        {[
          "Salão: “Modern dining area with wooden decor and empty tables…” — Nenad Stojković, CC BY 2.0",
          "Entrada: “Bruschetta (3755334055)” — Karen and Brad Emerson, CC BY 2.0",
          "Prato: “Spaghetti2” — Popo le Chien, CC0",
          "Porção: “Arancini (veggie) - Nanninella 2025-10-21” — Andy Li, CC0",
          "Sobremesa: “Dolce Tiramisù monoporzione” — Anna.Massini, CC BY 4.0",
        ].map((x) => (
          <li key={x} className={li}>
            {x}
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm">
        <Link className="text-red-text underline" href="/bastidores/qualidade">
          Qualidade da IA
        </Link>{" "}
        ·{" "}
        <Link className="text-red-text underline" href="/bastidores/plataforma">
          Visão da plataforma
        </Link>{" "}
        ·{" "}
        <Link className="text-red-text underline" href="/bastidores/avaliador">
          Ferramentas do avaliador
        </Link>
      </p>
    </main>
  );
}
