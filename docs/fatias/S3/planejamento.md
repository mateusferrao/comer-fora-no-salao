# Planejamento da fatia S3 — Painel, plano da semana, apresentação e bastidores

Status: **aprovado em 20/11/2026 pelo candidato** (aprovação do plano na sessão de planejamento; revisão independente do plano incorporada — seção 11).

> **Contexto.**
> - **Onde estamos:** a S2 está no ar (`03e9feb`, docs `d30a07b`). O dono já entra, ativa com IA, gera o kit, valida códigos e edita tudo em Configurações. Mas **não vê nenhum número**: o Início é provisório.
> - **O que ainda não existe:**
>   - painel e Clientes;
>   - plano da semana, com insights, "o que aprendemos" e reativação;
>   - Bastidores, "Como funciona", modo apresentação, prompts ao vivo e flags;
>   - T3 e MCP.
> - **O que reaproveitamos:**
>   - `analytics/domain`: `welch`, `marginIncrement`, `cohorts` e `buildSamples`;
>   - os 2 planos fixos da vitrine;
>   - o simulador;
>   - `reserveQuota`, `insertInvite`, `assignArm` e `decideInvite`;
>   - as tabelas de plano e de envio.
> - **Ritmo:** hoje é 20/11, ~12h em SP. A S3 estava prevista para 22/11, então há ~1,5 dia de folga. O congelamento é em 23/11 às 15h, e a S4 fica com 23/11 de manhã.
> - **Fontes:**
>   - especificação v2, §2, 3.1, 3.3–3.8, 4.3–4.9, 5, 7, 8 e 11;
>   - plano de implementação (S3);
>   - decisões D34, D35, D38, D39, D48, D55, D57, D58, D201–D224 e D101–D135;
>   - dívidas das revisões: S0 #27; S1 #9, #21, #22, #37, #38; S2 #23, #28–32, #37, #38.
> - **Decisões do candidato nesta conversa:** D136–D144.

## 1. Objetivo e entrega testável
Ao fim da S3, em produção, num **merge único** (D136):
1. **Visão geral do dono:**
   - métrica principal (visitas registradas e margem incrementais, com intervalo e os 4 estados) e "novos usuários do Comer Fora";
   - estado do plano;
   - funil (Últ. 7 / 30 dias e Hoje; filtro por peça e versão), atualizado a cada ~3 s;
   - cartões em 2 grupos: "comparado ao grupo de controle" (horário vazio e migração) e "indicadores antecipados · não causal";
   - no restaurante de teste: roteiro de teste e "Simular 30 dias" / "Limpar".
2. **Plano da semana:**
   - o código calcula os insights 1–3, o veredito por oferta, as candidatas e o teto recalibrado;
   - a IA escolhe entre as candidatas, escreve o convite e a justificativa e escreve "o que aprendemos" (com modo sem IA rotulado);
   - o dono aprova, ajusta ou descarta com motivo;
   - ao aprovar: nova versão da regra + **reativação simulada** (até 50% do teto livre — D142) + prévia + histórico.
3. **Clientes:** 4 segmentos com contagem e opt-in, lista curta (primeiro nome + inicial, telefone mascarado) e o aviso "a base é do restaurante".
4. **Entrada:**
   - "/" com 1 + 1 botões e um roteiro;
   - roteiro também na página do link do avaliador e no Início do teste;
   - `/apresentacao`;
   - "Como funciona";
   - links na barra;
   - CSP completa (só em produção).
5. **Bastidores:**
   - Qualidade da IA (pública e agregada);
   - **Visão da plataforma** (pública — D144);
   - Configurações do protótipo (com senha): prompts globais versionados, flags e resetar demo;
   - link "novo cliente fictício".
6. **Tom por restaurante** em Configurações, com "Ver como fica" (D138).
7. **Antecipar convite em 1 dia** no 2º card e na Jornada, só em restaurante de teste, encaixando o horário (D140, D141). **Motivo visível** quando o 2º card não aparece no teste: grupo de controle ou teto acabou (D143).
8. **T3 medida** (D137), em 3 camadas: código, juiz de IA cego fixo e nota cega do candidato, com concordância. O modelo do pacote e do plano sai por número.
9. **Extras por flag**, nesta ordem: insight 4 + A/B → revisor → aprende → MCP. Cada um vai ligado só se estiver testado; o resto entra desligado no mesmo merge.
10. **Operação:**
    - logs estruturados e flush do rastro no SIGTERM;
    - dívidas;
    - E2E local e de produção;
    - build medido com heap de 1 GB;
    - teste no Meet (checklist da espec. 5).

## 2. Requisitos e rastreabilidade
| Requisito | Fonte | Como será provado |
|---|---|---|
| Métrica principal com 4 estados, IC da margem, rótulo "simulado" na cópia | espec. 2, 3.8, D208–D209, D217 | integração: cópia → `positivo` com IC > 0 e margem "entre R$ A e R$ B"; teste vazio → `amostra_insuficiente` com "faltam N" |
| Migração e horário vazio contra o holdout | espec. 2 | integração com o mesmo estimador; o texto do estado vem do Welch |
| Indicadores antecipados (não causal) | espec. 2, 3.6 | integração: valores = contagens SQL feitas à mão |
| Funil coerente (convites só da mesa; % só entre subconjuntos); check-in em outra aba aparece em ≤ 5 s | espec. 3.6, D48 | unidade + E2E |
| Insights 1–3 com chaves estáveis | espec. 3.7.1 | unidade |
| Veredito do código, igual na vitrine e no produto | D220 | unidade nos limiares + integração: veredito mostrado na cópia = `verdict()` recalculado |
| Plano: IA escolhe ∈ candidatas, "aprendemos" por oferta; sem IA rotulado; "Exemplo pronto" no fixo | D206, D220 | unidade (guard) + integração (gateway falso e falho) |
| Aprovar: versão nova, reativação por intenção de tratar, ≤ 50% do teto livre, idempotente | espec. 3.3, 3.7.5, D216, D142 | integração: teto livre 6 → 3 vagas e holdout e convidáveis param juntos; aprovar 2× → 1 envio |
| Reativação idêntica no simulador e no produto | espec. 3.8 | função pura única; teste do gerador (IC > 0 nas 7 datas e em 17 de 20 sementes) reconferido |
| Clientes: segmentos; frequentes fora | espec. 3.6, D223 | unidade + integração |
| Entrada, roteiro, apresentação, "Como funciona", barra ≤ 44 px a 390 px, noindex | espec. 3.1, D38, D92 | E2E com axe |
| Prompts ao vivo, versões, flags; tom com prévia | D58, D138 | integração: publicar muda o `system` da próxima chamada; tom só no restaurante X |
| Antecipar (teste), com regras de borda | D140, D141, S1 #9 | integração: segunda-feira; check-in ontem; repetição; duas abas |
| Motivo do holdout no teste | D143 | E2E: cliente holdout no teste vê o aviso; na vitrine, não |
| Visão da plataforma | D144, espec. 2 | integração: contas E2E fora; valores = SQL à mão |
| T3 em 3 camadas | D137 | `eval/relatorio-t3.md` |
| A/B, revisor, aprende, MCP | D34, D55, D35, D212, D219 | testes próprios; flag desligada se não estiver pronto |
| Logs e SIGTERM | S0 #27 | unidade + `kill -TERM` no standalone |

