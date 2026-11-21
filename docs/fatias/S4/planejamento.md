# Replanejamento de 21/11 — Produto real e valor ao dono (fatias S4, S5, S6; entregáveis viram S7)

Status: ✅ aprovado em 21/11/2026 pelo candidato (planejamento conjunto das fatias S4, S5 e S6; este documento é a fonte das três).

**Novo fatiamento** (pedido do candidato: a antiga S4 de entregáveis vai para o fim e as fatias novas entram na frente):

| Fatia | Nome | Conteúdo (sub-fatias da seção 9b) | Flag |
|---|---|---|---|
| **S4** | Produto real e identidade | S4.1 base de dados e identidade · S4.2 login do cliente · S4.3 limpeza + Ferramentas do avaliador · S4.4 reativação entregue | Sem flag (núcleo) |
| **S5** | Valor e conversão | S5.1 painel em R$ + meta + "Hoje no salão" · S5.2 landing, página do QR e convite com agenda · S5.3 "Por que esta oferta?" | Com flag |
| **S6** | IA que opera | S6.1 ciclo semanal por e-mail + agendador · S6.2 modo garçom · S6.3 plano como agente · S6.4 porta-conta | Com flag |
| **S7** | Entregáveis (era a S4) | Slide PPTX, vídeo de telas reais (D157), repositório público limpo, preparação da entrevista; segunda 10h–15h | — |

Como fica a execução:
- **Planejamento:** um documento por fatia, `docs/fatias/{S4,S5,S6}/planejamento.md`, todos gerados deste plano e aprovados juntos agora.
- **Revisão e merge:** por D167 (1 merge no fim), S4 a S6 passam por uma revisão (4 revisores + E2E) e **um merge** depois da S6, com meta antes de segunda 08:30.
- **Corte:** a ordem das fatias é a ordem de corte. O que da S5/S6 não estiver pronto no domingo às 22h fica desligado por flag.
- **S7:** planejada com `planejar-fatia` na segunda de manhã.
- **CLAUDE.md:** a menção "S0–S4" vira "S0–S7".

## 1. Contexto e objetivo
O candidato pediu duas coisas:
- um replanejamento com foco em **valor para o dono** e em **conversão de clientes**, usando a skill de copywriting;
- tirar do produto tudo que o apresenta como teste ou simulação. Só a barra de protótipo do cabeçalho fica.

A análise crítica, que o candidato aceitou, encontrou três problemas:
- **A inovação não aparece.** O diferencial está nas regras (grupo de controle, convite invisível para quem está nele, teto) e só é explicado em "Como funciona".
- **O resultado parece programado.** O painel mostra um efeito simulado, e o restaurante que o avaliador cria fica vazio sem "Simular".
- **A técnica está escondida** nos Bastidores.

Ao fim da fatia:
- o produto se comporta como solução real;
- o resultado aparece em reais e ao vivo;
- a IA aparece trabalhando: explica a escolha, investiga como agente e opera o ciclo semanal por e-mail;
- as páginas do dono e do cliente têm copy de conversão.

**Prazo (decidido pelo candidato).** Construção até **segunda 23/11 às 10h**, com a meta de merge antes das 08:30 (D168). **Corte no domingo às 22h:** o que não estiver pronto e testado fica desligado por flag. A S7 (entregáveis) vai de segunda 10h às 15h (congelamento).

## 2. Decisões do candidato nesta rodada (registrar como D151–D160)
| ID | Decisão | Alternativas recusadas |
|---|---|---|
| D151 | Fatias novas S4–S6 até segunda 10h; entregáveis (antiga S4) viram a S7, a última | Fatia até domingo 18h (recomendado); só limpeza + landing |
| D152 | **Sistema real só com seed.** A cópia da Cantina aparece sem rótulo de demonstração ou simulação. O restaurante criado é real e começa vazio, com "Primeiros passos". Saem do produto "Simular 30 dias", "Limpar simulação", "Antecipar 1 dia", "Importar do delivery (simulado)" e o motivo do grupo de controle mostrado ao cliente | Manter "Simular", renomeado |
| D153 | "Avançar 1 dia" vai para os **Bastidores** (ferramenta do avaliador) | Tirar de vez; regra "voltar hoje" |
| D154 | **Cliente entra com nome, telefone e e-mail + código de 6 dígitos por e-mail** (SES). Dados digitados livremente, **sem pré-preenchimento fictício**. Risco aceito: dado pessoal real (D118 já aceitava isso para o dono) | Degraus (recomendado); só telefone; pré-preenchido realista |
| D155 | Reativação **entregue de verdade**: na Jornada do cliente ("Seus convites", com aviso de novo) e por e-mail para quem tem consentimento | Só tirar "(simulado)" |
| D156 | Atalhos: fica só "Como funciona" na barra. Saem o roteiro da entrada, "Trocar de lado" e "Testar como outro cliente" (vira "Sair" real na Jornada) | Manter "Trocar de lado" |
| D157 | Vídeo da S7 com **telas reais** gravadas por roteiro automatizado (Playwright), com legendas e narração por IA | Vídeo gerado por IA; sem vídeo |
| D158 | Apostas: **ciclo semanal por e-mail com Aprovar**, **plano como agente com ferramentas** e **"Por que esta oferta?"**. O kit ampliado fica só no porta-conta | Arte do kit por IA |
| D159 | Agente decidido **por número**: T3 refeita com código + juiz cego (5 casos de teste × 2), agente contra chamada única no mesmo modelo. O agente vira padrão se tiver regras ok ≥ 90%, p50 ≤ 20 s e nota do juiz ≥ à da chamada única; senão fica atrás de flag desligada | Ligar sem medir; medir + nota cega |
| D160 | Ordem de corte: (1) limpeza + login do cliente + reativação entregue + Bastidores; (2) painel em R$ + meta + atividade ao vivo; (3) página do QR, convite com agenda, landing; (4) "Por que esta oferta?"; (5) ciclo semanal por e-mail; (6) modo garçom; (7) plano como agente; (8) porta-conta | Inovação antes da conversão |

