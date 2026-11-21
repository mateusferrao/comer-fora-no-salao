# Planejamento da fatia S5 — Valor e conversão

Status: ✅ **aprovado em 21/11/2026 pelo candidato** depois da rodada `planejar-fatia`:
- leitura completa;
- 3 mapeamentos do código;
- 2 lotes de perguntas;
- 2 revisores independentes;
- 1 lote de perguntas pós-revisão.

Decisões D179–D185. Escopo de partida: replanejamento de 21/11 (D151–D170). A S5 é construída no branch da sessão, depois da S4, com as flags `painel_valor`, `copy_v2` e `explica_ia`. A revisão e o merge acontecem depois da S6 (D167).

## 1. Objetivo e entrega testável
A crítica do candidato foi "pouca inovação, resultado e técnica". A S5 ataca três pontos:
- **resultado em dinheiro:** o dono passa a ver reais desde o 1º convite usado;
- **conversão:** a landing e a página do QR passam a vender;
- **técnica visível:** a escolha da IA ganha explicação no lugar onde o dono decide.

Ao fim da fatia, com as três flags ligadas:
- **Visão geral:**
  - topo em R$ com 2 camadas: causal quando há resultado; "convites usados · consumo · margem · custo", rotulado "não causal", enquanto não há;
  - "Metas desta semana" por faixa;
  - feed "Hoje no salão" ao vivo.
- **Landing** de venda para o dono (herói, 3 passos, prova pública real, controle de custo, FAQ) e **página do QR de conversão** (faixa com o ganho, passos, prova social real, botão fixo).
- **Convite com "Adicionar à agenda"** (`.ics` de 1 evento no 1º dia em que o código pode nascer), faixa "vale hoje" na Jornada e e-mail do convite reescrito.
- **"Por que esta oferta?"** no plano e no pacote: opções do código, fatos, escolha da IA, regras e revisor; recolhido, "Como a IA decidiu" com modelo, tentativas, custo e tempo.

**Provas:**
- testes de unidade e integração;
- E2E em 2 projetos, `flags-off` (a suíte atual continua verde) e `flags-on`;
- varredura de textos;
- tipos, lint e fronteiras.

## 2. Requisitos e rastreabilidade
| Requisito | Fonte | Como será provado |
|---|---|---|
| Valor ao dono em R$ desde o início, sem afirmar causalidade sem base | Pedido do candidato; D162, D179; espec. 2 | Unidade `valueTopline` (5 formas); E2E: restaurante novo → volta validada → topo antecipado |
| Meta por faixa ("mesas a mais por semana") | Escopo S5.1; espec. 3.2 | Unidade `slotGoals`; integração `getSlotGoals` (semana de validação) |
| Atividade ao vivo, com o grupo de controle visível só ao dono | Escopo S5.1; D172 | Integração `getTodayFeed` (só reais, dia SP, marca, nome mascarado); E2E |
| Landing que vende ao dono, sem número inventado | Escopo S5.2; D182–D184; skill de copywriting | E2E de textos e CTA; varredura |
| Página do QR que converte, sem vazar o convite antes do check-in | D181; espec. 3.5 (holdout) | E2E: faixa, botão, axe; teste de que nada do convite aparece antes do check-in |
| Convite na agenda, no dia em que o código pode nascer | Escopo S5.2; espec. 3.3; D169 | Unidade `nextValidWindow` + `inviteIcs`; integração da rota (404 nos casos ruins) |
| Técnica da IA visível e honesta | D158, D180 | Integração `explainOffer`; E2E no pacote |
| Nada aparece com a flag desligada | D160 (corte por flag) | E2E `flags-off` |