## 3. Decisões desta fatia
| ID | Decisão | Alternativas | Trade-off | Motivo | Quem |
|---|---|---|---|---|---|
| D136 | **S3 sem corte, 1 merge no fim**, sem gatilho de contingência (reafirmado depois da revisão) | 2 merges (recomendado pela IA); gatilho em 22/11 às 14h (recomendado pela revisão); só o núcleo; S3 + S3b | diff grande perto do congelamento × menos ciclos de revisão | escolha do candidato | U |
| D137 | **T3 em 3 camadas:** código + juiz de IA cego + nota cega do candidato, com concordância | só um juiz; só regras | ~10 min do candidato e ~US$ 1 × história completa de IA medida | escolha do candidato | U |
| D138 | **Prompt global com senha + tom do restaurante** em Configurações | só global (recomendado); só por restaurante | +2–3 h e entrada livre no prompt × o avaliador também muda na hora | escolha do candidato | U |
| D139 | **`BASTIDORES_PASSWORD` gerada e gravada pela IA**, sem ecoar | o candidato cria | — | como a D105 | U |
| D140 | **"Antecipar 1 dia" no 2º card e na Jornada** (só teste) | painel no Portal; Bastidores sem senha | — | onde o avaliador precisa | U |
| D141 | **No teste, "Antecipar" também encaixa o horário** ("teste: vale hoje"), só naquele dia | só aviso; horário de teste no assistente | quebra a faixa congelada só no sandbox, declarado × ciclo fechado a qualquer hora | critério 2 | U |
| D142 | **Reativação usa até 50% do teto livre por faixa**; a prévia mostra quanto sobra para a mesa | teto todo (espec.); o dono escolhe | menos alcance na reativação × a mesa nunca fica sem convite | revisão (produto e técnica) | U |
| D143 | **No restaurante de teste, o motivo de não haver 2º card aparece** ("caiu no grupo de controle (1 em 10)" ou "o teto da semana acabou") + "Testar como outro cliente" | só no roteiro | revela o grupo só no sandbox × o avaliador entende o que viu | revisão de produto; combina com a D112 | U |
| D144 | **"Visão da plataforma"** em `/bastidores/plataforma`, pública e agregada | por flag no fim; só no slide | +1–2 h no núcleo × critério 4 (visão de negócio) visível no produto | revisão de produto | U |
| D145 | Itens [C] desta fatia (seção 13) | — | — | — | IA [C] |

## 4. Produto e fluxos

### 4.1 Personas e caminhos
- **Avaliador sozinho (link ou "/"):**
  1. Roteiro curto, visível em "/", em `/parceiro/acesso/<token>` e no Início do teste.
  2. Cópia da vitrine:
     - métrica `positivo`, com o rótulo "dados simulados · efeito programado +0,20";
     - funil e plano proposto ("Exemplo pronto");
     - "Gerar plano da semana" (IA ao vivo) → aprovar → "enviado para N clientes (simulado)";
     - Clientes;
     - Visão da plataforma.
  3. "Criar meu restaurante" → kit → "Abrir este QR" → check-in → 2º card (ou o motivo, no teste) → Validar.
  4. "Antecipar 1 dia" → novo check-in → código do convite → Validar.
  5. "Simular 30 dias".
- **Candidato na demo:** usa `/apresentacao`, com seletor de restaurante (teste ↔ cópia), barra visível e atalho para Bastidores. O roteiro de "mudar na hora" está na seção 4.7.
- **Agente externo (MCP, flag):** token gerado em Configurações › Agente → ler insights, gerar, ver e aprovar o plano. A aprovação fica registrada "via agente".

### 4.2 Visão geral (`/parceiro/salao`, substitui o Início provisório)
1. **Métrica principal.**
   - **Título:** "Visitas registradas a mais por cliente convidado (14 dias)".
   - **Valor:** "+0,21 visita por cliente · provavelmente entre +0,08 e +0,34". Total: "≈ 63 visitas a mais entre 300 convidados".
   - **Estados:**
     - `positivo`: "Os convidados voltaram mais que o grupo de controle".
     - `negativo`: "Os convidados voltaram menos que o grupo de controle. Reveja a oferta no plano da semana".
     - `inconclusivo`: "Ainda não dá para afirmar".
     - `amostra_insuficiente`: "Ainda não dá para afirmar: faltam N clientes do grupo de controle com 14 dias completos. Enquanto isso, acompanhe os indicadores antecipados".
   - **Margem**, só em `positivo`/`negativo`: "≈ entre R$ A e R$ B de margem a mais (estimativa, com base nos valores que você declarou)". Nos outros estados: "A margem aparece quando houver resultado". Sem ticket e margem: "Declare ticket e margem em Configurações para ver a margem".
   - **Na cópia da vitrine e com simulação:** selo "Dados simulados · efeito programado: +0,20 visita · Como funciona".
   - **Rodapé:** "Visitas registradas = check-ins. Comparamos por sorteio com um grupo de controle (1 em 10) que não recebe convite." + "Como medimos" (com a legenda dos 4 estados).
   - **Ao lado:**
     - "Novos usuários do Comer Fora · últ. 30 dias": 1º check-in da vida aqui, vindo de uma peça;
     - o atalho "Validar código".
2. **Plano da semana:** estado (proposto, aprovado ou vencido) e o botão "Revisar plano".
3. **Funil**, no padrão do print portal/05:
   - **Etapas:** Leituras do QR → Check-ins → Deixaram contato → Convites emitidos na mesa → Voltaram com convite → Códigos de convite validados. Ao lado: "+ N convites por reativação" e "Códigos de 1ª visita validados".
   - **Percentuais:** só entre etapas em que uma é subconjunto da anterior.
   - **Período:** "Período:" com pílulas Últ. 7 dias (padrão) · Últ. 30 dias · Hoje, em `radiogroup`. Filtro por peça e versão.
   - **Contraste:** rótulos em `ink` fora da barra (o vermelho `#EF5652` com texto branco não passa AA).
   - **390 px:** lista vertical de barras horizontais.
4. **Cartões.**
   - **"Comparado ao grupo de controle"** (com intervalo e os 4 estados):
     - visitas no horário vazio;
     - migração. Exemplo: "Sem sinal de migração: fora do horário vazio, convidados e grupo de controle vieram igual".
   - **"Indicadores antecipados · não causal":**
     - convites usados por coorte (com números, "em aberto");
     - custo por convite emitido;
     - custo por cliente identificado;
     - custo × margem.
5. **Tabela por peça e versão** com o A/B, recolhida (flag `ab`).
6. **Restaurante de teste.**
   - **Não ativo:** "Continuar ativação".
   - **Ativo:** roteiro em 5 passos:
     1. Abra o QR do kit.
     2. Faça check-in (se o convite não aparecer, a tela diz por quê).
     3. Valide o código.
     4. No convite, "Antecipar 1 dia" e faça check-in de novo.
     5. Simule 30 dias.
   - **Botões:** "Simular 30 dias" (selo "simulado") e "Limpar simulação". Uma rodada por restaurante.
7. **Atualização:**
   - funil e eventos a cada 3 s, só com a aba visível;
   - métrica e cartões a cada 60 s ou quando muda;
   - "Atualizado há X s", sem `aria-live` por consulta.