### Decisões depois da revisão de produto (candidato, 21/11)
| ID | Decisão | Alternativas recusadas |
|---|---|---|
| D161 | **Login completo no check-in** (nome, telefone, e-mail + código), com **uma linha de consentimento** ("Protótipo de case, não é o iFood. Seus dados são apagados em 7 dias"), **retenção de 7 dias** e "Apagar meus dados" na Jornada. Na demo, o aparelho do cliente é logado na véspera (cookie de 180 dias) | E-mail só para guardar o convite (recomendado); login sem aviso |
| D162 | A Cantina ganha o selo **"Restaurante de exemplo · histórico gerado"** (link para "Como funciona"). O restaurante criado não tem selo. O título do topo diz "R$ X a mais em margem entre N convidados até agora", não "em 30 dias" (a margem soma todas as janelas fechadas) | Sem rótulo |
| D163 | **Tudo por e-mail:** resumo semanal do dono com "Revisar e aprovar" + convite, lembrete e reativação por e-mail aos clientes com consentimento. Reabre a mitigação de D118 ("e-mail sem logo e sem link"), com risco aceito pelo candidato. Os e-mails saem em texto simples, sem logo, com links só para o nosso domínio, e a aprovação é um POST na página | Só o resumo do dono (recomendado); sem agendador |
| D164 | Rodapé "Protótipo de case · não é produto oficial do iFood" no impresso e no e-mail. A barra perde "dados fictícios" e vira "Protótipo de case · não é produto oficial do iFood" | — |
| D165 | **Consentimento continua ligado por padrão** (como na especificação e no app). O candidato não aprovou a troca para desmarcado. Risco LGPD com dado real registrado, e declarado em "Como funciona" | Desmarcado (proposto pela IA) |
| D166 | O plano como agente (P7) **reabre a D215** (que tinha recusado o agente com ferramentas) por escolha do candidato (D158), com as defesas da D215: ferramentas só de leitura sobre fatos já agregados (sem texto livre do cardápio nem PII), saída final presa às candidatas e decisão por número (D159) | Cortar P7 (revisor de produto) |

### Decisões depois da revisão técnica (candidato, 21/11)
| ID | Decisão | Alternativas recusadas |
|---|---|---|
| D167 | **1 merge no fim** (mantém D12/D136), mesmo com a P1 sem flag | 2 merges, o 1º no sábado (recomendado) |
| D168 | **E-mails por evento + agendador.** Por evento: convite ao cliente quando nasce, reativação ao aprovar e "Enviar agora". Agendador: resumo do dono toda segunda às 08:30 e lembrete na manhã do dia do convite. **Meta: merge antes de segunda às 08:30**, para o 1º envio automático acontecer no dia 23. Agendador com regra de recuperação: se passou da hora e não há registro, envia | Só por evento (recomendado) |

## Correções da revisão técnica aceitas como [C]
Detalhe técnico, sem mudar produto:
- **B1 · E-mail do dono:** `owners.email_enc` (AES-GCM), gravado no próximo login. Muda a D118 ("e-mail nunca gravado"), consequência da D163. Contas antigas e as do link do avaliador ficam só com a prévia.
- **B2 · Identidade do cliente:**
  - o e-mail vira a chave (`email_hmac` único, com finalidade `cliente-email:`);
  - a 0006 troca a unicidade do telefone por um índice comum (declarado como não aditivo);
  - regra de vínculo: e-mail novo + telefone existente + mesmo nome → vincula; nome diferente → erro;
  - o prefixo do cookie do cliente muda, para forçar novo login.
- **B3 · E2E:**
  - login de cliente na E2E pelo padrão da D123 (`e2e-cliente+N@exemplo.invalid` + token, código na resposta); um único teste passa pelo simulador do SES;
  - nova ferramenta do avaliador "Ver como cliente reativado" (entra como um cliente do seed da cópia do próprio dono), que serve à E2E e à demo da reativação.
- **B4 · Dados de produção:**
  - UPDATE na 0006 da descrição, do endereço e dos sobrenomes das cópias existentes;
  - no boot, `clearRun` de toda rodada `botao` ("Simular" antigo).
- **B5 · Saída de emergência:** flag `login_cliente_email`, que volta para nome + telefone sem código se o SES falhar. Aparelhos da demo logados na segunda de manhã. `PRESENTER_EMAILS` fora do limite global.
- **I1 · Gateway com ferramentas:**
  - `tools`, `stopWhen` e `prepareStep` opcionais no gateway, com o último passo forçando `toolChoice:'none'`;
  - `steps` devolvidos para `agent_steps`; custo somado de todos os passos; tempo próprio para o agente;
  - ferramentas puras sobre os fatos (o `eval` reaproveita); nome `ler_insights` como no MCP;
  - **teste de 15 min do provedor** (ferramentas + saída estruturada no Gemini 3.8 Flash) antes da P7.