## 3. Decisões desta fatia
| ID | Decisão | Alternativas | Trade-off | Motivo | Quem |
|---|---|---|---|---|---|
| D179 | Topo em R$ com 2 camadas. Causal: "R$ X a mais em margem entre N convidados até agora" + intervalo. Antecipada: "N convites usados (código validado pelo garçom) · ≈ R$ Y em consumo (R$ Z de margem) · custo dos convites R$ W" + "Estimativa, não causal: parte dessas pessoas voltaria sem convite." + o que falta para medir | Só os 4 estados; estimativa pontual sempre; (pós-revisão) consumo sem margem (recomendado); só custo e contagem | Dinheiro desde o 1º dia × risco de ler margem bruta como ganho | O restaurante novo ficaria semanas sem R$; o rótulo "não causal" e a frase explícita mitigam | Candidato (manteve a margem depois da revisão; o rótulo mudou de "voltaram" para "convites usados") |
| D180 | "Por que esta oferta?" em 2 camadas: dono + "Como a IA decidiu" recolhido | Só a linguagem do dono; técnico aberto | Técnica visível × tela poluída | A aposta D158 é mostrar a técnica sem confundir o dono | Candidato |
| D181 | Página do QR: topo de conversão acima da foto + o resto do app abaixo | Clone com o ganho no topo (recomendado); só textos; página inteira nova | Conversão × fidelidade ao print 04 (divergência registrada) | Pedido de conversão | Candidato |
| D182 | Prova da landing: só o número público real, com a frase exata: "Segundo o iFood, 63% de quem usou o Comer Fora no Rio voltou a um restaurante do programa em menos de 1 mês." | Briefing com fonte (números marcados como DADOS FICTÍCIOS no PDF); demonstração; cortar | Prova fraca, mas verdadeira | Regra do case e da skill: nada inventado | Candidato |
| D183 | Na landing, só a barra de protótipo (sem linha extra sob o CTA; o logo fica) | Linha "Protótipo de case, não é o iFood." sob o CTA (recomendado); sem logo | Limpeza × risco de confusão com o iFood (aceito) | A barra fixa já declara | Candidato |
| D184 | FAQ "Quanto custa?": "Você paga só os benefícios que aprovar, até o teto semanal que você define. Cada convite mostra o custo antes de você aprovar." | Tirar a pergunta; hipótese de cobrança | Resposta parcial × inventar um preço | Nenhuma decisão define cobrança; vai para a entrevista | Candidato |
| D185 | Itens [C] da rodada (§12) | — | — | — | IA [C] |

## 4. Produto e fluxos
**Dono (Visão geral, `painel_valor`):**
- abre o Portal e vê o topo em R$;
- no restaurante novo, sem resultado: "0 convites usados", com a explicação do que falta;
- sem ticket ou margem declarados: contagens + "Declare ticket e margem em Configurações para ver em reais";
- abaixo do topo, "Metas desta semana" e "Hoje no salão";
- a cada leitura, check-in, convite ou código, uma linha nova aparece em até 3 s.

**Dono (plano e pacote, `explica_ia`):** cada faixa tem o link "Por que esta oferta?", que abre um painel lateral.

**Dono potencial (landing, `copy_v2`):**
- lê o herói e os 3 passos;
- vê o 63% com a fonte, o controle de custo e o FAQ;
- clica em "Ativar meu salão" (Portal ou login) ou em "Veja o que seu cliente vê" (D176).

**Cliente (página do QR, `copy_v2`):**
- vê "{benefício}: {item} · na sua 1ª visita", os 3 passos e, se houver ≥ 5 check-ins reais em 7 dias, a prova;
- toca em "Fazer check-in e ativar o benefício";
- o fluxo de check-in não muda;
- **regra do holdout:** nenhuma oferta nem horário de convite antes do check-in.

**Cliente (convite):**
- no `InviteCard` (check-in e Jornada), "Adicionar à agenda" baixa o `.ics` com o 1º dia, a partir de amanhã, em que o código pode nascer, dentro da validade;
- na Jornada, "Seu convite vale hoje até 18h · {restaurante}" quando hoje é esse dia;
- o e-mail do convite traz a mesma linha da agenda.

## 5. Telas, estados e textos
Textos [C], escritos pela skill de copywriting (situação A, filtro de 3 perguntas, sem os vícios de texto de IA). O que é do candidato está marcado com o D.

### 5.1 Visão geral (`painel_valor`)
**`ValueHero`:**

