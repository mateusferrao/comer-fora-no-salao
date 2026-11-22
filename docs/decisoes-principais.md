# Decisões principais

O projeto registrou cerca de 320 decisões (D01–D323), todas em [planejamento/decisoes-e-tradeoffs.md](planejamento/decisoes-e-tradeoffs.md), cada uma com alternativas, motivo e quem decidiu. Aqui estão as 18 que definem o produto e a técnica, organizadas para quem tem pouco tempo. Cada uma traz o número (Dxxx) para achar o registro completo.

**Quem decidiu:** "candidato" é o autor do case; "IA [C]" é uma escolha do assistente de IA, aberta a correção, tomada só depois que o planejamento da fatia foi aprovado. Várias decisões abaixo foram tomadas pelo candidato **contra** a recomendação da IA, e outras **mudaram** depois que uma revisão independente achou um problema. As duas coisas estão marcadas.

---

## Produto

### 1. O valor para o dono é encher o horário vazio (D203, D204)
- **Contexto:** a opção do case é "faça o dono do restaurante entrar, divulgar no salão e ter mais retorno com isso". Uma pesquisa pública mostrou que o Comer Fora já tem benefício de 1ª visita, cartela e benefício por dia e turno.
- **Decisão:** o cliente que já está no salão cheio ganha um benefício na hora e, depois do check-in, um **convite para voltar no horário em que sobra mesa**. O salão cheio vira a mídia do horário vazio.
- **Alternativas:** mostrar dinheiro ao dono; "zero trabalho"; conhecer o cliente.
- **Trade-off:** benefício por turno já existe no app. O que é novo é o convite **nascido na mesa**, com teto de custo, e o resultado **medido** contra um grupo de controle.
- **Quem:** candidato, depois de perguntar à IA "qual a grande diferença do que estamos construindo pra aquilo que já existe? Não vai ficar muito igual?". A pergunta levou a um replanejamento do produto inteiro no meio da construção (D201–D224), com pesquisa e 4 revisões independentes.

### 2. A métrica é a volta **a mais**, contra um grupo de controle (D208, D209, D216, D217)
- **Decisão:** 10% dos clientes que poderiam receber convite ficam sem ele (grupo de controle). O painel mostra a diferença de visitas e de margem em R$ entre os dois grupos, com intervalo de 95% e 4 estados (positivo, negativo, "ainda não dá para afirmar", amostra insuficiente).
- **Alternativas:** "voltaram em 30 dias" (conta quem voltaria de qualquer jeito); número simples sem intervalo.
- **Trade-off:** honestidade × um número bonito. Num restaurante, o grupo de controle tem poucas dezenas de clientes; um número sem intervalo seria derrubado por qualquer avaliador técnico. A prova estatística de verdade fica para um piloto com vários restaurantes.
- **Detalhe que importa:** o sorteio só acontece entre quem **poderia** receber convite naquele momento, e o controle ganha um "convite fantasma" invisível com as mesmas datas (intenção de tratar). Sem isso, o sistema comparava "clientes do começo da semana" com "todo mundo" (D216). O candidato pediu uma explicação mais simples antes de decidir, e o exemplo com números entrou no registro.
- **Proteção contra migração:** as visitas **fora** do horário vazio também são comparadas, para ver se o convite só troca o cliente de horário (D208).

### 3. O sistema propõe, o dono aprova (D204, D211)
- **Decisão:** na ativação, o dono manda uma foto do cardápio e marca os horários vazios; o sistema devolve um **pacote pronto** (benefício + convite por horário + teto + custo), e o dono aprova ou ajusta. Toda semana, um **plano** sugere a oferta de cada horário e explica o que funcionou.
- **Alternativa descartada:** um chat de IA como interface principal. O Toqan já é o chat do Portal, e o briefing diz que "uma conversa com IA, sozinha, não é um produto".
- **Trade-off:** menos flexibilidade de conversa × o dono não precisa saber o que pedir.

### 4. O assistente do salão age por proposta, nunca sozinho (D260, D261, D264)
- **Contexto:** depois de recusar o chat (D211), o candidato pediu "um agente em formato de chat… seja bem crítico". A IA apontou o conflito com a decisão anterior.
- **Decisão:** existe um assistente, mas o pedido do dono vira um **cartão "antes → depois"**, com alcance e custo **calculados pelo código**. No Portal, nada muda sem o clique em "Aplicar". A IA nunca escreve número, nem no chat.
- **Alternativas:** aplicar direto o que é reversível, com "desfazer"; onboarding inteiro por chat.
- **Por quê:** resolve a objeção do briefing (não é conversa solta: é uma interface para as mesmas regras das Configurações) e mantém o dono no controle do dinheiro.