- **I2 · Agendador (D168):**
  - linha `weekly_digests` com estados `reservado` → `enviado` e retomada do que ficou parado;
  - espera pelo revisor antes de montar o e-mail;
  - não envia para `.invalid` nem para o simulador;
  - aprovação pelo e-mail atualiza `lastSeenAt`.
- **I3 · Aprovação pelo e-mail:**
  - `via: "email"` em `approvePlan`, com o `final` montado a partir do proposto;
  - token amarrado ao `plan_id`, gasto só se aprovar deu certo;
  - `rejectCrossSite`;
  - `Referrer-Policy: no-referrer` nessa página e no link do garçom; o token do garçom vira cookie no 1º acesso.
- **I4 · Reativação por e-mail:**
  - `optApp=true` para clientes novos;
  - e-mails enviados depois do commit;
  - formato do e-mail validado e teto diário de envios.
- **I5 · Especificação v3** cita as decisões que caem ou mudam: D22, D30, D31, D118, D140, D141, D143, "PII fictícia" (4.6) e os itens 1 e 7 do Review Focus. No ensaio, usar endereços com "+".
- **I6 · Topo em R$:** sem "últimos 30 dias"; texto dos 4 estados conforme §3.
- **I7 · Medição do agente:**
  - o juiz compara agente × chamada única **em pares cegos**;
  - o critério da D159 fica declarado como indicativo (n pequeno);
  - teto diário da chave pública revisto para caber o agente e o resumo.
- **I8 · Varredura de textos:** feita pelo Playwright sobre o texto renderizado, numa lista de rotas, excluindo a barra, os Bastidores e os rodapés. Não varre o código-fonte.
- **Menores:**
  - DROP + ADD de `kit_pieces_kind_check` para o `porta_conta`;
  - `CUSTOMER_EMAIL_KEY` no CI, no Playwright, no Easypanel e no health, com 32 bytes validados no boot;
  - limite por e-mail e global no login do cliente (o IP do Wi-Fi do salão é compartilhado);
  - "Avançar 1 dia" só em convites sem `simulation_run_id`;
  - `como-funciona` sem importar `simulate-test`;
  - .ics em UTC.
- **E2E e testes a reescrever:**
  - `volta.spec` inteiro;
  - `cliente.spec`, `dono.spec`, `painel.spec`, `entrada.spec`;
  - `teste-restaurante.test.ts`, `checkin.test.ts:181-197`, `salao/misc.test.ts:59`.

## 3. Itens [C] (decisão da IA, corrigível)
- **E-mail do cliente:**
  - guardado como HMAC (para busca) e criptografado com AES-256-GCM (para envio), com a chave `CUSTOMER_EMAIL_KEY` em variável de ambiente;
  - apagado depois de 7 dias sem visita (D161), junto com o nome e o telefone;
  - nunca entra em log, prompt, MCP ou rastro.
  - O telefone continua como HMAC + 4 dígitos.
- **Nome do cliente** aparece para o dono só como primeiro nome + inicial.
- **.ics:** um evento no próximo dia válido, com "válido até dd/mm" na descrição. Sem recorrência, para não criar ~13 entradas na agenda.
- **Topo em R$, os 4 estados:**
  - positivo: "R$ X a mais";
  - inconclusivo: "ainda não dá para afirmar";
  - negativo: "o convite não está trazendo retorno · veja o plano";
  - amostra insuficiente: "ainda medindo".
- **A landing mantém o link "Veja o que seu cliente vê"**, que abre a página da Cantina. O "Por quê?" do "Importar do delivery" vira uma pergunta do FAQ.
- **Ferramentas do avaliador:**
  - o roteiro "Como testar sozinho" fica na página privada do link de avaliação (`/parceiro/acesso/<token>`) e em "Primeiros passos";
  - "Avançar 1 dia" libera o convite fora da faixa com o rótulo neutro "liberado hoje pelas ferramentas do avaliador".
- **Prova social na página do QR:** "N check-ins aqui nos últimos 7 dias", só com N ≥ 5. Abaixo disso não aparece, porque um número pequeno afasta mais do que convence.
- **Sessão do cliente:** cookie assinado de 180 dias; o código é pedido só no 1º acesso do aparelho. Código de 6 dígitos com validade de 10 min e 5 tentativas. Limites por e-mail, por IP e global. O endereço do simulador do SES fica para a E2E, como no login do dono (D123).
- **Enums internos ficam** (`kind='teste'`, `simulation_runs`, `channel='crm_simulado'`, que vira `app_email` em linhas novas). Só os textos da interface mudam, sem migração arriscada. Slugs novos saem do nome (`pizzaria-do-joao-3f2a`), não mais `teste-xxxx`.
- **Peças impressas e e-mails mantêm 1 linha discreta "Protótipo de case · não é produto oficial do iFood".** O papel e o e-mail saem do site levando a marca iFood, pela mesma razão da barra do cabeçalho. Exceção ao pedido "só no cabeçalho", destacada para o candidato corrigir.
- **Seed:**
  - os sobrenomes "Fictício/Teste/Simulado" do gerador viram 6 sobrenomes comuns. A lista tem o mesmo tamanho, então a sequência do gerador e o teste do IC da semente 20261157 não mudam;
  - a descrição e o endereço da Cantina ficam realistas e neutros;
  - `SEED_VERSION` 4, para recriar a vitrine e as cópias.