### 4.3 Plano da semana (`/parceiro/salao/plano`)
- **Topo:**
  - estado e semana;
  - rótulo de origem: "Gerado pela IA" · "Texto modelo (sem IA)" (com o motivo) · **"Exemplo pronto (escrito antes, sem IA ao vivo)"** (plano fixo da vitrine);
  - "Gerar plano da semana" (com confirmação se já houver um proposto; `gerando`; clique duplo → 1 chamada).
- **1. "O que os seus dados dizem":**
  - mapa dia × turno (30 dias), com números nas células e tabela equivalente; faixas declaradas destacadas; alerta "turno com poucos check-ins que você não marcou como vazio" (nunca "ocupação");
  - resposta aos convites por faixa e oferta;
  - segmentos.
- **2. "O que aprendemos":**
  - por oferta: selo do veredito **calculado pelo código na hora** + texto da IA (ou modelo);
  - nota: "O veredito é do código, por indicadores antecipados; não é causal."
- **3. "Proposta para esta semana":** por faixa, na ordem da IA. Cada faixa tem:
  - a oferta, com "Ver outras opções";
  - o teto ("até N convites/semana ≈ M mesas"), editável;
  - o custo máximo;
  - o texto do convite (guard em modo dono);
  - a justificativa;
  - o selo do revisor (flag).
- **4. Reativação (prévia):**
  - texto: "Vai para N clientes com opt-in (1 visita e sumiu: X; perto da recompensa: Y). Usa até U dos L convites livres desta semana em {faixa}; sobram S para quem fizer check-in na mesa. Para medir o efeito, 1 em cada 10 não recebe (grupo de controle)";
  - balão de mensagem neutro (sem logo nem marca do WhatsApp), com nome fictício e o selo "simulado: nada foi enviado";
  - o texto do balão é o do convite aprovado.
- **Ações:**
  - "Aprovar plano";
  - "Descartar", com motivo obrigatório: "Ofertas não servem" · "Teto alto demais" · "Prefiro manter o atual" · "Outro" (+ texto até 200 caracteres).
- **Depois de aprovar:**
  - toast "Plano aprovado · enviado para N clientes (simulado)";
  - plano em modo leitura;
  - "Histórico de planos": semana, estado, via portal/agente, envios.
- **Semana e estados:**
  - o plano vale para a semana ISO (SP) da aprovação;
  - um `proposto` de semana anterior aparece como "Proposta da semana passada · gere uma nova";
  - gerar depois de aprovar na mesma semana: confirmação "Já há um plano aprovado nesta semana; o novo, se aprovado, substitui a regra a partir de agora";
  - `vencido` é só exibição;
  - gerar exige restaurante ativo;
  - limite `plano:<id>` de 10/dia.

### 4.4 Regras novas no código [C]
- **Veredito por oferta** (`verdict`, por versão de convite vigente na semana anterior):
  - `cedo_demais`: menos de 10 convites reais (de mesa e de reativação) com ≥ 7 dias desde a emissão;
  - `manter`: uso em 7 dias ≥ 15%;
  - `trocar`: os demais.
  - **Custo:** sai do veredito (era redundante com o filtro das candidatas). "Custo por convite emitido" fica só como indicador.
  - **Chave:** `ofertaKey` = apelido `Ak` (faixa + versão), mapeado para `<slotId>:v<n>` no código.
- **Vitrine coerente:** o `SEED_VERSION` 3 calcula `learned[].verdict` com `verdict()` sobre a simulação e escolhe textos e escolhas dos planos fixos coerentes com o resultado. Teste de consistência.
- **Teto recalibrado:** `ceil(mesas / clamp(uso, 0,1, 1))`, com coortes de ≥ 7 dias; sem coorte, `mesas × 4`. Fica em `candidates.ts`, junto de `weeklyCapFor` (uma fórmula só).
- **Segmentos:**
  - "1 visita e sumiu": 1 check-in no restaurante, há ≥ 14 dias;
  - "perto da recompensa": 4–5 selos na cartela vigente;
  - "com convite ativo": convite real `ativo`;
  - "frequentes": ≥ 3 check-ins em 30 dias.
  - **Opt-in:** qualquer canal.
- **Reativação: função pura única** `planos/domain/reactivation.ts`, usada pelo produto **e pelo simulador**:
  1. Público = (sumiu ∪ perto) − frequentes − quem tem convite ativo − quem não tem opt-in, em ordem determinística (última visita, id).
  2. Cota por faixa = `floor(50% × teto livre)` (D142).
  3. Para cada cliente: `decideInvite` com o restante da cota em memória, **antes** do sorteio do grupo. Sem vaga, pula nos 2 grupos (intenção de tratar — D216). Convidável → real; holdout → fantasma.
  4. Se a função pura rodar no simulador, a vitrine muda: `SEED_VERSION` 3 e reconferir os testes do gerador.
- **Gravação da aprovação**, numa transação:
  - lock do restaurante;
  - novas versões via `newOfferVersion(tx, …)`, extraído de `updateOffer` (grava `plan_id`), e depois `loadContext(tx)`;
  - 1 lock por faixa em `invite_quota`;
  - inserts em lote com `ON CONFLICT DO NOTHING` no índice de 1 convite ativo: um check-in simultâneo pula o cliente em vez de derrubar a aprovação;
  - `plan_sends` com índice único em `plan_id`;
  - `decision.aiChoices` guarda as escolhas originais da IA (para "IA ≠ maior nota").
- **Funil:**
  - "Deixaram contato": 1ª visita ao restaurante no período;
  - "Convites emitidos na mesa": `origin = mesa`;
  - "Voltaram com convite": códigos de convite **emitidos**;
  - "Códigos de convite validados": desses, os validados;
  - filtro por peça: pela `origin_variant_id` do cliente (convites e voltas atribuídos à peça de origem).
- **Novos usuários do Comer Fora:** clientes com `origin_variant_id` cujo 1º check-in global é deste restaurante, nos últimos 30 dias.

### 4.5 Clientes (`/parceiro/salao/clientes`)
- 4 cartões: contagem + "com opt-in: N".
- Lista do segmento escolhido (até 20): nome (primeiro nome + inicial), "•••• 1234", 1ª visita, selos, peça de origem e opt-in.
- Avisos:
  - "Esta base é do seu restaurante. Neste protótipo, use só dados fictícios.";
  - nos frequentes: "não recebem reativação, para não trocar o horário de quem já vem".

### 4.6 Entrada, apresentação e "Como funciona"
- **"/":**
  - título "Seu salão cheio divulga seu horário vazio";
  - "Sou dono: abrir Portal (demo)" e "Sou cliente: ver restaurante";
  - roteiro: "Se o convite não aparecer depois do check-in, esse cliente caiu no grupo de controle (1 em 10): toque em 'Testar como outro cliente'"; "Para ver a volta com convite: crie seu restaurante de teste e use 'Antecipar 1 dia'"; "Como este protótipo funciona";
  - logo menor.
- **O mesmo roteiro** aparece em `/parceiro/acesso/<token>` e no Início do teste.
- **Barra:** "Trocar de lado" e "Como funciona".
  - A 390 px viram ícones com `aria-label` (alvo de 24 px), e um E2E confere a altura ≤ 44 px.
  - "Trocar de lado" no app, com sessão de dono: vai para a página da **cópia** da conta, não para a vitrine original; sem sessão, mostra um aviso.
