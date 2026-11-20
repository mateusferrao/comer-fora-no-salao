# Revisões independentes do planejamento

Durante o planejamento (19/11/2026), o design passou por **5 revisões feitas por subagentes independentes**, que leram os documentos sem a conversa. Os revisores também são modelos Claude; os achados foram filtrados criticamente antes de virar decisão, e toda mudança em decisões já tomadas passou pelo candidato.

## 1. Revisão "construtor"
Pergunta: o que um construtor ainda precisaria saber para planejar?
- Permissões no Easypanel e política de merges → **decidido:** criar/alterar só o projeto novo; OK geral para merges na `main`.
- Chave e orçamento da OpenRouter → **US$ 10**.
- Referências visuais do Portal → existem (imagens públicas); versionadas no repositório privado em `referencias/` (D76).
- Uso do logo → clone total com aviso (decisão do candidato).

## 2. Revisão crítica geral
Achados principais: processo de planejamento consumindo o tempo de construção; escopo ~50 h contra 15–25 h; conflito entre "mudar na hora" e congelamento; risco de phishing; demo por Meet; build na VPS; métrica com denominador autodeclarado; A/B sem amostra (~355 leituras por versão — conta conferida); fraude com QR fotografado; guardrails por regex; dados (variante, versões, simulação, dedupe, fuso).
- **Aceito:** configuração ao vivo; demo pelo modo apresentação; hipóteses ligadas a funcionalidades; cardápio alimenta o benefício; métrica de voltas + proteção custo × retorno; duas chaves; limite por IP; PII mascarada; ajustes de dados; E2E em produção; planejamento com todas as perguntas, mas construção de uma vez; prioridade com flags.
- **Recusado pelo candidato:** cortar A/B, revisor e "aprende com o dono" (mantidos, com flags); build fora da VPS (mantido no Easypanel); remover logo/login.
- **Cortado:** automação semanal.

## 3. Rodada de 4 revisores especializados

### Técnica — "sim, com ajustes"
Build sem proteção real e deploy sem CI; hostname com "ifood"; fuso UTC e cookie do ensaio; páginas estáticas no build; upload > 1 MB; latência; guardrail de números errado nos dois sentidos; reserva do OpenRouter não cobre JSON inválido; simulação sem modelo de tempo; edição de prompt ao vivo sem proteção; leituras por GET; IP atrás do Traefik; vitrine poluída; documentação contraditória; segurança na VPS compartilhada.
- **Aceito:** praticamente tudo (ver especificação 4.4–4.6), incluindo **deploy só com CI verde** e **portas só nos 5 pontos de variação**.

### Design/UX — "pronto com ajustes"
Ensaio estraga a demo; mecânica do código do dia; campos editáveis + autofill; espera da IA; Visão geral ilegível no Meet; duas "Configurações"; período × métrica principal; entrada com 4 botões; GPS longe do toque; selo "simulado" poluindo; acessibilidade; microcopy; ~15 estados faltando.
- **Aceito:** resetar demo/novo cliente; assistente reordenado; hierarquia da Visão geral; **4 abas + Bastidores**; entrada com 1 + 1 botões; GPS no toque; simulação declarada em 3 níveis; acessibilidade; microcopy; estados; **display e cartaz num modelo só**.
- **Recusado pelo candidato:** login e identificação sem campos (mantidos pré-preenchidos, com `autocomplete="off"`); Portal no celular sem edição/impressão do kit (mantido completo).

### Produto — "acima do esperado; ponto fraco = visão de negócio"
Tese contradita pela recomendação (refazer CRM); métrica não prova o "com isso" (atribuição ≠ causa; ponto de partida de 63%); falta ligação com a meta de usuários; custo × retorno sem fórmula; código do dia depende de quem não engaja; A/B decide por qual etapa; falta dimensionamento; opt-in ligado invalida a taxa de opt-in.
- **Aceito:** campanha como disparo do CRM/Giftback; **holdout de 10%**; métrica de **novos usuários do Comer Fora**; fórmula de custo × retorno; A/B por leitura→check-in; dimensionamento, monetização, custo de IA por restaurante e roadmap em 3 fases para a entrevista.
- **Evoluído pelo candidato:** código do benefício "tipo Duo Gourmet" — **código único por cliente validado pelo garçom**, com a etapa Resgate no funil.

### Aderência ao case e ao iFood — "aderente e acima da média"
Formato da sessão de 23/11; E4 sem projetos reais; phishing; fluxo sem acabamento; IA indisponível sem o candidato; dado real digitado; slide genérico; build na VPS; complexidade alta em mecanismos; trilha Generalist subcoberta.
- **Aceito:** modo sem IA nas 3 tarefas; mini-avaliação da tarefa 1 antes dos extras; construção agêntica como caso Generalist; OpenAPI como prova de "AI-operable"; ambiente local para mudanças de código ao vivo.
- **Decidido pelo candidato:** seguir o formato dos e-mails 1 e 2; projetos reais fornecidos (currículo, portfólio, preparação de People).

## 4. Replanejamento por diferenciação (20/11) — especificação v2
Pergunta do candidato: "qual a grande diferença do que estamos construindo pra aquilo que já existe no Comer Fora? Não vai ficar muito igual?". Houve pesquisa pública e brainstorming e, depois, **4 revisões independentes**:
- **Produto (redesenho):** benefício por turno já existe [O]; métrica inflada por migração; amostra pequena; prazo. → Métrica de visitas e margem incrementais com proteção contra migração; honestidade estatística; divisão código × IA; promessa reescrita (D203, D208, D209).
- **Builder check (v2):** como medir "o que aprendemos" por oferta; quem conta como convidado; o que é "horário vazio"; reativação; convite × plano vigente. → D216–D220.
- **Técnica (v2):** holdout circular e enviesado; janela de 30 dias em 30 dias simulados; 4 estados com Welch; convite congelado; simulador com as mesmas regras; teto atômico; MCP sem cookie; dependência invertida S2/S3. → D216–D219, D223, D224.
- **Produto (v2):** contraste com o print 04 na demo; contaminação do holdout (card antes do check-in, roteiro do garçom); segmento "frequentes do pico" fabricando migração; ativação pesada; garçom no Portal do dono; demo que não cabe em 8 min. → D223 e a seção 5 da especificação. Dois achados não procederam: o revisor leu os arquivos antes do registro de D201+, e o CLAUDE.md já citava `sites`.
- **Recusado pelo candidato:** cortar escopo (D210); MCP só lendo, sem aprovar (D219); planejar S1–S3 de uma vez (D221).