- **Assistente:** sai "Importar do delivery". Fica "Usar um cardápio de exemplo" (dado de amostra é comum em produto real), sem "(fictício)" nem "processado anteriormente". Entra o campo opcional "Endereço"; sem ele, "Endereço não informado".
- **"Como funciona"** (Bastidores) continua dizendo o que é seed e simulação e quais são os parâmetros, e ganha "Ferramentas do avaliador": Avançar 1 dia e roteiro.

## 4. Produto e fluxos (por prioridade)

### P1 — Limpeza e produto real
- Tirar ou reescrever cada item (a)/(b)/(c) do inventário. Telas: entrada, login, acesso, Visão geral, `DemoStatus`, `TestGuide`, Dashboard, `storeLabel`, assistente, Plano e histórico, Clientes, Configurações, Validar, página do cliente, check-in, Jornada, `not-found`, `BottomSheet`, descrição do MCP.
- O que sai:
  - `TestGuide`, `TestAdvance`, `testNote`, as rotas `api/parceiro/simular/*` e `api/cliente/convite/antecipar`;
  - o adaptador `delivery-import-simulated`;
  - `fictitious-identity` (o pré-preenchimento).
- **"Primeiros passos"** no restaurante novo, em vez do roteiro de teste. Uma checklist real que se marca sozinha pelos eventos: Kit impresso/no salão → 1º check-in → 1º código validado → 1º plano aprovado.
- **"Ver minha página"** no Portal (abre `/r/<slug>`), e QR do kit, como caminhos reais para o lado do cliente.
- **Bastidores › Ferramentas do avaliador:**
  - "Avançar 1 dia": exige sessão do dono e age só nos restaurantes dele. Reaproveita `advance-invite.ts`, aplicado aos convites ativos do restaurante escolhido.
  - O roteiro "Como testar sozinho" muda para cá.
- **Login do cliente (D154, D161):** o check-in pede nome, telefone, e-mail, o consentimento (ligado por padrão, D165) e a linha "Protótipo de case, não é o iFood. Seus dados são apagados em 7 dias" → "Enviamos um código para a***@g***.com" → código → check-in. Reaproveita o desenho de `contas` (`login-code.ts`, `hmacEmail`, `hmacLoginCode`, `mail-sender`) num caso de uso novo `salao/application/customer-login.ts`. A Jornada ganha "Sair".
- **Reativação entregue (D155):**
  - cria `customer_messages` (convite entregue no app; lido/não lido);
  - envia e-mail com convite + .ics para quem consentiu;
  - texto do dono: "Enviado para N clientes no app Comer Fora · M também por e-mail";
  - o grupo de controle continua com o convite invisível (nada é entregue).

### P2 — Painel em reais, meta e atividade ao vivo
- **Topo da Visão geral:** "**R$ X a mais em margem entre N convidados até agora** (estimativa: entre R$ a e R$ b)", vindo da margem incremental já calculada (espec. 2), em 4 estados.
  - Sem ticket ou margem declarados: mostra visitas, com o link "informe ticket e margem para ver em reais".
  - Amostra insuficiente: "Ainda medindo · faltam ~N clientes por grupo" e os indicadores antecipados.
- **Meta:** por faixa, as "mesas a mais por semana" declaradas × os convites usados na faixa por semana (rótulo "convites usados · não causal").
- **"Hoje no salão":** feed ao vivo (a mesma consulta de ~3 s) com check-ins, códigos validados, convites emitidos e "cliente no grupo de controle · sem convite (mede o efeito)". O grupo de controle só aparece para o dono e substitui o motivo que antes aparecia ao cliente.

### P3 — Conversão (skill de copywriting)
Diagnóstico **B**: já há uma voz e um ângulo ("Seu salão cheio divulga seu horário vazio"), que ficam. Corrigir o lide enterrado, as linhas vagas e os vícios de texto de IA.
- **Landing (`/`)**, falando com o dono:
  - herói: dor → visão → caminho;
  - 3 passos: Foto do cardápio → Kit no salão → Clientes voltam no horário vazio;
  - "o que você vê toda semana" (painel em R$ e plano);
  - prova: números do restaurante de exemplo, rotulados como exemplo;
  - objeções em FAQ: custo do benefício com teto, os dados são do restaurante, quanto tempo leva;
  - CTA único "Ativar meu salão" (+ "Já tenho conta").
  - Sem número inventado. Gargalos de prova marcados `[NEED: …]` na revisão de copy.
  - Os títulos e os CTAs saem da skill (2–3 opções para cada) e são escolhidos pela autoverificação do texto (vícios de IA, "Now you can", teste de troca).
- **Página do QR:**
  - topo com o ganho concreto ("Ganhe {item} hoje");
  - um botão "Fazer check-in e ganhar";
  - prova real: "N check-ins aqui nos últimos 7 dias", só quando N ≥ 5;
  - "+ convite para voltar" mantido genérico, para não contaminar o grupo de controle.
- **Convite que traz de volta:**
  - "Adicionar à agenda", com um .ics real (dias da faixa, até a validade);
  - na Jornada, "Seu convite vale hoje" no dia válido;
  - e-mail de lembrete na manhã do 1º dia válido, só para quem consentiu (o mesmo agendador de P5).

### P4 — "Por que esta oferta?"
No plano e no pacote, uma gaveta por faixa com:
- as candidatas, a pontuação do código e os critérios;
- a escolhida pela IA;
- os fatos citados, resolvidos;
- os guardrails que passaram;
- o veredito do revisor;
- o modelo, a reserva usada, o custo e a latência (`ai_calls`);
- no modo agente, os passos do agente.