- **`/apresentacao`:**
  - exige sessão; fora de menus;
  - Portal com largura = janela − 430 px; app em moldura de 390 px; testado a 1536×864 e a 1152×720 com zoom de 125%;
  - **seletor de restaurante** (teste ↔ cópia) que troca os 2 lados;
  - atalho para os Bastidores;
  - a barra fica visível na página externa (os iframes usam `embedded`);
  - aviso do último check-in ("Novo check-in · Display mesa A", "· grupo de controle" quando for o caso) e pulso no funil, por `GET /api/parceiro/painel/eventos?desde=`;
  - abaixo de 1100 px: "Use uma tela maior".
- **`/bastidores/como-funciona`:**
  - real × simulado;
  - parâmetros de `VITRINE_SIM`;
  - "simulação baseada em agentes (sem IA)"; "IC > 0 em 17 de 20 sementes";
  - limitações da medida (visitas registradas, amostra pequena) e os 4 estados;
  - "já existe × novo";
  - H1–H5;
  - telefone sem validação (D106/D114);
  - SES e e-mail do dono;
  - provedores de IA e rastro sem PII;
  - "a base é do restaurante" com a fonte [P];
  - "Antecipar" mexe só em testes e tira 1 do "Hoje";
  - créditos das fotos.

### 4.7 Bastidores
- **`/bastidores/qualidade`** (pública; sem as contas `via=e2e` e sem o restaurante E2E):
  - por tarefa: chamadas, % ok, % sem IA por motivo, uso do modelo reserva, principais bloqueios, custo e latência p50;
  - % aceitas sem edição;
  - **"IA ≠ maior nota"**;
  - revisor;
  - resumos da T1 e da T3.
- **`/bastidores/plataforma`** (D144; pública; agregada sobre as contas do protótipo, sem E2E):
  - restaurantes ativados;
  - % divulgando (≥ 1 peça com leitura na semana);
  - novos usuários do Comer Fora vindos do salão;
  - tempo até ativar;
  - abandono por passo do assistente (H5);
  - custo de IA por restaurante ativado;
  - conta de bolso rotulada [H] (escala para 400 mil restaurantes), com as premissas à vista.
- **`/bastidores/config`** (senha):
  - acesso: `BASTIDORES_PASSWORD` comparada por hash em tempo constante; cookie assinado de 8 h, `SameSite=Strict`; limite de 5 tentativas a cada 15 min por IP; sem a variável, a área fica desligada;
  - **prompts por tarefa** (chaves `prompt:pacote`, `prompt:plano`, `prompt:kit`, `prompt:cardapio`):
    - bloco de instruções e tom;
    - versões e histórico;
    - "Testar com exemplo": entrada fixa fictícia, saída renderizada e resultado do guard; custo gravado em `ai_calls`; 20/h;
    - publicar (com a versão sob lock) e voltar;
  - **flags**;
  - **resetar demo:** "Recriar minha demo" (conta logada) e "Recriar vitrine pública";
  - link para "Novo cliente fictício" (rota já existente).
- **Roteiro de "mudar na hora" (demo 6:45):**
  1. Bastidores.
  2. Prompt do **kit**: mudar o tom.
  3. "Testar com exemplo", com antes e depois (~2–3 s).
  4. Publicar.
  5. Regenerar 1 campo do kit no Portal.
  - **Checklist:** entrar nos Bastidores antes da sessão e **voltar a versão do prompt depois da demo**.

### 4.8 Antecipar convite (D140, D141) e motivo do holdout (D143)
- **Link:** "Para testar: antecipar 1 dia", com selo "teste", no 2º card e na Jornada, só em restaurante `teste`.
- **Aplica-se** só a convite real `ativo`, emitido hoje, de um cliente **sem check-in ontem** nesse restaurante. Fora disso: "Não se aplica a este convite".
- **Efeito**, numa transação com lock de `restaurant_customers` (mesma ordem de `do-checkin`):
  - recua 1 dia `issued_at`/`issued_day` do convite e o check-in de hoje (`at`, `day_sp`, `turn`, `last_checkin_day`, `card_last_day`; e `first_checkin_at`/`card_started_day` quando forem de hoje);
  - **mantém o `week_key`** (o teto e a coorte não mudam de semana);
  - os códigos ficam como estão;
  - repetir no mesmo convite não faz nada.
- **Horário (D141):**
  - se agora estiver fora da faixa, grava a coluna nova `invites.test_valid_day = hoje`;
  - o adaptador passa `anyTimeToday` a `decideCheckin`: campo opcional e puro, que vale só naquele dia;
  - card, código e Validar mostram "Só no teste: liberado hoje, fora do horário".
- **Mensagem de sucesso:** "Pronto (só no teste): o convite agora conta como de ontem. Faça check-in de novo para receber o código."
- **Motivo do holdout no teste (D143):** sem 2º card num restaurante `teste`, aparece um aviso com selo "teste":
  - "Este cliente caiu no grupo de controle (1 em 10): é assim que medimos o efeito." ou "O teto de convites desta semana acabou.";
  - em seguida, "Testar como outro cliente".
  - Vitrine e cópias: nada muda.

### 4.9 Tom por restaurante (D138)
- **Onde:** Configurações › Restaurante › "Tom da IA do seu restaurante".
- **Campo:** até 200 caracteres. Rejeita `{}`, `<>`, URL, quebra de linha e palavras proibidas.
- **Aviso:** "Muda só o estilo dos textos da IA; as regras e os números continuam do sistema."
- **Uso:** entra no **conteúdo do usuário** (não no `system`), delimitado e com "as regras acima prevalecem", nas tarefas `pacote`/`plano` e `kit`.
- **"Ver como fica":** regenera o texto do convite de 1 faixa (conta no limite do pacote) e mostra antes e depois, com "Usar este texto".
- **Registro:** `owner_edits` (`config:tom`); `prompt_version` com `+tom`.