### 5. O cliente entra com o próprio e-mail; o avaliador, por um link (D118, D119, D126, D154)
- **Contexto:** a primeira versão tinha uma conta demo compartilhada. O candidato perguntou "por que um terceiro entra na conta de outro?".
- **Decisão:** dono e cliente entram com e-mail real + código de 6 dígitos (AWS SES). Cada conta ganha **a própria cópia** do restaurante de exemplo, com 60 dias de histórico. O avaliador recebe um **link privado** que abre uma conta pronta sem pedir e-mail.
- **Trade-off:** o produto passa a receber dados pessoais reais, contra a regra do case de não **usar** dados pessoais. Mitigação: aceite explícito, e-mail guardado como HMAC e criptografado, "Apagar meus dados" a qualquer hora, nada de contato em log, prompt ou rastro. O risco está declarado em "Como funciona".

### 6. O que ficou de fora, de propósito (80/20)
- **Avaliar, reservas, fila, WhatsApp e push reais, login iFood real** ([especificação §10](planejamento/especificacao.md#10-fora-de-escopo)). O app real já tem a maior parte disso.
- **Prioridade por flags com ordem de corte** (D160, D270): cada recurso novo nasceu atrás de uma flag, e o que não estivesse testado no horário de corte ficaria desligado. O fluxo integral (QR → benefício + convite → validação → volta) foi o 1º da fila; MCP e extras, os últimos.

---

## IA

### 7. O código decide números e dinheiro; a IA escolhe e escreve (D54, D220)
- **Decisão:** preço, custo, teto, sorteio, veredito por oferta e resultado são calculados pelo código. A IA escolhe entre ofertas que o código já validou, escreve com **referências** (`{prato}`, `{horario}`, `{fato}`) e explica o veredito que o código calculou.
- **Alternativa descartada:** proibir dígitos na saída da IA. Uma revisão mostrou que isso bloqueava "Pizza 4 queijos" e deixava passar "metade do preço" (D54).
- **Detalhes:** [ia-no-produto.md](ia-no-produto.md).

### 8. Um modelo por tarefa, escolhido por avaliação (D51, D52, D53)
- **Decisão:** cada tarefa (cardápio, pacote e plano, kit, revisor, assistente) tem o modelo que venceu uma mini-avaliação, e uma reserva **de outro provedor**. Tudo pelo OpenRouter, com o laço de reserva no nosso código.
- **Alternativas:** um modelo só; escolher por reputação sem medir; uma chave por provedor.
- **Trade-off:** ~5,5% de taxa no OpenRouter × uma chave só, troca de modelo sem mudar código e reserva entre provedores.
- **Conflito declarado:** o assistente que construiu o projeto (Claude) é um dos candidatos. Ele declarou o conflito, o Claude Haiku concorreu e não venceu, e o juiz das avaliações é de um provedor que não concorre (Moonshot).

### 9. OCR foi medido, não suposto (D128)
- **Contexto:** o candidato perguntou "e se tentarmos OCR primeiro, com IA de reserva?".
- **Decisão:** medir. Três linhas de base de OCR entraram na avaliação T1. Os 5 melhores modelos de visão tiveram nota 0,98–1,00 (os 7: 0,83–1,00); OCR + regras, 0,42–0,46; OCR + IA de texto, 0,73.
- **Por quê:** o difícil num cardápio não é ler as letras, é juntar item, preço e seção em duas colunas, foto torta ou letra de mão.

### 10. Sem LangChain nem LangGraph (D215)
- **Contexto:** o candidato pediu "seja crítico".
- **Decisão:** as tarefas são chamadas com schema, e o humano no meio é um estado no banco (proposto → aprovado). Uma camada própria pequena dá controle do laço de reserva, dos guardrails e do rastro, sem mais uma dependência.
- **O que mudaria a decisão:** um fluxo longo, com várias etapas e estado entre elas.

### 11. O plano da semana roda como agente, por decisão do candidato (D159, D225, D226)
- **Regra combinada antes:** ligar o agente só se, contra a chamada única, ele passasse nas regras em ≥ 90%, com p50 ≤ 20 s e sem perder no juiz cego.
- **O que aconteceu:**
  - **1ª rodada:** o agente passou nas regras em 10/10 contra 5/10, mas perdeu no juiz.
  - **Decisão do candidato:** ligar mesmo assim, pela confiabilidade, com a chamada única de reserva. Foi **contra a própria regra**, e o registro diz isso.
  - **Correção:** o juiz criticava convites sem dia e horário; o candidato perguntou "e se adicionarmos teste determinístico?", e isso virou regra do código (D226).
  - **3ª rodada:** os dois modos chegaram a 10/10, e o juiz preferiu o agente em 6 de 10 pares (sem significância).
- **Trade-off honesto:** ~6,5× o custo e ~3,8× a latência por uma vantagem pequena. A alternativa barata (chamada única com uma rodada de reparo) fica registrada.

### 12. A IA vê o primeiro nome dos clientes, nunca o contato (D262, D268)
- **Histórico:**
  - o candidato queria que o modelo visse tudo;
  - a revisão de produto mostrou que a página "Como funciona" ficaria falsa, que o aceite do cliente não cobre provedores de IA, que o rastro gravaria os turnos e que nenhuma ação precisava de contato.
- **Decisão:** "nome sim, contato não". O assistente e o MCP recebem primeiro nome + inicial e atributos, por apelido. O rastro do assistente não grava a conversa.
- **Quem:** candidato, depois da revisão.

### 13. O assistente recusa o que não é do restaurante (D277, D286)
- **Pedido do candidato:** o agente não pode "escrever um poema", por segurança.
- **Decisão:** a IA classifica o pedido e, fora do escopo, a recusa é um texto fixo do código. Um portão determinístico limita tamanho e formato e exige uma âncora no produto.
- **A revisão de segurança quebrou a 1ª versão:** 8 textos fora do escopo passavam. O portão foi refeito, e o texto da decisão foi corrigido para dizer o limite verdadeiro: o portão garante formato e âncora, **não** o assunto.

---

## Plataforma e operação

### 14. O sistema é operável por agentes (MCP) — com um risco aceito (D212, D219, D267, D269)
- **Decisão:** um servidor MCP expõe as mesmas operações do Portal a agentes externos (Claude, ChatGPT), com o token do dono vinculado a um restaurante. Ele lê números e plano, e pode **propor e aplicar** mudanças e **aprovar o plano**.
- **Contra a recomendação da IA:** a IA recomendou que o MCP só lesse e propusesse, deixando a aprovação no Portal. O candidato escolheu permitir aprovar e aplicar.
- **Trade-off:** demonstra o "AI-operable" (sistemas que agentes operam) × abre um caminho de dinheiro sem clique no Portal. Mitigação: token com hash, revogável e por restaurante; registro "via agente"; flags `mcp_edicao` e `mcp_clientes` desligáveis.
- **Catálogo único (D267):** o assistente do Portal e o MCP usam o **mesmo** catálogo de ferramentas, então uma regra nova vale para os dois.

### 15. Monólito modular, regras puras e fronteiras conferidas no CI ([arquitetura.md](arquitetura.md))
- **Decisão:** Next.js + Postgres num deploy só; domínio em funções puras que não importam banco, IA nem framework, conferido no CI.
- **Descartado:** microsserviços, filas, CQRS. Ficam para a escala, no roadmap.
- **Por quê:** num protótipo de dias, as regras (sorteio, teto, convite congelado, incremento) precisam de testes rápidos e confiáveis. O simulador usa **as mesmas funções** do produto, então o restaurante de exemplo testa as regras reais.

### 16. Deploy só com CI verde e E2E contra produção (D91, D101, D293)
- Todo push na `main` passa por checagens, testes unitários e de integração, E2E com Playwright e acessibilidade (axe). Só então o deploy é disparado, e uma fumaça E2E roda **contra produção**.
- As contas de teste em produção rodam sem IA, para não gastar a chave pública dos avaliadores (D293).

### 17. Simulação declarada, sem esconder o que é gerado (D146, D152, D162)
- O restaurante de exemplo tem 60 dias de histórico **gerado** com efeito programado de +0,2 visita por cliente convidado, e isso está escrito na tela ("Restaurante de exemplo · histórico gerado") e em "Como funciona".
- **A semente foi escolhida** entre as que dão resultado positivo com o efeito programado dentro do intervalo (D146), e a robustez foi medida em 20 sementes × 7 dias da semana: intervalo acima de zero em 132 de 140 combinações. Isso testa **a medida**, não o efeito real; o efeito real só um piloto mede.

---

## Processo

### 18. Toda fatia com planejamento por perguntas e revisão independente (D05, D95)
- Cada fatia (S0–S9, S7) começou com a IA lendo tudo e fazendo perguntas, uma por vez, com opções, trade-offs e recomendação. O candidato decidia.
- **Antes de aprovar qualquer plano, 2 subagentes independentes** (técnico e produto) revisam sem ver a conversa. Essa regra foi **pedida pelo candidato** depois que ele se recusou a aprovar o plano da S0 sem revisão (D95). Na S0, a revisão achou 5 bloqueantes e 2 decisões de design baseadas em premissas erradas da IA.
- Depois de implementar, 4 revisores + E2E profunda pela própria IA. Detalhes em [processo-com-ia.md](processo-com-ia.md).

---

## Como ler o restante
- Registro completo: [decisoes-e-tradeoffs.md](planejamento/decisoes-e-tradeoffs.md) (seções A–P, por fatia).
- Especificação (fonte única do produto e da técnica): [especificacao.md](planejamento/especificacao.md).
- Glossário e ordem de leitura: [docs/README.md](README.md).