Só leitura de dados que já existem.

### P5 — Ciclo semanal por e-mail
- **Quando:** toda segunda às 08:30 de SP, um agendador no processo (intervalo em `instrumentation.ts`, idempotente por restaurante e semana numa tabela `weekly_digests` com chave única).
- **Para quem:** cada restaurante ativo de conta com e-mail.
- **O que faz:** gera o plano (se não houver) e envia o resumo: R$/visitas da semana, a meta, o plano proposto em linguagem de dono e o botão **"Revisar e aprovar"**.
- **O link:** token assinado de uso único e validade de 7 dias. Ele abre uma página de confirmação com o botão "Aprovar" (POST), para que scanners de e-mail que fazem GET não aprovem. A aprovação fica registrada como "via e-mail". O revisor bloqueou → o e-mail diz "precisa da sua revisão no Portal".
- **No Portal:** "Ver o e-mail desta semana" (prévia, para todos, inclusive quem entrou pelo link do avaliador) e "Enviar agora" (contas com e-mail).

### P6 — Modo garçom
- Em Configurações: "Link do garçom", com token por restaurante (hash, revogável, como o do MCP).
- Abre só "Validar código", sem expor o resto do Portal, e funciona no celular (adicionar à tela inicial).

### P7 — Plano como agente com ferramentas (D159)
- **Laço:** AI SDK 7 com ferramentas somente leitura, que são funções puras sobre fatos já calculados: `ver_insights`, `listar_candidatas(faixa)`, `custo_estimado(candidata)`, `semana_anterior(oferta)`. Limite de 6 passos e orçamento de tempo.
- **Saída final:** o mesmo schema da tarefa 3 (só ids de candidatas e referências), o mesmo guard e o mesmo revisor.
- **Rastro:** os passos ficam em `weekly_plans.agent_steps` e no Langfuse, e aparecem em P4.
- **Medição:** `eval/run-t3.ts --modo agente`, com relatório em `eval/relatorio-t3-agente.md`.
- **Flag:** `plano_agente`.

### P8 — Porta-conta
- Peça nova no kit, no tamanho de um porta-conta (~10×20 cm), com QR por versão.
- Chamada da IA para o momento de pagar: "ganhe {beneficio} agora: faça check-in antes de sair".

## 5. Técnica (arquivos principais)
- **Dados:** migração aditiva `0006`.
  - `customer_contacts`: `email_hmac` (único) e `email_enc`;
  - `customer_login_codes`;
  - `restaurant_customers.email_optin`;
  - `customer_messages`;
  - `weekly_digests` + `digest_tokens` (hash, `used_at`);
  - `waiter_tokens`;
  - `weekly_plans.agent_steps` (jsonb);
  - `restaurants.address` editável;
  - `kit_pieces`: tipo `porta_conta`.
- **Reaproveitar:**
  - `src/shared/crypto.ts` (`hmacEmail`, `signValue`/`verifySigned`, `safeEqual`);
  - `src/modules/contas/{domain/login-code,adapters/mail-*}`;
  - `src/web/customer-session.ts`;
  - `planos/application/{generate-plan,approve-plan,insights}.ts`;
  - `analytics` (margem incremental, estados);
  - `mcp/tokens.ts` (padrão do token com hash), para o garçom e o resumo;
  - `ia/runTask` (laço de reserva, guards e Zod), que ganha um modo com ferramentas.
- **Novos:**
  - `salao/application/customer-login.ts`;
  - `planos/application/{weekly-digest,digest-approve}.ts`;
  - `planos/application/deliver-reactivation.ts`;
  - `ia/tasks/plan-agent.ts`;
  - `app/api/cliente/{entrar,confirmar,sair,agenda}`;
  - `app/parceiro/aprovar/[token]`;
  - `app/garcom/[token]`;
  - `app/bastidores/avaliador`.
- **Agendador:** `src/shared/scheduler.ts` (intervalo de 60 s, trava por linha no banco, para no SIGTERM).
- **Segurança:**
  - todos os tokens com hash e comparação em tempo constante;
  - aprovação por POST com CSRF (mesma origem);
  - limites de uso em entrar/confirmar/aprovar;
  - e-mail sem PII além do necessário;
  - fronteiras (dependency-cruiser) mantidas.

## 6. Testes
- **Unidade e integração (TDD):**
  - login do cliente (código certo, errado, expirado, 5 tentativas, limites, e-mail já existente reconhece o cliente);
  - criptografia ida e volta do e-mail;
  - reativação entregue (só para convidáveis, com consentimento no e-mail; o grupo de controle não recebe nada);
  - .ics (dias, faixa, validade, fuso SP);
  - resumo idempotente por semana;
  - token de aprovação (uso único, expirado, GET não aprova);
  - token do garçom (só Validar, revogado);
  - agente (respeita o limite de passos; uma saída fora das candidatas é reprovada pelo guard; modo sem IA);
  - "Primeiros passos" derivados dos eventos;
  - feed do dia;
  - estados do topo em R$;
  - o IC da semente 20261157 continua positivo com o `SEED_VERSION` 4.