| Estado | Linha principal | Linhas de apoio |
|---|---|---|
| `causal_positivo` | "R$ 1.840 a mais em margem entre 212 convidados até agora" (D162) | "provavelmente entre R$ 900 e R$ 2.700 · estimativa com os valores que você declarou" |
| `causal_negativo` | "R$ 310 a menos em margem entre 212 convidados" | "reveja a oferta no plano da semana" |
| `antecipado`, motivo `amostra` | "14 convites usados (código validado pelo garçom) · ≈ R$ 980 em consumo (R$ 340 de margem) · custo dos convites R$ 126" (D179) | "Estimativa, não causal: parte dessas pessoas voltaria sem convite." + "Para medir o efeito faltam 18 clientes do grupo de controle e 4 convidados com 14 dias completos." (cada parte só quando > 0) |
| `antecipado`, motivo `inconclusivo` | Mesma linha principal | Mesma estimativa + "Ainda não dá para afirmar o efeito: o resultado está dentro da margem de erro." |
| `sem_valores` | "14 convites usados (código validado pelo garçom) · custo dos convites R$ 126" | "Declare ticket médio e margem em Configurações para ver em reais." (link) |

- A linha atual de visitas por cliente continua abaixo, menor.
- Zero convites usados: "Nenhum convite usado ainda".

**"Metas desta semana":**
- um cartão por faixa ativa, por exemplo:
  - título "Ter a Qui, 15h às 18h";
  - "3 convites usados · meta: 8 mesas a mais por semana";
  - "12 de 32 convites emitidos nesta semana (teto)";
- barra de progresso (usados ÷ meta, até 100%) com `aria-label` contendo o texto inteiro;
- rótulo "não causal";
- sem faixas: some.

**"Hoje no salão"** (troca "Últimos check-ins de hoje" com a flag ligada):
- **cabeçalho:** "Hoje: 31 leituras · 12 check-ins · 7 códigos validados";
- **linhas:**
  - "14:32 · Leitura do QR · Display mesa A";
  - "14:33 · Ana S. fez check-in · 1ª visita";
  - "14:33 · Convite emitido para Ana S. · Ter a Qui, 15h às 18h";
  - "15:10 · Bruno L. fez check-in · volta com convite";
  - "15:12 · Código validado · convite";
  - no holdout: "14:40 · Carla M. fez check-in · 1ª visita · grupo de controle · sem convite (mede o efeito)";
- **linhas novas:** selo de texto "novo" por 2 s; animação de fundo só sem `prefers-reduced-motion`;
- **acessibilidade:** um `<p role="status" aria-live="polite" class="sr-only">` anuncia "Novo: …" só nas linhas novas (a lista não é `aria-live`);
- **vazio:** "Assim que alguém ler o QR, aparece aqui.";
- **limite:** 15 linhas.

### 5.2 Landing `/` (`copy_v2`)
1. **Herói:**
   - H1 "Seu salão cheio divulga seu horário vazio";
   - subtítulo: "O cliente que lê o QR na mesa ganha um benefício na hora. Nove em cada dez também ganham um convite para quando sobra mesa, como terça às 15h. Você vê quantos voltaram e quanto rendeu a mais que um grupo sorteado sem convite.";
   - botões "Ativar meu salão" (principal; Portal se logado, senão login) e "Veja o que seu cliente vê" (D176).
2. **"Como funciona"**, 3 passos numerados:
   1. "Mande a foto do cardápio do salão. A IA lê os pratos e propõe o benefício e o convite. O teto de convites sai das mesas que você quer encher. Você aprova."
   2. "Coloque o QR na mesa. O kit sai pronto para imprimir, com display de mesa e cartão do garçom."
   3. "Acompanhe o retorno. O painel compara quem recebeu convite com um grupo sorteado que não recebeu e mostra a diferença em reais."
3. **Prova (D182):**
   - número grande "63%";
   - "Segundo o iFood, 63% de quem usou o Comer Fora no Rio voltou a um restaurante do programa em menos de 1 mês.";
   - "O convite faz essa volta acontecer no seu restaurante, no horário em que sobra mesa.";
   - link "Fonte" → âncora `/bastidores/como-funciona#fontes`.
4. **"Você controla o custo"**, 4 itens:
   - "Teto semanal de convites por faixa";
   - "Custo de cada convite antes de aprovar";
   - "O plano da semana só vale com o seu OK";
   - "Seus clientes ficam na base do seu restaurante".
