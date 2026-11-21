# Log da conversa com a IA no planejamento

Registro cronológico de como o planejamento foi conduzido com o assistente de IA (Claude Code, usando a skill de brainstorming do pacote *superpowers*). Serve de base para a parte "Prompts — como conversou com a IA" do slide do processo.

Método: o candidato pediu análise crítica, sem inventar nem assumir informação fora das especificações. A IA fazia uma pergunta por vez, com opções concretas, prós e contras e uma recomendação; o candidato decidia ou pedia aprofundamento.

## 19/11/2026

| # | Pergunta / tema | Resposta do candidato | Efeito |
|---|---|---|---|
| 1 | Leitura de todos os materiais (case, e-mails, Deck de Cultura) | — | Contexto extraído sem suposições |
| 2 | Qual das 4 opções? | Pediu análise crítica de prós e contras de cada uma | Análise comparativa das opções 1–4 |
| 3 | Tempo disponível | ~3 dias parciais | MVP enxuto, 80/20 |
| 4 | Opção | **2 — Restaurante que ganha** | Escolha do problema |
| 5 | Já explorou o app? | Pediu pesquisa aprofundada na internet | Pesquisa pública do Comer Fora (Get In, Tagme, check-in, selos, Portal do Parceiro) |
| 6 | Recorte: dono com salão que não divulga × só delivery × os dois | Pediu explicação detalhada dos fluxos | Fluxos (a), (b), (c) detalhados |
| 7 | Mesmo tema | Questionou se (a) e (b) atendem o enunciado integralmente | Leitura literal do enunciado → recorte (a+) |
| 8 | Fechar (a+)? | Pediu detalhamento de como o enunciado é atendido | Matriz requisito → solução |
| 9 | Fechar (a+) | **Sim** | Escopo de produto fechado |
| 10 | Demo, cardápio, retorno no tempo da demo | Vitrine + sandbox; foto/PDF + exemplos; pediu reexplicação do "retorno" | — |
| 11 | Retorno reexplicado | **Vitrine com histórico + botão "Simular 30 dias"** | — |
| 12 | Identidade visual | Quer usabilidade e visual **idênticos ao iFood**, como extensão do app | Discussão de risco de marca / página falsa |
| 13 | Nível de fidelidade | **Clone total + aviso** | Proteções obrigatórias definidas |
| 14 | Referências visuais | Enviou prints do app e imagens públicas do Portal | Padrões de tela e regras reais do check-in/selos extraídos |
| 15 | QR como prova de presença? | Pediu olhar crítico ("precisa disso tudo?") | QR só divulga e atribui; antifraude fora |
| 16 | GPS | **Validar de verdade, sem bloquear, igual ao app** | Check-in com GPS não bloqueante; só o status é guardado |
| 17 | Stack | Propôs a própria VPS com Easypanel | Análise de prós/contras da VPS |
| 18 | Modelos de IA | Quer código desacoplado e um modelo por tarefa, com levantamento crítico e não enviesado (Gemini, DeepSeek, Kimi etc.) | Levantamento de preços/capacidades; a IA declarou conflito de interesse (é um dos candidatos) |
| 19 | Como escolher modelos / como acessar | **Mini-avaliação medida**; **OpenRouter** | — |
| 20 | VPS | Enviou prints; depois liberou o conector Easypanel | Consulta de leitura: recursos e domínio padrão |
| 21 | Build e domínio | **Easypanel builda a cada push na `main`**; **domínio gerado** | — |
| 22 | Revisão independente do design (subagente "construtor") | — | 4 lacunas; 2 resolvidas com decisões já tomadas |
| 23 | Permissões e orçamento | Pode criar só o projeto novo no Easypanel, OK geral para merges até 22/11; **US$ 10** na OpenRouter | — |
| 24 | Aprovação do design | Pediu que o planejamento siga parte por parte, com commit/push na `main` a cada parte, incluindo produto, técnica, arquitetura, infra, system design | Estrutura `docs/planejamento/` com índice de partes |
| 25 | Materiais | Pediu versionar o case, o Deck de Cultura e os e-mails | `docs/contexto/` |
| 26 | Novo e-mail: convite da entrevista técnica (23/11, 17h) | — | Janela real até a manhã de 23/11; parte E4 criada |
| 27 | Trilha (AI Engineer Builder × Generalist)? Solução simples demais? | Cobrir as duas; pediu pesquisa de cases de outros candidatos | Nenhum relato público de aprovados; 1 repo de candidato analisado (sem demo, métrica ou testes) |
| 28 | Aprofundamentos de IA | (a) aprende com o dono, (b) A/B, (d) automação; MCP fora; **ênfase em segurança, validação, observabilidade e agente revisor** | Guardrails em 5 camadas |
| 29 | P1: cockpit lado a lado como entrada | Questionou: "não fica mais demo do que solução pronta?" | Produto primeiro; modo apresentação escondido; tudo responsivo |
| 30 | Langfuse auto-hospedado | Aceitou Langfuse Cloud depois de ver os requisitos (≈11 CPUs/25 GB) contra a VPS (2 núcleos/2,2 GB livres) | — |
| 31 | Revisão crítica geral (subagente) | Planejamento com todas as perguntas, mas construção de uma vez; 15–25 h; build continua no Easypanel; só a automação sai; correções aceitas; visual mantido | Prioridade com flags |
| 32 | P2–P8 detalhados | Questionou mocks ("podemos fazer mocks numa solução pronta?"); manteve "importar do delivery" rotulado; opt-in ligado como no app; pediu reexplicação de horário/vitrine | Princípio da simulação declarada; aberto/fechado só informativo |
| 33 | T1–T9 | Pediu análise crítica de arquitetura e de boas práticas no modelo de dados; todos os modelos só via OpenRouter; congelamento às 15h; slide em PPTX; repo público limpo | Monólito modular com portas; 4 melhorias no modelo de dados |
| 34 | Rodada de 4 revisores independentes (técnica, design, produto, aderência) | Aceitou deploy só com CI verde, 4 abas + Bastidores, nova prioridade, portas nos 5 pontos, modelo único de peça; manteve campos pré-preenchidos e Portal completo no celular; propôs código "tipo Duo Gourmet" | Código único validado pelo garçom; etapa Resgate no funil |
| 35 | E4 | Enviou currículo, portfólio e preparação da entrevista de People | Ganchos do case com projetos reais; inconsistência "semanal × quinzenal" apontada |
| 36 | Fechamento | Plano aprovado; especificação única consolidada | Construção começa pela S0 |
| 37 | Plano de implementação por fatias (skill writing-plans) | Pediu divisão de todo o escopo em fatias testáveis, em arquivo detalhado | `plano-implementacao.md` com S0–S4 |
| 38 | Método de execução e skills | Perguntou "e a questão das skills?"; escolheu instalar o superpowers e executar de forma nativa (prazo) | D06, D07 |
| 39 | Fluxo por fatia | Definiu 3 skills do projeto (planejar com discussão crítica, implementar com regras, revisar com subagentes em todas as frentes) e pediu registro detalhado de todas as decisões e trade-offs | D05, `decisoes-e-tradeoffs.md` |
| 40 | Revisão | 4 revisores; correções direto pela implementação; sem limite de tempo; exigiu verificação E2E profunda pela própria IA simulando uso real em todos os casos | D08–D11 |
| 41 | Git, ambiente e evidências | Branch da sessão com merge na `main` por fatia; E2E local e em produção; evidências no repo privado | D12–D14 |
| 42 | Transparência | Perguntou se as decisões estavam sendo anotadas e publicadas; resposta: anotadas no plano local, parte ainda não publicada por causa do modo de planejamento; publicadas em seguida | — |
| 43 | Instalação do superpowers e criação das 3 skills do projeto | — | D72, D73; skills carregadas na sessão |
| 44 | Testar as skills antes de usar? Chaves agora? | Sem teste de pressão (usar e ajustar); chaves só quando a S0 precisar | D74, D75 |
| 45 | Início da S0 | Pediu pausar e deixar tudo commitado na `main` antes do planejamento da S0 | Planejamento da S0 começa na próxima sessão de trabalho |
| 46 | Planejamento da S0 (skill `planejar-fatia`), nova sessão | Pediu planejar de ponta a ponta por perguntas críticas, sem inventar nada | Leitura completa + checagem do ambiente, das versões publicadas e do Easypanel (só leitura) |
| 47 | Branch fixo antigo; prints ausentes; push na `main` no meio da S0 | Branch da sessão; **versionou os prints no repo privado** (D76); exceção só para o esqueleto | D77, D78 |
| 48 | Design system: escopo, vermelho (4,46:1), logo, fonte | Base na S0; cor exata + texto grande; SVG + texto; **indicou designmd.app** para a fonte | D79–D82 (1ª versão) |
| 49 | Chaves e Langfuse | Config. do ambiente + sessão nova; conta nova EU; 2 chaves; segredos internos pela IA | D83–D86 |
| 50 | Proteções da URL e CI | noindex já na S0; **sem Search Console**; audit só "critical"; **sem limites na VPS** ("posso pausar serviços"); E2E bloqueia deploy | D87–D91 |
| 51 | Aprovação do plano | **Recusou aprovar sem revisão independente** por 2 subagentes (back+front e produto) e pediu que isso virasse regra da skill | D95 |
| 52 | Revisão independente | Técnica: 5 bloqueantes (ex.: `generateObject` obsoleto no AI SDK 7, Langfuse precisa de outra integração, migração rodaria no build). Produto: vermelho e logo baseados em premissa errada | Fatos conferidos pela IA antes de levar ao candidato |
| 53 | Decisões reabertas com evidência | Tokens medidos (`#E71C2B`/`#D72E3B`/`#EF5652`); **só o logo iFood**; manteve D88 e D85; barra em 2 linhas no celular; galeria pública com logo; "/" com logo; **sem linha de corte** | D80/D81 revisadas, D92–D94, D96; plano aprovado |
| 54 | Candidato cadastrou as chaves no ambiente e conectou o MCP OpenRouter | A IA viu que as variáveis só valem numa sessão nova e, pelo MCP, que a conta estava **sem crédito**; o candidato vai comprar os US$ 10 e liberou o MCP para consulta + testes de prompt | D97–D99 |
| 55 | "Qual a grande diferença do que estamos construindo pra aquilo que já existe? Não vai ficar muito igual?" | Pediu leitura crítica; a IA fez pesquisa pública e mostrou que ~metade do escopo replicava o existente | D201 (H5), D202 |
| 56 | "Será que não é melhor replanejar pra se diferenciar mais? O que o material do iFood pede?" | Escolheu replanejamento focado em diferenciação e percepção de valor, nesta sessão | Brainstorming de produto |
| 57 | Momento de valor, mecânica, plano da semana, cortes, métrica | **Encher horário vazio**; agora + convite; sistema propõe e dono aprova; **"não só IA, também análise de dados"**; Avaliar sai, Clientes vira segmentos | D203–D210 |
| 58 | Revisão independente de produto do redesenho (pedida pelo candidato) | Aceitou métrica sem migração, intervalo honesto, convite por regra + plano, código decide e IA convence; manteve todo o escopo | D204–D210 |
| 59 | "Faz sentido IA nesse fluxo? Tô com dúvida se impressiona" | A IA respondeu com crítica honesta (o risco é excesso de mecanismo, não falta de IA); o candidato escolheu ativação "uau", ciclo que aprende e MCP | D211, D212 |
| 60 | "Faz sentido LangGraph/LangChain? Seja crítico" | Concordou com não adotar e pediu registro | D215 |
| 61 | Builder check + revisões técnica e de produto da v2 | Pediu explicação mais clara do holdout e trouxe a ideia de roleta; escolheu intenção de tratar + fantasma, janela de 14 d com vitrine de 60 d, convite congelado, código decide o veredito; **manteve o ritual completo por fatia** e **MCP podendo aprovar** | D216–D224 |
| 62 | Implementação da S0 (sessão paralela, 19/11) | Easypanel recusou o projeto novo (limite de 3); escolheu criar os serviços dentro do projeto `sites` | D100 |
| 63 | Fim da implementação da S0 (20/11) | Pediu autonomia total da IA depois do planejamento aprovado até o fim da revisão e dos testes; registrado nas instruções e skills, não no plano | D101 |
| 64 | Revisão da S0 (autônoma, D101) | 4 revisores + E2E da IA; 5 achados altos corrigidos (rastro com arquivos, health sem migração, Button carregando, memória do build, contrato de IA); webpack e migrações aditivas | D102, D103 |
| 65 | Merge da S0 e verificação em produção | `9cd22c1` no ar; 24/24 E2E contra produção; cabeçalhos e 404 conferidos | — |
| 66 | Planejamento da S1 (skill `planejar-fatia`) | A IA achou que a vitrine com ~70/semana não sustentava o IC > 0 (Monte Carlo); o candidato escolheu ~200/semana, segredos gravados pela IA, telefone sem validação (de propósito), fotos de banco livre, cantina italiana, restaurante E2E oculto, **sem corte**; perguntou "e se na demo eu cair no holdout?" e escolheu assumir e explicar ao vivo | D104–D113 |
| 67 | Implementação e revisão da S1 (autônomas, D101) | 4 revisores + E2E da IA: 1 crítico (telefones repetidos derrubariam o seed numa terça) e 9 altos corrigidos (oferta do convite congelada, telefone com nome, PII fora dos logs, barra nos sheets, E2E do cliente em produção…) | D114–D116 |
| 68 | Planejamento da S2 (skill `planejar-fatia`, "crítico e detalhista") | O candidato questionou a conta demo compartilhada ("por que um terceiro entra na conta de outro?") e levou a decisão a login por e-mail real via AWS SES, mesmo depois de ouvir os riscos; pediu tudo editável depois da IA; propôs converter PDF em imagem e testar OCR antes da IA; trouxe o Google Vision; escolheu os modelos da T1. A revisão independente achou 1 bloqueante técnico (a cópia da vitrine repetiria os UUIDs do simulador) e 3 de produto (antiphishing/sem plano B → link do avaliador) | D117–D130 |
| 69 | Implementação e revisão da S2 (autônomas, D101) | T1 medida (gemini-3.1-flash-lite vence; OCR só como linha de base). Na revisão, a E2E com IA real achou 2 críticos que os testes não viam (chave com aspas curvas derrubava toda a IA; kit sempre sem IA por tamanho) e a justificativa da IA com números soltos; 4 revisores somaram 10 altos, todos corrigidos. O candidato pediu de novo o teste com a foto real (2/2 itens pelo produto) e propôs usar um domínio de envio já verificado, resolvendo o bloqueio do SES sem DNS | D131–D135 |
| 70 | Planejamento da S3 (skill `planejar-fatia`) | O candidato escolheu fazer tudo com 1 merge (recusou 2 merges e depois o gatilho de contingência), pediu a T3 com juiz de IA **e** a própria nota cega, quis o tom da IA também por restaurante, e aceitou que "Antecipar" encaixe o horário no sandbox | A leitura do código achou que "Antecipar 1 dia" sozinho não fecha a volta (faixa). Os 2 revisores do plano acharam 6 bloqueantes (simulação do teste com ids repetidos e teto gasto, reativação fora da intenção de tratar e diferente do simulador, roteiro invisível para quem entra pelo link, plano fixo rotulado como IA, veredito do seed escrito à mão); 4 voltaram ao candidato (D142–D144), o resto entrou como [C] |
| 71 | Implementação e revisão da S3 (autônoma, D101) | Sem intervenção durante a execução; a nota cega da T3 ficou pedida ao candidato | A T3 achou um marcador ambíguo no próprio prompt (`{horario:FAIXA}`) e virou correção; a E2E profunda com IA real achou o revisor bloqueando plano bom (oferta pelo título genérico e números do código nas justificativas) — medido com IA real e corrigido (D149: 0 de 10 bloqueados); os 4 revisores acharam MCP sem revisor, deadlock aprovar × check-in, semana do plano aprovado, tempo negativo na página pública e o plano da vitrine contradizendo o veredito, todos corrigidos com teste |
| 72 | Dívidas da S3 ("corrija as dívidas") | Escolheu tentar de novo o Wikimedia Commons para a foto colorida do salão (em vez de gerar com IA ou mandar uma foto) | A API do Commons seguia bloqueada daqui; a busca pelas páginas achou candidatas, conferidas no olho antes do uso (a 1ª era a mesma foto atual; a 2ª, um diner com neon e rua) |
| 73 | Nota cega da T3 (D137) | Pediu os pares como perguntas no chat, com as frases nas opções, e pontuou os 9 às cegas: IA em 8 de 9 | Concordância com o juiz de IA: 7 de 9 (κ 0,55); a escolha do modelo (D147) se manteve |