- **Varredura:** um teste falha se aparecerem "simulad", "fictíci", "de teste", "Para testar", "demonstração" ou "Só no teste" fora dos Bastidores, da barra e do rodapé do impresso/e-mail.
- **E2E local e em produção (atualizar as existentes que usavam Antecipar, Simular e o pré-preenchido):**
  - dono cria restaurante → ativa → kit → "Ver minha página" → cliente entra por e-mail (endereço do simulador do SES + token de E2E) → check-in → código → garçom valida pelo link do garçom → feed e Primeiros passos atualizam → Bastidores "Avançar 1 dia" → volta com o código do convite;
  - Cantina: topo em R$, plano com "Por que esta oferta?" → aprovar → reativação aparece na Jornada de um cliente;
  - página de aprovação por e-mail (GET não aprova; POST aprova uma vez);
  - landing e página do QR com axe e alvos ≥ 44 px.

## 7. Riscos
| Risco | Mitigação |
|---|---|
| Escopo de ~38 h | Ordem de corte D160, flags, corte domingo 22h |
| Atrito do código por e-mail derruba o funil | Cookie de 180 dias; e-mail chega em segundos (SES); funil mede "pediu código → confirmou" |
| SES falhar no dia | Preflight; mensagem clara; E2E com o simulador do SES |
| Dado pessoal real de clientes | Criptografia + HMAC, apagado em 7 dias, linha de consentimento, fora de log e prompt; declarado em "Como funciona" (D161, D165) |
| Scanner de e-mail aprova plano | Aprovação só por POST na página de confirmação |
| Agente lento ou pior | D159: só vira padrão se ganhar na medida |
| Copy com promessa sem prova | Skill de copy: alegação só com dado do sistema; `[NEED]` vira pergunta |
| Tirar "simulado" esconde que os dados de exemplo são simulados | Selo "Restaurante de exemplo · histórico gerado" (D162) + "Como funciona" + slide e entrevista |

## 8. Fora de escopo
WhatsApp/push real, arte gerada por IA, "traga um amigo", adesivo de porta e post de Instagram (cortados por D158), login iFood real.

## 9b. Sub-fatias testáveis por fatia (ordem de execução = ordem de corte D160)

**S4 — Produto real e identidade:** S4.1–S4.4 · **S5 — Valor e conversão:** S5.1–S5.3 · **S6 — IA que opera:** S6.1–S6.4.
Cada sub-fatia termina **verde** antes da próxima:
- testes da sub-fatia;
- `npx tsc --noEmit`, lint e `check:boundaries`;
- commit + push no branch da sessão.

As sub-fatias da S4 (sem flag) são o núcleo: se uma não fechar, as seguintes esperam. As da S5 e S6 (com flag) podem ser desligadas no corte (domingo 22h). Merge único no fim (D167), com meta antes de segunda 08:30 (D168).

### S4.1 Base de dados e identidade (sem flag) · ~3 h
- **Entrega:**
  - migração `0006` com:
    - `customer_contacts.email_hmac` (único) e `email_enc`;
    - telefone com índice comum;
    - `customer_login_codes`, `customer_messages`;
    - `weekly_digests` + `digest_tokens`, `waiter_tokens`;
    - `owners.email_enc`, `weekly_plans.agent_steps`, `restaurants.address`;
    - `kit_pieces_kind_check` com `porta_conta`;
    - UPDATE das cópias existentes (descrição, endereço, sobrenomes);
  - `src/shared/crypto.ts`: `encryptEmail`/`decryptEmail` (AES-256-GCM) e `hmacCustomerEmail` (`cliente-email:`);
  - `CUSTOMER_EMAIL_KEY` validada no boot e no health, e presente no CI e no Playwright.
- **Testes:**
  - unidade: criptografia ida e volta; chave inválida falha no boot; HMAC do cliente ≠ HMAC do dono para o mesmo e-mail;
  - integração: a migração roda sobre o banco da S3 (cópias atualizadas, sem "Fictício").
- **Pronto quando:** a migração roda limpa local e no CI, e o health mostra a chave configurada.

### S4.2 Login do cliente por e-mail + código (sem flag de produto; `login_cliente_email` como saída de emergência) · ~5 h
- **Entrega:**
  - `salao/application/customer-login.ts`: pedir código (nome, telefone, e-mail, consentimento) e confirmar código;
  - regra de vínculo e retenção de 7 dias de carona no `cleanup`;
  - rotas `api/cliente/{entrar,confirmar,sair,apagar}`;
  - nova tela de identificação: campos vazios, a linha "Protótipo de case, não é o iFood. Seus dados são apagados em 7 dias", consentimento ligado (D165) e a tela do código;
  - "Sair" e "Apagar meus dados" na Jornada;
  - novo prefixo de cookie;
  - desvio de E2E pelo padrão da D123 (`e2e-cliente+N@exemplo.invalid` + token);
  - limites por e-mail e global.
  - Sai `fictitious-identity`.
- **Testes:**
  - integração: código certo, errado, expirado e a 5ª tentativa; e-mail existente reconhece o cliente; telefone existente + mesmo nome vincula, nome diferente dá erro; limites; apagar remove contato e e-mail; a flag desligada volta a nome + telefone;
  - E2E: QR → entrar → código → check-in → código do benefício; um teste pelo simulador do SES.
- **Pronto quando:** o check-in completo roda local com o e-mail de memória e no CI.