5. **"Perguntas frequentes"** (`<details>`):
   - **Quanto custa?** D184.
   - **E se o cliente voltaria de qualquer jeito?** "Por isso 1 em cada 10 clientes não recebe convite. O painel conta só a volta a mais."
   - **Preciso de equipe?** "O garçom digita o código no celular ou no computador do caixa."
   - **Os dados ficam com quem?** "Você vê o primeiro nome e a inicial de quem fez check-in. O e-mail fica guardado criptografado, e o cliente pode apagar os dados quando quiser."
   - **Por que a foto do cardápio do salão?** "O cardápio do salão costuma ter itens e preços diferentes do delivery."
6. **CTA final:** "Ativar meu salão".
- D183: nenhuma linha extra além da barra.
- Celular: coluna única, 16 px de margem.

### 5.3 Página do QR (`copy_v2`, D181)
- **Faixa acima da foto:**
  - ícone de presente + "{agora.title}: {agora.itemName}" + "na sua 1ª visita";
  - linha de passos "Faça check-in · Receba o código · Diga o código ao garçom";
  - quando N ≥ 5: "{N} check-ins nos últimos 7 dias".
- **Botão fixo:** "Fazer check-in e ativar o benefício".
- **Abaixo:** foto, nome, abas Benefícios/Sobre, como hoje.
- **Cliente logado que já usou a 1ª visita [C]:** a faixa vira "Faltam {n} selos para {recompensa.itemName}"; com 0 selos faltando, "Sua recompensa está pronta no check-in".
- **Sem benefício de agora configurado:** a faixa mostra só os passos.

### 5.4 Convite e Jornada (`copy_v2`)
- **`InviteCard`:** link-botão secundário "Adicionar à agenda" (`agendaUrl`, download), só quando `agendaUrl` existe.
- **Jornada, topo:** "Seu convite vale hoje até {fim} · {restaurante}" (link para o restaurante) quando a janela válida é hoje.
- **E-mail do convite:**
  - assunto "{Restaurante} guardou {gain} para você";
  - corpo:
    - "Volte {quando} e ganhe {gain}.";
    - recado (se houver);
    - "Vale até dd/mm. Faça check-in nesse horário para receber o código.";
    - "Adicionar à agenda: {agendaUrl}";
    - "Ver o convite: {jornada}";
    - descadastro;
    - rodapé (D175).
  - O formato HTML equivalente fica igual ao atual.

### 5.5 "Por que esta oferta?" (`explica_ia`)
- **Onde:** link por faixa no `PlanManager` e no `Step4Pacote` → `SidePanel` com título "Por que esta oferta?"; prende o foco, Esc fecha e o foco volta ao link.
- **Camada do dono:**
  - "O código separou {n} opções para esta faixa", em tabela com ganho, custo por convite, nota e marcas "maior nota", "escolha da IA" e "sua escolha"; abaixo, "Nota do código: quanto menor o custo perto do ticket médio, maior a nota.";
  - "A IA escolheu {gain}" + a justificativa renderizada;
  - quando a escolha não é a maior nota: "A IA não escolheu a maior nota: ela casa item e horário (por exemplo, sobremesa à tarde).";
  - "Fatos usados": lista "rótulo: valor";
  - "Passou nas regras: sem números inventados, item e horário certos.";
  - "Revisor (outro modelo): ok · atenção: {motivos} · bloqueado" ou "Revisor: não se aplica ao pacote";
  - **plano fixo:** "Plano escrito antes para o restaurante de exemplo, sem IA. Gere um plano novo para ver a IA decidir.";
  - **sem IA:** "Escolhida pela maior nota do código (IA indisponível: {motivo traduzido})".
- **`<details>` "Como a IA decidiu":**
  - "Modelo: {modelo servido} ({provedor})";
  - "Tentativas: 1ª bloqueada: palavra proibida 'grátis' → 2ª ok com o modelo reserva";
  - "Custo: US$ 0,0012 · Tempo: 3,4 s · Prompt: plano-v2";
  - sem chamada registrada: "Sem chamada de IA registrada para esta oferta."