### 4.10 Kit, Configurações e dívidas
- **Kit** (S2 #28; [C]): uma versão com **leituras** fica com o texto travado. A ação "Criar nova versão" gera nova variante e novo QR (precisa reimprimir); a antiga fica "retirada", e o QR dela continua funcionando. Sem leituras, a edição segue no lugar. O A/B ignora versões retiradas, e `editVersionField` passa a usar o id da variante.
- **Configurações:** aviso "o texto cita um prato que não é mais a oferta" (#31).
- **Outras dívidas:**
  - garçom na cópia (#32);
  - polimento (#38, S1 #37): raio, ícones, Stepper no celular, placeholder do Validar, "Ativação" some depois de ativar, foto colorida;
  - acoplamentos (#37).

## 5. Telas, estados e textos
- **Visão geral:**
  - esqueleto ao carregar;
  - "Continuar ativação";
  - roteiro de teste;
  - em erro de rede, mantém o último valor + "Atualizando…";
  - a 390 px, cartões em coluna e funil vertical.
- **Plano:**
  - `gerando`: "A IA está escolhendo as ofertas…" (até ~45 s, depois sem IA);
  - sem candidatas: "Sem oferta válida no cardápio para esta faixa" + Configurações;
  - limite: "Você gerou muitos planos hoje. Tente amanhã.";
  - inativo;
  - aprovado (só leitura);
  - restaurante sem plano anterior: "o que aprendemos" vazio, "Primeira semana: ainda não há o que comparar".
- **Clientes:** segmento vazio → "Nenhum cliente neste grupo ainda."
- **Bastidores:**
  - "Senha incorreta.";
  - "Muitas tentativas. Tente em alguns minutos.";
  - guard reprovado em lista.
- **Acessibilidade:**
  - funil, mapa e coortes com tabela equivalente e números;
  - estados não dependem só de cor;
  - foco e Esc nos painéis;
  - `prefers-reduced-motion` desliga o pulso;
  - axe sem violações a 390 e 1280 px.

## 6. Técnica

### 6.1 Arquivos
- **`analytics/`:**
  - `domain/{funnel, insights, verdict, segments, ab, platform}.ts`;
  - `application/{dashboard, insights-data, customers, platform}.ts`.
- **`planos/`:**
  - `domain/{plan-content, plan-facts, reactivation}.ts`;
  - `application/{generate-plan, approve-plan, discard-plan, plan-view, history}.ts`;
  - `startGenerating` extraído de `onboarding/application/package.ts`.
- **`ia/`:**
  - `tasks/package.ts` ganha o modo plano (`plano-v1`; `aprendemos` por apelido de oferta);
  - `tasks/reviewer.ts` (flag);
  - `prompt-config.ts`: instruções ativas, tom e exemplos, também no `addSlot`;
  - `examples.ts` (flag).
- **`config/`:**
  - `domain/flags.ts`;
  - `application/{app-config, test-prompt, reset-demo}.ts`.
- **Outros módulos:**
  - `salao/application/advance-invite.ts`;
  - `simulacao/application/simulate-test.ts`;
  - `mcp/{server, tokens}.ts` (flag);
  - `shared/log.ts`.
- **Rotas com despacho por segmento**, para conter o build:
  - `api/parceiro/painel/[acao]`;
  - `api/parceiro/plano/[acao]`;
  - `api/parceiro/simular/[acao]`;
  - `api/bastidores/[acao]`;
  - `api/cliente/convite/antecipar`;
  - `api/mcp`.
- **Páginas:**
  - `parceiro/salao/{page, plano, plano/historico, clientes}`;
  - `apresentacao`;
  - `bastidores/{qualidade, plataforma, config, como-funciona}`;
  - `page.tsx`.
- **Componentes:** `FunnelBars`, `StatCard`, `MetricHero`, `CohortBars`, `TurnHeatmap`, `VerdictBadge`, `MessagePreview`, `PhoneFrame`.
- **T3:** `eval/{run-t3, fixtures-t3, judge-t3, relatorio-t3}.ts`, `eval/t3-cego.md`, `eval/relatorio-t3.md`.

### 6.2 Interfaces produzidas
```ts
funnel(rows, period: "hoje"|"7d"|"30d", variantId?): FunnelStep[];
turnHeatmap(checkins, slots): { cells; lowUndeclared };
verdict({ issued7d, used7d }): "manter"|"trocar"|"cedo_demais";
recalibratedCap(extraTables, usage | null): number;               // em candidates.ts, junto de weeklyCapFor
segmentOf(c, today): Segment[];
reactivationPlan(customers, slots, remainingBySlot, { sharePct: 50 }, at): Array<{ customerId; decision: InviteIssue }>;  // produto + simulador
abStatus(a, b): { state; missing?; winner? };
getDashboard(ex, restaurantId, now, { period; variantId? }): Promise<DashboardView>;
getPlanInsights(ex, restaurantId, now): Promise<{ facts; insights; verdicts }>;
getSegments(ex, restaurantId, now, segment?): Promise<SegmentsView>;
getPlatformView(ex, now): Promise<PlatformView>;
generateWeeklyPlan(db, { restaurantId, ownerId, now, gateway? }): Promise<ProposeResult>;
approvePlan(db, { restaurantId, planId, final, via: "portal"|"agente", now }): Promise<{ ok: true; already: boolean; sent: { real; fantasma; semCota } } | { ok: false; erro }>;
discardPlan(db, { restaurantId, planId, reason, text?, now });
newOfferVersion(tx, { restaurantId, role, slotId?, offer, weeklyCap?, inviteText?, planId?, now }): Promise<string>;
getActivePrompt(ex, task); publishPrompt(ex, task, text, note?); rollbackPrompt(ex, task, version); getFlags(ex); setFlag(ex, flag, on);
advanceInvite(db, { customerId, inviteId, now }): Promise<{ ok: true; testValidToday: boolean } | { ok: false; erro: "nao_encontrado"|"nao_teste"|"nao_se_aplica" }>;
simulateTest(db, { restaurantId, now }): Promise<{ runId }>;  // idScope = runId; termina no fim da semana ISO anterior
clearTest(db, { restaurantId }): Promise<void>;
```

### 6.3 Dados — migração `0004` (só aditiva)
- **Configuração:** `app_config_versions` (`key`, `version`, `value`, `note`, `created_at`; PK `key`+`version`) e `app_config` (`key` PK, `version`).
- **Novas colunas:**
  - `restaurants.ai_tone`;
  - `invites.test_valid_day`;
  - `piece_variants.retired_at` e `reviewer_reasons`;
  - `ai_calls.ref` e `ai_calls.plan_id`.
- **Nova tabela:** `mcp_tokens` (`id`, `restaurant_id`, `token_hash` único, `hint`, `created_at`, `revoked_at`).
- **Índices de integridade:**
  - único em `plan_sends(plan_id)`;
  - único parcial `simulation_runs(restaurant_id) where kind = 'botao'`.
- **Índices de desempenho:** só depois do `EXPLAIN` na cópia. Os existentes (`checkins(restaurant_id, at)`, `codes(restaurant_id, valid_day)`) provavelmente bastam.
- **Seed:** `SEED_VERSION` 3, com:
  - vereditos calculados;
  - reativação pela função pura;
  - garçom na cópia;
  - foto colorida;
  - planos fixos marcados como "exemplo pronto".

### 6.4 IA
- **Tarefa 3 no modo plano (`plano-v1`):**
  - mesmo schema por chamada da S2, com `aprendemos[]`: `ofertaKey` vem de um enum de apelidos, 1 por oferta, texto ≤ 300 só com referências;
  - sem ofertas anteriores, `aprendemos` vazio (sem `z.enum([])`);
  - o veredito **não** sai da IA;
  - o contexto de `{oferta}`/`{horario}` vale por oferta, inclusive em faixa desativada.
  - **Guard:** escolha ∈ faixa, permutação, `aprendemos` cobrindo todas as ofertas, sem dígitos e sem palavras proibidas.
  - **Sem IA:** maior nota + texto modelo + **justificativa modelo montada pelo código a partir dos fatos** (também usada como linha de base da T3) + `aprendemos` por modelo de veredito.
- **Montagem do prompt:**
  - `system` = instruções ativas (`app_config`) + REGRAS (código);
  - `user` = dados + tom delimitado + exemplos (aprende; só edições que passam no guard em modo `ia`);
  - versão gravada: `plano-v1@cfgN(+tom)(+ex)`.
- **Modelos:**
  - pacote e plano saem da T3; o kit segue o vencedor [C];
  - revisor de um 3º provedor, diferente dos 2 do laço de reserva.
- **T3 (D137):**
  - 5 fixtures: 3 exemplos + cópia da vitrine (com veredito) + 1 borda;
  - concorrentes de texto da D129, com 2 repetições;
  - **código mede:** JSON e guard ok, referências, "IA ≠ maior nota", p50 e custo;
  - **juiz de IA:** **fixo para todos**, de um provedor que não concorre (e nunca Anthropic); escolhido no catálogo, com o custo estimado antes;
  - **pares cegos:** IA × linha de base com justificativa modelo, em ordem sorteada; rubrica 1–5 (item × turno; fato pertinente; voz da casa) + preferência;
  - **nota do candidato:** `eval/t3-cego.md` com 10 pares; a resposta vem no chat; concordância em % (com intervalo) e κ indicativo;
  - **regra [C]:** é elegível o modelo com guard ok ≥ 90% e p50 ≤ 15 s; vence a maior média do juiz; a reserva é o melhor de outro provedor;
  - **orçamento:** até ~US$ 1,50, com o saldo conferido antes.
- **Revisor (flag):**
  - roda depois da resposta (`after()`);
  - aprovar e imprimir ficam bloqueados enquanto ele está "revisando…" (até 20 s; depois, "não revisado" libera) e quando o resultado é `bloquear`;
  - se o revisor falhar, nada é bloqueado.
- **MCP (flag):**
  - **JSON-RPC escrito à mão** (`initialize`, `tools/list`, `tools/call`), sem estado, com Zod e sem dependência nova;
  - **plano B:** `@modelcontextprotocol/server` 2.x em `serverExternalPackages`.

### 6.5 Segurança e privacidade
- **Painel e Clientes:** só o restaurante da sessão; Clientes nunca mostra o HMAC; prompts só com dados agregados.
- **Bastidores:** cookie próprio com `SameSite=Strict`; `rejectCrossSite`.
- **Antecipar:** só o convite do próprio cookie, só restaurante de teste, 10/h por cliente.
- **MCP:**
  - token de 32 bytes, guardado como SHA-256, revogável, ligado a 1 restaurante;
  - comparação em tempo constante, checagem de `Origin`, 60/h;
  - sem `restaurantId` nas ferramentas; respostas só com agregados;
  - aprovação registrada como `approved_via: "agente"`.
- **CSP** (só em produção; em dev, relaxada para `eval`/HMR):
  - `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`;
  - pdf.js com `isEvalSupported: false`;
  - E2E de **upload de PDF** e de `/apresentacao`, para pegar quebra pela CSP.
- **Logs:**
  - JSON com **lista de campos permitidos** (sem PII);
  - SIGTERM com `NEXT_MANUAL_SIG_HANDLE=true` e handler próprio (fecha o servidor e faz flush do Langfuse em até 5 s), testado com `node server.js` + `kill -TERM`.

### 6.6 Operação e passos do candidato
- **IA:**
  - gravar `BASTIDORES_PASSWORD`;
  - conferir o saldo do OpenRouter antes da T3.
- **Candidato:** cerca de 10 minutos para a nota cega da T3. Aviso quando o arquivo estiver pronto.
- **Build:**
  - o CI passa a usar `NODE_OPTIONS=--max-old-space-size=1024`, como o Dockerfile;
  - **medir na tarefa 2** e de novo no checkpoint;
  - antes do merge, conferir a memória livre da VPS.
- **E2E de produção:** as specs novas entram no job `deploy`. Em produção, os Bastidores provam só que a senha é pedida. O plano é gerado sem afirmar sobre o texto: o teste confere só o estado ("IA" ou "modelo sem IA").

## 7. Testes
**Unitários:**
- **`funnel`:**
  - 6 etapas;
  - "Hoje" às 23h50 e às 00h10 em SP;
  - convite de reativação fora do funil;
  - % só entre subconjuntos.
- **`turnHeatmap`.**
- **`verdict`:**
  - 9 convites com ≥ 7 dias → `cedo_demais`;
  - 20 com 3 usados → `manter`;
  - 20 com 2 → `trocar`;
  - 10 com 2 (20%) → `manter`.
- **`recalibratedCap`:**
  - uso 0,25 e 2 mesas → 8;
  - 0,05 → 20;
  - sem uso → mesas × 4.
- **`segmentOf`:** 14 contra 13 dias; 4, 5 e 6 selos; 3 em 30 dias.
- **`reactivationPlan`:**
  - teto livre 6 → cota 3;
  - 20 clientes: convidáveis e holdout param juntos quando a cota acaba;
  - frequentes e quem tem convite ativo ficam fora;
  - ordem determinística.
- **`decideCheckin` com `anyTimeToday`:**
  - fora da faixa e no mesmo dia do campo → código;
  - no dia seguinte → lembrete.
- **`abStatus`:** 355 e 356 leituras.
- **Guard do plano.**
- **`prompt-config`:** tom no `user` e delimitado.
- **Logger:** lista de campos permitidos.

**Integração (Postgres):**
- **Dashboard na cópia:**
  - `positivo`;
  - margem com IC;
  - migração;
  - funil igual às contagens SQL feitas à mão;
  - veredito mostrado = `verdict()`.
- **Restaurante de teste:**
  - vazio → `amostra_insuficiente` com "faltam N";
  - **dois restaurantes de teste simulam no mesmo dia, e um teste simula com a vitrine semeada (sem colisão);**
  - **depois de Simular, um check-in real ainda recebe convite;**
  - clique duplo → 1 rodada;
  - restaurante `protected` é recusado;
  - Limpar reconta.
- **Plano:**
  - gerar com gateway falso → `ia` e `learned` com os vereditos;
  - gateway falho → `sem_ia`;
  - clique duplo;
  - restaurante inativo.
- **Aprovar:**
  - versões com `plan_id`;
  - reativação dentro da cota;
  - holdout fantasma;
  - check-in simultâneo durante a aprovação não derruba nada;
  - 2× → 1 envio;
  - `owner_edits`;
  - `approved_via: "agente"`.
- **Antecipar:**
  - volta no mesmo dia gera código;
  - fora da faixa → `test_valid_day` + código;
  - segunda-feira mantém o `week_key`;
  - check-in ontem → `nao_se_aplica`;
  - repetir depois da volta;
  - duas abas;
  - vitrine → 404;
  - convite de outro cliente → 404.
- **Configuração:**
  - `app_config`: publicar muda o `system`; voltar; publicação concorrente;
  - tom só no restaurante X.
- **Visão da plataforma:** sem as contas E2E; números iguais ao SQL.
- **Isolamento:** A × B.
- **Por flag:** MCP; revisor bloqueia; aprende filtra as edições.

**E2E** (390 e 1280 px, axe, local e produção):
1. **`painel.spec`:**
   - cópia: métrica + rótulo "simulado" + funil;
   - check-in em outra página → funil em ≤ 5 s;
   - Clientes;
   - plano "Exemplo pronto" → gerar (estado) → aprovar → envio; aprovar 2× → 1;
   - descartar.
2. **`volta.spec`:**
   - restaurante de teste: QR → check-in até convidável → **Antecipar** → check-in → código → Validar;
   - **holdout no restaurante E2E oculto** (aviso de teste no sandbox).
3. **`entrada.spec`:**
   - "/";
   - roteiro na página de acesso;
   - "Como funciona", Qualidade, Plataforma;
   - barra ≤ 44 px a 390 px;
   - noindex;
   - Bastidores pedem senha (localmente, o fluxo completo).
4. **`simular.spec`.**
5. **`apresentacao.spec`:** 1536×864 e 1152×720, troca de restaurante, barra visível.
6. **`pdf.spec`:** upload de PDF passa com a CSP.
7. **`mcp.spec`** (flag).
8. **Ensaio cronometrado** de 3:45 a 8:00 e **teste no Meet** (espec. 5).

## 8. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Merge único grande perto do congelamento (D136, sem contingência) | Ordem protege o núcleo; extras entram desligados; build medido cedo; o merge mira 22/11 |
| Heap de 1 GB no build da VPS (o CI não testava) | `NODE_OPTIONS` no CI; rotas com despacho por segmento; MCP sem SDK; medir na tarefa 2 |
| Reativação enviesando a métrica | Função pura única e cota decidida antes do sorteio (intenção de tratar), testada; vitrine regenerada com ela |
| Vitrine diferente depois do `SEED_VERSION` 3 (IC) | Reconferir o IC > 0 nas 7 datas e em 17 de 20 sementes; se cair, o efeito declarado não muda, e o assunto volta ao candidato |
| Simular gastando o teto ou colidindo ids | `idScope = runId`, termina na semana anterior, 1 rodada por restaurante |
| CSP quebrando o pdf.js e o dev | Só em produção; `isEvalSupported: false`; E2E de PDF |
| Antecipar mexendo em check-in | Só teste, lock, regras de borda, `week_key` mantido, testes |
| Tom e exemplos como injeção | No `user`, delimitado, limitado, guard |
| Prompt global alterado na demo | Versões imutáveis, voltar, checklist de voltar depois |
| Juiz de IA enviesado | Juiz fixo e cego, linha de base com justificativa, nota humana com concordância |
| MCP aprova dinheiro sem clique (D219) | Token, limite, "via agente", flag |
| `'unsafe-inline'` em scripts | Declarado; nonce no roadmap |

## 9. Fora de escopo
- **Roadmap:** rotação do holdout, promover vencedora automático, modo salão com PIN e benchmark entre restaurantes.
- **Fora do protótipo:** envio real, exportar dados.
- **Fica para a S4:** slide, vídeo, repositório público e preparação.

## 10. Perguntas respondidas pelo candidato
1. Escopo e ritmo → tudo, com 1 merge no fim (D136).
2. Juiz da T3 → os dois, juiz de IA cego e nota cega do candidato (D137).
3. Tom → global com senha + tom por restaurante (D138).
4. Senha → a IA gera e grava (D139).
5. Antecipar → no 2º card e na Jornada (D140).
6. Fora da faixa no teste → o Antecipar também encaixa o horário (D141).
7. **Depois da revisão independente:**
   - reativação → até 50% do teto livre (D142);
   - contingência do merge → **não**, merge único sempre (D136 reafirmada);
   - motivo do holdout no teste → sim, só no sandbox (D143);
   - Visão da plataforma → sim, nos Bastidores públicos (D144).

## 11. Revisão independente do plano (20/11, 2 subagentes)
Conferi no código os fatos que mudam o plano:
- a reativação do simulador confere a vaga antes do sorteio e não exclui os frequentes (`generator.ts:236-252`);
- o teto conta os convites simulados (`persistence.ts:43-49`, `persist.ts:153-158`);
- o Dockerfile limita o heap a 1 GB;
- a justificativa do modo sem IA é `""` (`package.ts:100`);
- o veredito fixo B:v2 = "trocar" (`history.ts:163`);
- `@modelcontextprotocol/sdk` está na 1.32.2.

### Técnico
| # | Sev. | Achado | Destino |
|---|---|---|---|
| T-B1 | bloq. | Simular repete ids de clientes (semente fixa) | **[C]** `idScope = runId`; testes de 2 restaurantes no mesmo dia |
| T-B2 | bloq. | Simular gasta o teto da semana corrente | **[C]** termina no fim da semana ISO anterior; 1 rodada por restaurante; recusa `protected`; teste "check-in real ainda recebe convite" |
| T-B3 | bloq. | Reativação fora da intenção de tratar e diferente do simulador | **[C]** função pura única (cota antes do sorteio; frequentes fora), usada pelo simulador; `SEED_VERSION` 3 + IC reconferido |
| T-I1 | imp. | Antecipar: bordas (check-in ontem, segunda-feira, repetição, corrida, flag permanente) | **[C]** regras da 4.8; `invites.test_valid_day`; lock; `week_key` mantido |
| T-I2 | imp. | Critério de custo do veredito não mede nada; valores do teste impossíveis | **[C]** veredito só por uso e amostra; valores novos |
| T-I3 | imp. | Vereditos do seed escritos à mão | **[C]** calculados no seed + teste de consistência (igual a P-B3) |
| T-I4 | imp. | Heap de 1 GB não testado no CI; medição tardia | **[C]** `NODE_OPTIONS` no CI, despacho por segmento, medição na tarefa 2 |
| T-I5 | imp. | CSP quebra o dev e talvez o pdf.js; faltam E2E | **[C]** CSP só em produção, `isEvalSupported: false`, E2E de PDF e de apresentação |
| T-I6 | imp. | T3: juízes diferentes por candidato; linha de base reconhecível | **[C]** juiz fixo; justificativa modelo na linha de base; % de acordo com intervalo |
| T-I7 | imp. | Aprovar: `updateOffer` com transação própria; corrida com o check-in; lock longo | **[C]** `newOfferVersion(tx)`, `ON CONFLICT DO NOTHING`, lock por faixa, índice único `plan_sends(plan_id)` |
| T-I8 | imp. | SIGTERM do standalone | **[C]** `NEXT_MANUAL_SIG_HANDLE` + handler próprio + teste |
| T-I9 | imp. | SDK do MCP: dependências e transporte | **[C]** JSON-RPC escrito à mão; plano B: v2 externo |
| T-I10 | imp. | E2E de produção: specs fora do job; holdout; IA instável | **[C]** specs no `deploy`; holdout no restaurante E2E; plano afirma só o estado |
| T-I11 | imp. | Tom e exemplos no `system` | **[C]** no `user`, delimitados; exemplos só se passam no guard |
| T-m | menor | `ofertaKey` por apelido e sem enum vazio; índices redundantes; polling de 3 s com métrica pesada; funil × reativação; teto em 3 lugares; `aiChoices`; Qualidade sem E2E; virada de semana; revisor × aprovar; chaves de prompt; cookie Strict; lista de campos permitidos; custo do "testar"; kit × `editVersionField` | **[C] todos aceitos** (seções 4–7) |

### Produto
| # | Sev. | Achado | Destino |
|---|---|---|---|
| P-B1 | bloq. | Avaliador pelo link não vê o roteiro; holdout mudo no teste | **[C]** roteiro na página de acesso e no Início do teste; **candidato:** motivo visível no sandbox (D143) |
| P-B2 | bloq. | Plano fixo como "Gerado pela IA"; métrica simulada sem rótulo | **[C]** "Exemplo pronto"; selo "dados simulados · efeito programado" |
| P-B3 | bloq. | Veredito do seed × do código | **[C]** igual a T-I3 |
| P-I1/I2/I3 | imp. | "Não causal" em métricas contra o holdout; IC da margem; jargão | **[C]** 2 grupos de cartões; margem com intervalo; textos da 4.2 |
| P-I4/I5 | imp. | Funil mistura unidades; contraste do texto no vermelho | **[C]** convites só da mesa; % só entre subconjuntos; rótulos em `ink` |
| P-I6/I7 | imp. | Barra a 390 px; `/apresentacao` sem larguras nem troca de restaurante; teste no Meet | **[C]** ícones + E2E de altura; larguras, seletor, barra externa; Meet no checklist |
| P-I8/I9 | imp. | "Mudar na hora" lento; tom sem efeito visível | **[C]** roteiro com prompt do kit + "testar com exemplo"; "Ver como fica" |
| P-I10 | imp. | Reativação esgota o teto da mesa | **candidato:** até 50% (D142) |
| P-I11/I12 | imp. | Simular gasta o teto; Antecipar mostra a faixa errada no Validar | **[C]** igual a T-B2; "Só no teste: liberado hoje" em todos os lugares |
| P-I13 | imp. | Falta a visão do iFood | **candidato:** Visão da plataforma (D144) |
| P-I14 | imp. | Kit travado obriga reimprimir por erro de digitação | **[C]** trava só quando a versão tem leituras |
| P-I15 | imp. | Gatilho de contingência do merge único | **candidato:** não (D136 reafirmada) |
| P-I16 | imp. | "Trocar de lado" leva à vitrine original | **[C]** com sessão, vai para a cópia |
| P-m | menor | Chips "Últ. 7 dias"; funil vertical a 390 px; sem `aria-live` por consulta; números no mapa; aviso de Clientes; prévia sem marca do WhatsApp; legenda dos 4 estados; `week_key` na segunda | **[C] todos aceitos** |

## 12. Ordem de implementação e registro
1. **Fundação:**
   - migração `0004`;
   - `NODE_OPTIONS` no CI;
   - CSP (só em produção) + E2E de PDF;
   - `analytics/domain` e `planos/domain/reactivation` (TDD).
2. **Simulador e seed:** com a reativação pura, `SEED_VERSION` 3 (vereditos calculados) e o IC reconferido. Depois, `getDashboard` + Visão geral + barra lateral com 5 abas + Clientes. **Medir o build.**
3. **Plano da semana:** gerar, aprovar (com reativação), descartar, histórico e tela.
4. **Restaurante de teste:** Antecipar + motivo do holdout no teste + Simular/Limpar.
5. **Entrada e superfícies públicas:** "/", roteiro na página de acesso, barra, "Como funciona", `/apresentacao`, Visão da plataforma.
6. **Configuração e Bastidores:** `app_config` + prompts + flags + Bastidores (senha, qualidade, reset) + tom com "Ver como fica".
7. **T3:** o arquivo cego sai cedo, para o candidato responder em paralelo → modelos.
8. **Fechamento:** logs + SIGTERM + dívidas.
9. **Checkpoint do núcleo:** suíte e E2E local verdes, build medido.
10. **Extras por flag:** A/B → revisor → aprende → MCP.
11. **Revisão e entrega:** `revisar-fatia` → correções → merge → deploy → E2E de produção.

**Ao aprovar:**
1. Copiar para `docs/fatias/S3/planejamento.md`.
2. Registrar D136–D145 (seção L) em `decisoes-e-tradeoffs.md`.
3. Atualizar a especificação:
   - §3.1: Antecipar fora dos Bastidores; motivo do holdout no teste; Visão da plataforma; tom;
   - §3.3: reativação até 50%;
   - §3.6: funil e cartões;
   - §4.2: dados;
   - §4.5: variável nova.
4. Atualizar o plano de implementação e o `log-conversa-ia.md`.
5. Commit + push na `main` e no branch da sessão.
6. Gravar `BASTIDORES_PASSWORD`.
7. `implementar-fatia S3`, autônoma (D101).

## 13. Itens [C] (D145)
- **Regras:**
  - veredito (10 convites; 15%; sem critério de custo);
  - segmentos (14 dias; 4–5 selos; 3 em 30 dias);
  - opt-in em qualquer canal;
  - funil (só convites da mesa; voltas = códigos emitidos; filtro pela peça de origem);
  - novos usuários em 30 dias;
  - custo por convite emitido;
  - teto recalibrado (coortes de ≥ 7 dias);
  - reativação em ordem determinística.
- **Produto:**
  - textos das telas e dos estados;
  - "Exemplo pronto";
  - motivos do descarte;
  - prévia neutra;
  - Qualidade e Plataforma públicas, sem E2E;
  - "Recriar minha demo / vitrine pública";
  - kit travado só com leituras;
  - roteiro;
  - "mudar na hora" com o prompt do kit;
  - "Trocar de lado" para a cópia.
- **Técnica:**
  - `app_config`;
  - CSP só em produção;
  - despacho por segmento;
  - MCP com JSON-RPC escrito à mão;
  - `test_valid_day`;
  - `idScope` e semana anterior no Simular;
  - `SEED_VERSION` 3;
  - juiz fixo da T3 e regra de escolha;
  - kit segue a T3;
  - revisor de um 3º provedor;
  - SIGTERM manual;
  - E2E de produção sem a senha e sem afirmar sobre o texto da IA.

## 14. Mudanças durante a implementação
1. **Semente da vitrine → 20261157 (D146).** A reativação pura no simulador fez a semente antiga dar `inconclusivo` às quintas-feiras. O candidato decidiu trocar a semente. A sugerida (20261124) falhou em outros critérios dos testes (IC contendo +0,20 e folga do teto). Pelo critério completo, ficou a 20261157, a de maior folga entre as 3 de 40 que passam.
2. **T3 em 2 rodadas (D147).** A 1ª rodada mostrou que o marcador `{horario:FAIXA}` do prompt era copiado ao pé da letra; o prompt passou a `{horario:X}` com exemplo (`pacote-v2`/`plano-v2`) e a T3 foi refeita. Vencedor `google/gemini-3.8-flash`, reserva `openai/gpt-6-luna`; o kit segue o vencedor [C]. O juiz também avaliou os 9 pares cegos (prefere a IA em 8); a concordância com a nota do candidato entra em `eval/relatorio-t3.md` quando ele responder.
3. **Kit travado com leituras (S2 #28).** Versão com leituras do QR não aceita edição nem "Regenerar"; "Criar nova versão" aposenta a antiga (o QR dela continua funcionando; a impressão dela some) e cria outra com QR novo. O filtro do funil mostra a versão anterior como "(versão anterior)".
4. **Extras ligados por padrão (D148).** A/B + "promover vencedora", alertas de operação (também no topo do Plano), revisor (deepseek; contas E2E fora), aprende e MCP (Configurações › Agente). Todos com testes; os Bastidores desligam ao vivo.
5. **Operação.** Logger JSON com lista de campos permitidos; SIGTERM manual (`NEXT_MANUAL_SIG_HANDLE=true` no Dockerfile; testado com `node server.js` + `kill -TERM`); specs da S3 no E2E de produção; build com heap de 1 GB: pico de 1,37 GB de memória (antes 1,18 GB), 39 s.
6. **Dívidas fechadas.** Aviso de prato fora da oferta no convite (S2 #31); cartão do garçom na vitrine e nas cópias (S2 #32); ícones na barra lateral, Stepper de 1 linha no celular e placeholder do Validar (S2 #38); `offerFromInput` único (parte da S2 #37). O raio dos botões (S2 #38) não procede: 4 px, igual à captura portal/02.
7. **Dívidas da S3: fechadas depois do merge (D150).** Foto colorida do salão (Commons, CC BY 2.0), modo apresentação a 1280 px, marcador de antecipação, limpezas e limites diários na meia-noite de SP.