### S4.3 Limpeza "teste/simulação" + produto real + Ferramentas do avaliador (sem flag) · ~5 h
- **Entrega:**
  - todos os itens do inventário reescritos ou removidos;
  - saem `TestGuide`, `TestAdvance`, `testNote`, `simular/*`, `antecipar`, `delivery-import-simulated` e o roteiro da entrada;
  - `clearRun` no boot das rodadas `botao`;
  - nova barra (D164);
  - selo "Restaurante de exemplo · histórico gerado" (D162);
  - slugs pelo nome;
  - "Primeiros passos" derivados dos eventos;
  - "Ver minha página";
  - campo "Endereço" no assistente;
  - rodapé "Protótipo" no impresso e no e-mail;
  - `SEED_VERSION` 4 com os sobrenomes trocados;
  - **Bastidores › Ferramentas do avaliador:**
    - roteiro;
    - "Avançar 1 dia" (sessão do dono, só convites sem `simulation_run_id`, rótulo neutro);
    - "Ver como cliente reativado";
  - roteiro também na página do link de avaliação;
  - "Como funciona" atualizado: o que é seed, o que é real, o dado pessoal real e o risco.
- **Testes:**
  - unidade: Primeiros passos por evento; IC da semente 20261157 continua positivo com o seed v4;
  - integração: "Avançar 1 dia" só nos restaurantes do dono e não toca o seed;
  - E2E: varredura de textos pelo Playwright nas rotas do produto; volta com convite via "Avançar 1 dia"; selo só na Cantina.
  - Reescritas: `volta.spec`, `cliente.spec`, `dono.spec`, `painel.spec`, `entrada.spec`, `teste-restaurante.test`, `checkin.test`, `salao/misc.test`.
- **Pronto quando:** a suíte inteira está verde e a varredura não acha "simulad", "fictíci", "de teste", "Para testar", "demonstração" nem "Só no teste" fora das exceções.

### S4.4 Reativação entregue (app + e-mail por evento) (sem flag) · ~3 h
- **Entrega:**
  - `planos/application/deliver-reactivation.ts`: cria `customer_messages` (convite no app) e, depois do commit, envia e-mail a quem tem consentimento, com formato validado e teto diário;
  - `optApp=true` para clientes novos;
  - "Seus convites" na Jornada, com aviso de novo;
  - e-mail do convite ao cliente quando o convite nasce na mesa;
  - textos do dono: "Enviado para N clientes no app Comer Fora · M também por e-mail";
  - `channel='app_email'` nas linhas novas.
- **Testes:**
  - integração: só convidáveis recebem; o grupo de controle não recebe nada; e-mail só com consentimento e depois do commit; o teto diário corta o excedente; `.invalid` e o simulador não contam;
  - E2E: aprovar o plano na Cantina → "Ver como cliente reativado" → o convite aparece na Jornada.

### S5.1 Painel em reais + meta + "Hoje no salão" (flag `painel_valor`) · ~4 h
- **Entrega:**
  - topo com os 4 estados e "R$ X a mais em margem entre N convidados até agora" (estimativa com intervalo); sem ticket ou margem, mostra visitas + link;
  - meta por faixa (mesas desejadas × convites usados por semana, "não causal");
  - feed do dia com check-ins, códigos validados, convites e o grupo de controle (só para o dono), na mesma consulta de ~3 s;
  - nome do cliente como primeiro nome + inicial.
- **Testes:**
  - unidade: texto de cada estado (positivo, inconclusivo, negativo, amostra insuficiente; sem margem declarada); feed ordenado e só do dia em SP;
  - E2E: check-in do avaliador aparece no feed em ≤ 6 s; a Cantina mostra R$ com intervalo.

### S5.2 Conversão: landing, página do QR, convite com agenda (flag `copy_v2`) · ~4 h
- **Entrega:**
  - **copy pela skill:** diagnóstico B; 2–3 opções por título e por CTA; autoverificação de vícios de IA; teste "Now you can"; teste de troca;
  - **landing:** herói, 3 passos, "o que você vê toda semana", prova rotulada como exemplo, FAQ (com o "Por quê" do delivery), CTA "Ativar meu salão" + "Já tenho conta" + "Veja o que seu cliente vê";
  - **página do QR:** ganho no topo, um botão "Fazer check-in e ganhar", prova "N check-ins aqui nos últimos 7 dias" só com N ≥ 5;
  - **convite:** rota `api/cliente/agenda` (.ics, 1 evento no próximo dia válido, UTC, "válido até" na descrição); "Seu convite vale hoje" na Jornada.
- **Testes:**
  - unidade: .ics (próximo dia válido, fuso, escape); limiar da prova social;
  - E2E: axe sem violações e alvos ≥ 44 px na landing e na página do QR; o .ics baixa com o `content-type` certo.
- **Pronto quando:** a copy foi revista pela autoverificação e nenhum número aparece sem fonte no banco.

### S5.3 "Por que esta oferta?" (flag `explica_ia`) · ~3 h
- **Entrega:** uma gaveta por faixa no plano e no pacote, com:
  - candidatas + pontuação e critérios;
  - a escolha;
  - os fatos citados, resolvidos;
  - os guardrails;
  - o revisor;
  - modelo, reserva, custo e latência (`ai_calls`);
  - os passos do agente, quando houver.
- **Testes:**
  - integração: a montagem da explicação a partir de um plano gravado;
  - E2E: abrir a gaveta na Cantina (plano fixo, sem IA) e conferir as candidatas e a escolha.