## 6. Técnica
### 6.1 Arquivos
**Criar:**
- `src/modules/analytics/domain/value.ts` (`valueTopline`, `slotGoals`, tipos);
- `src/modules/analytics/application/value.ts` (`getEarlyValue`, `getSlotGoals`);
- `src/modules/analytics/application/today-feed.ts` (`getTodayFeed`);
- `src/modules/salao/domain/invite-window.ts` (`nextValidWindow`);
- `src/modules/salao/domain/ics.ts` (`inviteIcs`);
- `app/api/convite/agenda/route.ts`;
- `src/modules/planos/application/explain-offer.ts`;
- `app/api/parceiro/explicar/route.ts` (ou uma ação nova em `plano/[acao]`);
- `src/ui/painel/ValueHero.tsx`, `SlotGoals.tsx`, `TodayFeed.tsx`;
- `src/ui/painel/ExplainOffer.tsx`;
- `src/ui/ia/labels.ts`;
- `src/ui/landing/*` (seções da landing);
- `tests/e2e/flags.ts` (setup dos projetos).

**Alterar:**
- `app/api/parceiro/painel/[acao]/route.ts` (lê as flags);
- `Dashboard.tsx`;
- `app/parceiro/salao/page.tsx`;
- `app/page.tsx`;
- `app/r/[slug]/page.tsx` + `RestaurantView.tsx`;
- `salao/application/queries.ts` (contagem de 7 dias, `cache`);
- `views.ts` (`agendaUrl`);
- `InviteCard.tsx`;
- `app/app/jornada/*`;
- `deliver-messages.ts` (`inviteEmail`);
- `ia/ai-calls.ts` (`planId`);
- `generate-plan.ts`, `package.ts`, `ia/application/review.ts`, `review-plan.ts`;
- `PlanManager.tsx`, `Step4Pacote.tsx`;
- `app/bastidores/qualidade/page.tsx` (usa os labels);
- `app/bastidores/como-funciona/page.tsx` (seção "Fontes");
- `playwright.config.ts` (2 projetos);
- `entrada.spec.ts`, `apresentacao.spec.ts`, `volta.spec.ts`, `varredura.spec.ts`.

### 6.2 Interfaces
```ts
// analytics/domain/value.ts — só tipos de domínio (fronteira domain-no-infra)
export type EarlyValue = { usados: number; custoCents: number };
export type Topline =
  | { kind: "causal_positivo" | "causal_negativo"; cents: number; lo: number; hi: number; nT: number }
  | { kind: "antecipado"; motivo: "amostra" | "inconclusivo"; usados: number; consumoCents: number; margemCents: number; custoCents: number; faltamControle: number; faltamConvidados: number }
  | { kind: "sem_valores"; usados: number; custoCents: number; faltamControle: number; faltamConvidados: number; motivo: "amostra" | "inconclusivo" | "causal" };
export function valueTopline(p: { inc: Incremental; margin: MarginIncrement | null; early: EarlyValue; ticketCents: number | null; marginPct: number | null; minN?: number }): Topline;
export type SlotGoal = { slotId: string; days: number[]; startMin: number; endMin: number; metaMesas: number; usados: number; emitidos: number; teto: number | null };
export function slotGoals(slots: Slot[], usedBySlot: Map<string, number>, issuedBySlot: Map<string, { used: number; cap: number }>, capFallback: Map<string, number>): SlotGoal[];

// analytics/application
getEarlyValue(ex, restaurantId): Promise<EarlyValue>;            // inclui o histórico gerado (como metricOf)
getSlotGoals(ex, restaurantId, weekKey: string): Promise<SlotGoal[]>;
getTodayFeed(ex, restaurantId, now: Date, limit = 15): Promise<{ counts: { leituras: number; checkins: number; validados: number }; items: FeedItem[] }>;
type FeedItem = { id: string; at: string; kind: "leitura" | "checkin" | "convite" | "codigo"; name?: string; piece?: string; outcome?: "primeira_visita" | "volta" | "volta_com_convite" | "volta_lembrete"; controle?: boolean; slot?: { days: number[]; startMin: number; endMin: number }; codeType?: string };

// salao/domain
nextValidWindow(p: { slot: Slot; issuedDay: string; expiresAt: Date; now: Date }): { day: string; start: Date; end: Date } | null;
inviteIcs(p: { uid: string; restaurant: string; address: string | null; gain: string; window: { start: Date; end: Date }; journeyUrl: string; now: Date }): string;

// planos/application/explain-offer.ts
explainOffer(db, restaurantId: string, planId: string, slotId: string): Promise<OfferExplanation | null>;

// ia/ai-calls.ts
recordAiCall(db, { ...atual, planId?: string | null }): Promise<void>;
```