## Comportamentos de IA que o candidato corrigiu ou direcionou
- Pediu análise mais crítica em vez de aceitar a primeira recomendação (itens 2, 6, 7, 8, 15).
- Pediu pesquisa externa em vez de suposições sobre o app (item 5).
- Pediu levantamento não enviesado de modelos, inclusive de concorrentes do assistente (item 18).
- Recusou a "aprovação final" prematura do design e exigiu detalhamento por partes (item 24).
- Questionou a primeira recomendação de entrada (cockpit) como "mais demo do que produto" (item 29) e o uso de mocks numa solução pronta (item 32).
- Exigiu revisões independentes em várias frentes antes de aprovar (itens 31 e 34) e manteve decisões próprias quando discordou dos revisores.
- Evoluiu a mecânica antifraude proposta pela IA com uma referência de mercado ("tipo Duo Gourmet", item 34).
- Resolveu um bloqueio da IA por conta própria (versionou os prints) e trouxe uma fonte de tokens da marca (itens 47–48).
- Exigiu revisão independente antes de aprovar o plano da S0 e transformou isso em regra do processo (item 51); a revisão derrubou 2 decisões de design baseadas em premissas erradas da IA (item 53).
- Manteve decisões próprias de risco (sem Search Console, sem limites na VPS, sem 3ª chave) depois de ver a evidência contrária (itens 50 e 53).
- Questionou a diferenciação do produto inteiro no meio da construção e forçou um replanejamento com pesquisa e 4 revisões (itens 55–61); pediu explicação mais simples quando a proposta estatística ficou técnica demais (item 61) e trouxe ideias próprias (roleta), avaliadas criticamente.
| 74 | "Replanejamento com foco em valor para o dono e conversão; tirar tudo de teste/simulação; skill de copywriting; seja crítico" — e "sinto pouca inovação, resultado e técnica" | Fatias novas S4 (produto real e identidade), S5 (valor e conversão), S6 (IA que opera); entregáveis viram S7. Login do cliente por e-mail + código, tudo por e-mail com agendador, agente com ferramentas decidido por número, 1 merge. 2 revisores independentes; bloqueantes levados de volta ao candidato | D151–D169 |
| 75 | "Não é pra começar a implementar nenhuma fatia ainda. Primeiro registrar tudo." / "Vamos planejar uma a uma quando formos fazer" | Implementação suspensa (S4.1 ficou no branch); registros completados; S5, S6, S7 planejadas na vez de cada uma | D170 |