### S6.1 Ciclo semanal por e-mail + agendador (flags `resumo_email` e `agendador`) · ~5 h
- **Entrega:**
  - `weekly-digest.ts`: gera o plano se faltar, espera o revisor e monta o e-mail em texto simples, sem logo, com R$, meta, plano e o link "Revisar e aprovar";
  - página `parceiro/aprovar/[token]`: GET só mostra, POST aprova (`via:"email"`); token amarrado ao `plan_id`, gasto só se aprovar deu certo; `no-referrer`; atualiza `lastSeenAt`;
  - "Ver o e-mail desta semana" e "Enviar agora" no Portal;
  - `src/shared/scheduler.ts` (intervalo de 60 s, trava por linha, recuperação, estados `reservado` → `enviado`, para no SIGTERM): resumo na segunda 08:30 SP e lembrete na manhã do dia do convite.
- **Testes:**
  - unidade: a próxima execução e a recuperação ("passou da hora e não há registro → envia");
  - integração: idempotência com 2 instâncias (só 1 envio); GET não aprova; token usado, expirado ou de plano trocado é recusado; "revisor bloqueou" não gasta o token; o lembrete só sai para quem tem convite válido hoje e consentimento;
  - E2E: "Enviar agora" → abrir o link (código da E2E) → aprovar uma vez.

### S6.2 Modo garçom (flag `modo_garcom`) · ~2 h
- **Entrega:**
  - "Link do garçom" em Configurações (token com hash, revogável), que vira cookie no 1º acesso;
  - `app/garcom/[token]` só com "Validar código";
  - `no-referrer`.
- **Testes:**
  - integração: token revogado é recusado; o token não dá acesso a outras rotas do Portal;
  - E2E: validar um código pelo link do garçom.

### S6.3 Plano como agente com ferramentas (flag `plano_agente`, padrão definido pela medida) · ~6 h
- **Entrega:**
  - teste de 15 min do provedor (ferramentas + saída estruturada no Gemini 3.8 Flash);
  - gateway com `tools`, `stopWhen` e `prepareStep` (último passo sem ferramentas), `steps` e custo somado;
  - `ia/tasks/plan-agent.ts`, com as ferramentas puras `ler_insights`, `listar_candidatas`, `custo_estimado` e `semana_anterior` sobre os fatos, e limite de 6 passos;
  - `agent_steps` gravados;
  - `eval/run-t3.ts --modo agente` + juiz em pares cegos (agente × chamada única);
  - `eval/relatorio-t3-agente.md`;
  - D159 aplicada (indicativa).
- **Testes:**
  - unidade: limite de passos; uma saída fora das candidatas é reprovada pelo guard; falha → chamada única → modo sem IA;
  - integração com o gateway falso: os passos ficam gravados e aparecem na S5.3.

### S6.4 Porta-conta (flag `porta_conta`) · ~1,5 h
- **Entrega:**
  - peça nova no kit (~10×20 cm), com QR por versão e chamada da IA para o momento de pagar;
  - página de impressão.
- **Testes:**
  - unidade: o contrato da chamada (referências);
  - E2E: imprimir a peça com o QR certo.

### Fechamento (S4–S6)
- **Atualizar documentos:** especificação v3, decisões D151–D168, `plano-implementacao`, log e "Como funciona".
- **Suíte completa** com a saída à vista.
- **`revisar-fatia`:** 4 revisores + E2E profunda, local e depois em produção.
- **Correções, conferência da memória da VPS e merge único**, com meta antes de segunda 08:30.
- **Deploy, E2E em produção** e verificação de que `/api/health` responde com o SHA novo.
- **Aparelhos da demo logados.**

## 9a. Revisão independente do plano (D95)
**Produto:**
- B1 (dado real numa página que parece o iFood) → **levado ao candidato** → D161: login completo, com consentimento e 7 dias.
- B2 (resultado programado sem rótulo) → **levado ao candidato** → D162: selo "Restaurante de exemplo".
- B3 (avaliador sozinho) → **aceito [C]**: roteiro na página privada e em Primeiros passos, rótulo neutro, "Ver como cliente reativado".
- I1 e I2 (atrito e demo) → **levados ao candidato** → D161: aparelho logado antes da demo.
- I3 (e-mails com link) → **levado ao candidato** → D163: tudo por e-mail.
- I4 (agente contradiz a D215) → **registrado** como D166.
- I5 (itens que eram do candidato) → **levados ao candidato** → D164 e D165.
- Menores → **aceitos [C]**: .ics, link para o cliente, 4 estados, FAQ.
- Corte de P6 e P8 → **mantidos** no fim da ordem de corte (D160).

**Técnica:**
- B1 a B5 e I1 a I8 → **aceitos [C]** (seção acima).
- Merge intermediário → **levado ao candidato** → D167: 1 merge no fim.
- Corte do agendador → **levado ao candidato** → D168: fica, com recuperação.
- Fato conferido: a S3 inteira levou ~4 h do plano aprovado à produção. O gargalo é a P1 sem flag, as E2E e o SES, e não as horas de código.

## 9. Execução depois da aprovação
1. Gravar este plano dividido em `docs/fatias/{S4,S5,S6}/planejamento.md` (+ CLAUDE.md "S0–S7"), as decisões D151–D160 + [C] em `decisoes-e-tradeoffs.md`, a especificação v3 (seções 3.1, 3.5, 3.8, 4.2, 4.6 e 7), `plano-implementacao.md` e o log. Commit e push na `main`.
2. `implementar-fatia` na ordem S4.1→S6.4, com commit por tarefa no branch da sessão e flags nas apostas.
3. `revisar-fatia`: 4 revisores + E2E profunda, correções, merge, deploy e E2E em produção até segunda 10h.
4. Verificação: suíte completa, lint, tipos, fronteiras, a varredura de textos, a T3 do agente e `/api/health` com o SHA novo.