`DashboardView` ganha `value?: { topline: Topline; goals: SlotGoal[] }` (preenchido no `resumo` com a flag). `funnel` ganha `feed?` (no `funil` com a flag). `InviteView` ganha `agendaUrl?: string | null`, incluído em `sanitizeCheckinView` e no schema.

### 6.3 Dados
Sem migração: `ai_calls.plan_id` já existe (0004). Consultas:
- **`early`:** `codes` tipo `convite`, status `validado`, do restaurante, com o custo unitário pela versão do benefício. Mesma regra de custo do `metricOf`, inclui o histórico gerado.
- **Metas:**
  - `codes` de convite validados com `valid_day` na semana ISO de SP, ligados a `invites.slot_id`;
  - `invite_quota` (`week_key` atual) para emitidos e teto;
  - teto reserva: `decision.caps` do último plano aprovado ou `weeklyCapFor(extra_tables)`.
- **Feed:**
  - 4 consultas com `at >= início do dia em SP` e `simulation_run_id is null`;
  - junções com `customers` (`simulation_run_id is null`), `customer_contacts` (nome), `restaurant_customers` (braço) e `piece_variants`/`kit_pieces` (nome da peça);
  - `limit 15` em cada consulta;
  - união e ordenação em memória.
- **Prova do QR:** `count(*)` de check-ins dos últimos 7 dias no restaurante, com:
  - `simulation_run_id is null`;
  - o cliente sem e-mail de teste: `customer_contacts.email_hint` não terminando em `exemplo.invalid` nem em `simulator.amazonses.com`. Se a dica não permitir o filtro, usar o `email_hmac` dos padrões fixos ou excluir os restaurantes `kind='teste'` do E2E;
  - fora o restaurante E2E fixo (`e2e-salao-teste`).

### 6.4 IA
Nenhuma tarefa nova. A ligação com o plano acontece assim:
- `recordAiCall` passa a gravar `plan_id`;
- `generateWeeklyPlan` e `proposePackage` passam o `started.planId`;
- `runReview` recebe `planId?`, que `reviewPlan` passa.

`explainOffer` lê o plano (`candidates`, `choices`, `decision`, `facts`, `texts`) e a chamada mais recente de `ai_calls` por tarefa (`order by at desc`) desse plano.

### 6.5 Segurança e privacidade
- `explainOffer` sempre filtra por `restaurantId` vindo de `requireStore()`.
- Agenda:
  - o token é `signValue("agenda:"+inviteId)`;
  - a rota exige o convite real (`arm='convidavel'`), ativo e com janela;
  - qualquer falha devolve o mesmo 404;
  - nenhum id cru vai ao cliente;
  - o holdout nunca recebe link nem descobre que teve um convite fantasma.
- O feed mostra só `shortName`. Nada de e-mail ou telefone no feed, no `explainOffer` ou nos rastros.
- O `.ics` leva só o nome do restaurante, o endereço, o ganho e o link da Jornada.

## 7. Testes
**Unidade:**
- `valueTopline`:
  - positivo com margem → `causal_positivo`;
  - negativo → `causal_negativo`;
  - amostra (nH = 12, nT = 40) → `antecipado` com `faltamControle = 18`, `faltamConvidados = 0`;
  - inconclusivo → `antecipado` com `motivo = "inconclusivo"`;
  - ticket nulo → `sem_valores`;
  - consumo = usados × ticket; margem = consumo × margem% (arredondamento em centavos).
- `slotGoals`: usados por faixa; teto pela quota, senão pelo valor reserva; faixa inativa fora.
- `nextValidWindow`:
  - emitido terça 15:30 numa faixa Ter–Qui 15h–18h → quarta 15h–18h;
  - emitido segunda, faixa Ter → terça;
  - a próxima janela passa do vencimento → null;
  - `now` dentro da janela de hoje (emitido ontem) → hoje;
  - `now` depois do fim de hoje → próxima ocorrência.
- `inviteIcs`:
  - começa em `BEGIN:VCALENDAR\r\n`;
  - `DTSTART` em UTC (`…T180000Z` para 15h em SP);
  - dobra em 75 octetos sem cortar "ã";
  - escapa `,` `;` `\`;
  - UID estável.
- Extração dos fatos de `{fato:k}`.

**Integração:**
- `getEarlyValue`: só validados; o histórico gerado entra.
- `getTodayFeed`:
  - só clientes reais;
  - só o dia em SP;
  - a marca do holdout;
  - nome mascarado;
  - sem linha duplicada da volta;
  - o holdout não gera linha de convite.
- Prova de 7 dias:
  - 4 check-ins reais → oculta;
  - 5 → aparece;
  - e-mail `@exemplo.invalid` não conta.
- Rota da agenda: token inválido, convite de holdout, vencido e sem janela → 404; o válido → 200 `text/calendar`.
- `ai_calls.plan_id` preenchido em plano, pacote e revisor.
- `explainOffer`:
  - plano de outro restaurante → null;
  - o modelo reserva depois de uma tentativa bloqueada aparece na camada técnica;
  - plano fixo → `modo = fixo`.

**E2E:**
- **`flags-off`:** a suíte atual, sem mudança de asserção.
- **`flags-on`:**
  - restaurante novo com ticket e margem → cliente → check-in → validar → Avançar 1 dia → volta → validar → o topo mostra "1 convite usado";
  - "Hoje no salão" com a linha do check-in e a marca do controle (reaproveita a busca do holdout);
  - landing: "Ativar meu salão", o 63% e o FAQ;
  - página do QR: faixa, botão "Fazer check-in e ativar o benefício", axe, nenhum texto de convite antes do check-in;
  - `.ics` com `content-type` `text/calendar`;
  - "Por que esta oferta?" no pacote, com "Como a IA decidiu";
  - varredura de textos cobrindo `/` e a página do QR.

## 8. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Margem bruta lida como ganho (D179) | Rótulo "estimativa, não causal" + frase explícita + camada causal separada; preparado para a entrevista |
| Flags globais quebrando as E2E paralelas | 2 projetos seriais com `globalSetup`; `E2E_FLAGS` em produção |
| `.ics` num dia em que o código não nasce | `nextValidWindow` (emissão + 1, validade) com testes |
| Vazar o convite ao holdout | Link só para convite real; 404 único; nada antes do check-in |
| Prova social falsa | Só check-ins reais, sem e-mails de teste e sem o restaurante E2E |
| Explicação falsa no plano fixo | Textos montados a partir dos dados; o modo "fixo" é declarado |
| Tempo (S5 + S6 até domingo 22h) | Cortes em ordem (§9) |
| Confusão com o iFood na landing (D183) | Barra fixa; risco aceito pelo candidato |

## 9. Fora de escopo e plano de corte
**Fora de escopo:**
- funil "pediu código → confirmou": viável, vira dívida;
- lembrete por e-mail no dia do convite (S6.1);
- mudanças no roteiro da demo (espec. 5, na S7);
- cobrança e preço.

**Cortes, em ordem, se o tempo apertar:**
1. a variante "Faltam N selos";
2. o FAQ com 3 perguntas;
3. a faixa "vale hoje" da Jornada;
4. o feed só com check-in e código validado;
5. a reescrita do corpo do e-mail.

## 10. Perguntas respondidas pelo candidato (21/11, em ordem)
1. **Topo em R$ sem resultado:** 2 camadas (D179).
2. **"Por que esta oferta?":** 2 camadas (D180).
3. **Página do QR:** página de conversão. Depois, "até onde": topo novo + resto do app (D181).
4. **Prova da landing:** números públicos → depois do aviso de que os números do briefing são marcados DADOS FICTÍCIOS, só o número real (D182).
5. **Pós-revisão:**
   - topo: "como aprovado" (mantém a margem; o rótulo vira "convites usados");
   - 63%: frase exata (D182);
   - marca: só a barra (D183);
   - "Quanto custa?": só o benefício (D184).

## 11. Revisão independente do plano (2 subagentes — D95)
**Produto:**

| Achado | Severidade | Destino |
|---|---|---|
| B1. "Voltaram com convite" com 2 sentidos; margem lida como ganho | Bloqueante | Candidato → D179 ajustada (o rótulo mudou; a margem ficou) |
| B2. Textos falsos no plano do exemplo (seed com 1–2 candidatas, `fixo`); "nota" ≠ margem | Bloqueante | [C]: textos a partir dos dados; "nota" descrita como custo perto do ticket |
| I1. `.ics` no dia da emissão | Importante | [C] `nextValidWindow` |
| I2. Landing dizia que a IA propõe o teto | Importante | [C]: texto corrigido (o código decide números) |
| I3. Botão "ganhar {item}" falso com "Leve 2" | Importante | [C]: "ativar o benefício" + "{title}: {item}" |
| I4. FAQ sem resposta; preço | Importante | Candidato → D184; demais respostas [C] |
| I5. Fonte do 63% frágil | Importante | Fonte encontrada (Diário do Rio, 12/11/2026); candidato → D182 com a frase exata |
| I6. Confusão com o iFood | Importante | Candidato → D183 (só a barra) |
| I7. Testes contados como prova | Importante | [C]: filtros |
| I8. Acessibilidade do feed e do painel | Importante | [C] |
| I9. Demo e cortes | Importante | [C]: cortes em §9; demo na S7 |
| M1–M3, M5, M6 | Menor | [C] |
| M4 ("entre" repetido no texto da D162) | Menor | Mantido como aprovado |

**Técnica:**

| Achado | Severidade | Destino |
|---|---|---|
| B1. Dia do código (`decide-checkin.ts:80`) | Bloqueante | [C] `nextValidWindow` |
| B2. E2E com flags globais e `fullyParallel` | Bloqueante | [C]: 2 projetos + `E2E_FLAGS` |
| B3. Domínio importando `MetricView` | Bloqueante | [C]: só tipos de domínio |
| I1. `InviteView` sanitizado | Importante | [C] `agendaUrl` |
| I2. IDOR em `explainOffer` | Importante | [C] `restaurantId` |
| I3. Premissa errada do `planId` no pacote | Importante | [C] |
| I4. "Faltam 0" | Importante | [C]: `motivo` + 2 contadores |
| I5. Filtro do histórico gerado | Importante | [C], explícito |
| I6. Semanas misturadas nas metas | Importante | [C]: semana de validação |
| I7. Flag na rota; volta duplicada | Importante | [C] |
| Menores (RFC 5545, token, `cache`, funil do login, E2E do topo, sem chave local, labels, ordem) | Menor | [C] |

## 12. Itens [C] (D185)
- `early` conta códigos validados.
- Topo e metas incluem o histórico gerado; feed e prova, só linhas reais.
- Metas pela semana de validação; teto de reserva.
- Feed sem a linha duplicada da volta.
- Prova sem e-mails de teste e sem o restaurante E2E.
- Textos da §5 (exceto os de D162, D179, D182–D184).
- `nextValidWindow`, token da agenda e 404 único.
- `agendaUrl` no lugar do id.
- `explainOffer` com `restaurantId` e textos a partir dos dados.
- `update-settings` sem ligação ao plano.
- E2E em 2 projetos + `E2E_FLAGS`.
- O funil do login vira dívida.
- O lembrete fica na S6.1.
- A demo é ajustada na S7.

## 13. Ordem de implementação
0. `recordAiCall` com `planId` + 2 projetos de flags no Playwright.
1. **S5.1:** `value.ts` (TDD) → `early`, metas e feed (integração) → rota → UI → E2E.
2. **S5.2:** `nextValidWindow` + `inviteIcs` (TDD) → rota da agenda + `agendaUrl` → `InviteCard`, Jornada e e-mail → página do QR + prova → landing → "Fontes" → varredura → E2E.
3. **S5.3:** `explainOffer` (integração) → `SidePanel` no plano e no pacote → E2E.

Cada sub-fatia fecha verde e vai em commit + push no branch da sessão.

## 14. Mudanças durante a implementação
(preencher durante a `implementar-fatia`)
