# Registro de decisões e trade-offs

Todas as decisões do projeto, com alternativas consideradas, trade-offs, motivo e quem decidiu. Atualizado a cada decisão nova (as skills do projeto exigem isso).

**Quem decidiu:** **U** = candidato (usuário) · **IA** = proposta do assistente aceita pelo candidato · **IA [C]** = decisão do assistente ainda não contestada, aberta a correção · **Rev** = veio de uma revisão independente e foi aceita pelo candidato.
**Status:** ✅ vigente · 🔁 substituída (indica por qual) · ❌ descartada.

---

## A. Processo e forma de trabalho

**D01 — Planejar com brainstorming crítico por perguntas antes de construir** (19/11, U) ✅
- Alternativas: começar a construir com um escopo enxuto; planejar sozinho e só pedir aprovação.
- Trade-off: mais tempo de planejamento × menos retrabalho e escolhas defensáveis na entrevista.
- Motivo: o case avalia diagnóstico, raciocínio e domínio das escolhas; o candidato quis discutir tudo de ponta a ponta, sem nada inventado.

**D02 — Planejamento parte por parte com commit por parte** (19/11, U) 🔁 D03
- Trade-off: rastreabilidade máxima × ciclo lento.

**D03 — Todas as perguntas com discussão crítica, mas construção de uma vez, ao final** (19/11, U) ✅ (refinada por D05)
- Alternativas: parte por parte (D02); congelar o planejamento em 90 min (sugestão da revisão).
- Trade-off: profundidade de planejamento × tempo de construção (a revisão estimou 10–14 h consumidas pelo ciclo parte a parte).
- Motivo: manter o rigor das decisões sem o custo do ciclo de commit por parte.

**D04 — Revisões independentes por subagentes em vários momentos** (19/11, U) ✅
- 1 revisão "construtor", 1 revisão crítica geral e 1 rodada de 4 revisores especializados (técnica, design/UX, produto, aderência). Ver [revisoes.md](revisoes.md).
- Trade-off: tempo e custo de contexto × achados que mudaram métricas, guardrails, fluxo e infraestrutura.
- Observação: os revisores também são modelos Claude; os achados passam pelo filtro crítico do assistente e pela decisão do candidato.

**D05 — Fluxo por fatia com 3 skills do projeto: planejar → implementar → revisar** (19/11, U) ✅
- `planejar-fatia`: leitura completa do contexto e das especificações, análise profunda e discussão crítica por perguntas em todas as frentes, sem assumir nada; saída aprovada pelo candidato.
- `implementar-fatia`: todas as regras de implementação; só implementa o que o planejamento aprovou; dúvida → para e pergunta.
- `revisar-fatia`: 4 revisores independentes + **verificação E2E profunda feita pela própria IA** simulando uso real.
- Alternativas: planejar tudo uma vez e só implementar; revisar só no fim do projeto.
- Trade-off: mais tempo por fatia × qualidade e aderência verificadas antes de seguir.
- Motivo: o candidato quer rigor crítico em cada etapa e controle sobre cada decisão.

**D06 — As skills do projeto usam o pacote superpowers** (19/11, U) ✅
- Alternativas: skills autossuficientes; as duas coisas.
- Trade-off: menos texto repetido e práticas já consolidadas (TDD, verificação antes de concluir, debugging sistemático) × dependência do pacote instalado no repositório.

**D07 — Execução nativa (`executing-plans`) em vez de um subagente por tarefa** (19/11, U) ✅
- Alternativa: `subagent-driven-development` (subagente novo por tarefa + revisor antes da próxima).
- Trade-off: menos isolamento por tarefa × velocidade e custo menor; as tarefas dependem muito das interfaces umas das outras.
- Motivo: **prazo** (construção até 23/11 às 15h, ~32 tarefas). A revisão independente fica no fim de cada fatia (D08).

**D08 — Revisão com 4 revisores independentes** (19/11, U) ✅
- Frentes: aderência ao case e ao iFood (requisitos, regras, critérios, cultura, valores, AI-first, negócio) · técnica e arquitetura · produto e design/UX · segurança, IA e qualidade.
- Alternativa: 6–7 frentes separadas.
- Trade-off: menos subagentes (tempo/custo) × frentes um pouco mais amplas por revisor.

**D09 — Verificação E2E profunda pela IA dentro da revisão** (19/11, U) ✅
- Navegador real (Chromium/Playwright), todas as personas (dono demo, dono novo, cliente, garçom, avaliador sozinho), todos os casos da fatia, 390/768/1280 px, capturas comparadas com as referências, acessibilidade automática, erros de console e rede, tempos, IA forçada a falhar, relógio fixo no dia da demo; matriz de cenários com veredito.
- Trade-off: tempo × confiança de que o fluxo roda "do começo ao fim, sem depender do candidato" (critério 2 do case).

**D10 — Correções aprovadas da revisão vão direto pela implementação** (19/11, U) ✅
- Só voltam ao planejamento se mudarem decisão de produto ou de arquitetura.
- Alternativas: sempre pelo planejamento; repetir a revisão após corrigir.
- Trade-off: velocidade × risco de correção sem nova revisão (mitigado pela regra de volta ao planejamento).

**D11 — Sem limite de tempo por fase** (19/11, U) ✅
- Alternativa: ~45 min de planejamento e ~30 min de revisão por fatia.
- Trade-off: profundidade máxima × risco de faltar tempo; o corte acontece pelas flags (D57).

**D12 — Git: commits por tarefa no branch da sessão; merge na `main` só ao fim da fatia, após revisão aprovada** (19/11, U) ✅
- Documentos de planejamento vão para a `main` na hora.
- Alternativas: push na `main` por tarefa; merge antes da revisão.
- Trade-off: 1 deploy por fatia (menos builds na VPS compartilhada) × produção atualizada só no fim da fatia.

**D13 — E2E da revisão local e em produção** (19/11, U) ✅
- Completa no local antes do merge; caminho feliz e casos críticos de novo no link público depois do merge.

**D14 — Evidências da revisão no repositório privado** (19/11, U) ✅
- `docs/fatias/SX/revisao/` (relatório + capturas), fora da cópia pública; servem ao slide e à entrevista.

**D15 — Documentos do contexto e pessoais versionados só no repositório privado** (19/11, U) ✅
- Case, Deck de Cultura e e-mails em `docs/contexto/`; currículo e preparação de People em `docs/pessoal/`. Prints do Easypanel **fora do git** (IP da VPS e serviços do candidato). Prints do app e do Portal: ver D76.

**D72 — Superpowers instalado em `.claude/skills/`, sem a skill `diagnosing-superpowers`** (19/11, IA [C]) ✅
- Motivo: o pacote foi revisado antes de copiar (zip tratado como dado); a `diagnosing-superpowers` publica relatórios de sessão como issues no GitHub do autor do pacote — enviaria informação da sessão para fora e não é necessária. Licença MIT preservada em `.claude/skills/SUPERPOWERS-LICENSE`.

**D73 — Nomes e estrutura das 3 skills do projeto** (19/11, IA [C]) ✅ (planejar-fatia ganha a revisão independente do plano: D95)
- `planejar-fatia` (+ template do planejamento), `implementar-fatia` (+ `regras.md` com todas as regras de implementação), `revisar-fatia` (+ prompts dos 4 revisores, roteiro da verificação E2E e template da revisão). `CLAUDE.md` na raiz aponta o fluxo.

**D74 — Skills do projeto sem teste de pressão prévio; ajustadas no uso real** (19/11, U) ✅
- Alternativas: teste leve (1 cenário por skill); teste completo do writing-skills (linha de base + iterações).
- Trade-off: risco de brechas nas skills × tempo de construção; falhas encontradas no uso viram correções nas skills, registradas aqui.

**D75 — Chaves (OpenRouter pública e demo; Langfuse) pedidas só quando a S0 precisar** (19/11, U) ✅
- Por formulário seguro da sessão, nunca no chat.

**D76 — Referências visuais versionadas no repositório privado** (19/11, U) ✅ (substitui a parte de D15 sobre prints do app e do Portal)
- `referencias/app/` (16 prints do app tirados pelo candidato) e `referencias/portal/` (5 imagens públicas do Portal do Parceiro); prints do Easypanel continuam fora.
- Alternativa: manter fora do git (D15). Trade-off: os prints têm dados reais (nome e endereço do candidato, restaurantes reais) × referência visual disponível para quem implementa e revisa, em qualquer sessão.
- Mitigação: repositório privado; só referência de layout (nunca usar no produto); `referencias/` excluída da cópia pública (D69).

---

## B. Problema, escopo e produto

**D16 — Opção 2 do case: "Restaurante que ganha"** (19/11, U) ✅
- Alternativas: 1 primeira experiência; 3 decisão em grupo; 4 projeto próprio.
- Trade-off: menos "uau" que a opção 3 × mais âncoras numéricas no briefing, usuário e valor de negócio claros, ciclo QR → painel demonstrável.

**D17 — Recorte (a+): dono com salão, fluxo integral Entrar → Divulgar → Retorno atribuído** (19/11, U) ✅
- Alternativas: (a) só quem já está no Comer Fora; (b) só delivery; (c) os dois em sequência.
- Motivo: leitura literal do enunciado — "divulgar no salão" pressupõe salão; "com isso" exige atribuição; "entrar" = aderir (interpretação declarada). Tira o que era frágil em (b): estimativa de potencial inventada e convite a clientes de delivery.

**D18 — Tese: falta o início do funil no salão; o cliente na mesa é anônimo** (19/11, IA) ✅
- Base: só 20% divulgam [B]; check-in, selos, CRM e Giftback já existem [P][B]; Comer Fora a 2 toques da home [O].

**D19 — Hipóteses H1–H4 ligadas a funcionalidades** (19/11, Rev) ✅
- H1 falta material → kit; H2 dono não vê retorno → atribuição e holdout; H3 equipe não engaja → cartão do garçom e validação; H4 custo assusta → regras e custo × retorno.
- Motivo: o briefing não diz por que 80% não divulgam; declarar hipóteses e medir é mais honesto que afirmar.

**D20 — Demo com restaurante vitrine + restaurante de teste por visitante** (19/11, U) ✅
- Alternativas: só vitrine; login real.
- Trade-off: mais lógica de sessão × painel cheio na hora e "entrar" testável do zero, sem cadastro.

**D21 — Cardápio por foto/PDF + 3 exemplos + "importar do delivery" simulado e rotulado** (19/11, U) ✅
- Alternativas: texto colado; só exemplos; remover o "importar".
- Trade-off: mais um caminho simulado × mostra o caminho de produção, com o motivo explícito ("o case proíbe dados reais/internos").

**D22 — Princípio da "simulação declarada"** (19/11, IA) ✅
- Tudo que é simulado tem rótulo e aparece em "Como este protótipo funciona"; o que é real (IA ao vivo, GPS, check-in, resgate, banco, regras, funil) é dito também.
- Motivo: responder de antemão "o que aqui é de verdade?" e não esconder mocks.

**D23 — Retorno no tempo da demo: vitrine com histórico + "Simular 30 dias"** (19/11, U) ✅
- Alternativas: só vitrine; só o botão.
- Motivo: o avaliador fecha o ciclo no restaurante que ele criou.

**D24 — QR só divulga e atribui; antifraude por QR fora** (19/11, U) ✅ (antifraude resolvida por D27)
- Alternativa: QR como prova de presença.
- Motivo: nenhum critério premia antifraude complexa; QR-prova-de-presença fica no roadmap.

**D25 — GPS real e não bloqueante, igual ao app; só o status vai ao servidor** (19/11, U) ✅
- Alternativas: simulado; bloqueante.
- Trade-off: o aviso "longe" aparece sempre na demo remota × fidelidade ao app e privacidade (coordenada nunca guardada).

**D26 — Benefícios com a taxonomia real e regras que espelham o app** (19/11, U) ✅
- 5 tipos de 1ª visita com item vindo do cardápio; cartela de 6 selos, 1 check-in/dia, 90 dias, só no local; teto de 50% [C]; consumo mínimo com alerta > 2× preço médio [C]; horários ociosos; 1 benefício de 1ª visita por cliente; benefício versionado.

**D27 — Código de resgate "tipo Duo Gourmet": único por cliente, validado pelo garçom** (19/11, U) ✅ (substitui o "código do dia")
- Alternativas: código do dia mostrado na tela; garçom diz e cliente digita.
- Trade-off: mais uma tela (~1,5 h) × antifraude real, etapa "Resgate" no funil, custo × retorno real e H3 medida.
- Selo conta no check-in; benefício e recompensa só após validação.

**D28 — "Aberto/fechado" só informativo** (19/11, IA) ✅
- Motivo: nos prints, o app seguiu para o GPS com a loja fechada; não supor um bloqueio que não vimos.

**D29 — Benefício da vitrine inclui segunda à tarde/noite** (19/11, IA) ✅
- Motivo: a sessão é segunda às 17h; sem isso, a demo cai em "fora do horário" e não mostra o código.

**D30 — Opt-in de comunicação ligado por padrão, igual ao app** (19/11, U) ✅
- Alternativa: desligado com escolha explícita (LGPD).
- Trade-off: fidelidade ao app × consentimento ativo; registrado como risco ("em produção, consentimento ativo"); taxa de opt-in não é exibida.

**D31 — Identificação e login com campos pré-preenchidos** (19/11, U) ✅
- Alternativa (revisão de design): cartão "Você está como … (fictícia)" sem campos; login como texto + botão.
- Trade-off: fidelidade ao combinado × risco de autofill com dado real e aparência de phishing; mitigado com `autocomplete="off"`, DDD 00 fictício, aviso e `noindex`.

**D32 — Métricas: árvore com topo "novos usuários do Comer Fora", principal "voltaram em 30 dias", holdout de 10% e proteção custo × retorno** (19/11, Rev) ✅ (substitui "% identificados" como principal)
- Motivo: atribuição ≠ causa; ponto de partida público de 63% de volta; ligação com a meta 2,5 → 5 mi; denominador autodeclarado é fraco.

**D33 — Campanha como disparo do CRM/Giftback que já existe** (19/11, Rev) ✅
- Motivo: a recomendação não pode contradizer a tese ("refazer o CRM"); destaque às ações exclusivas (peça, equipe, benefício).

**D34 — A/B completo com status honesto** (19/11, U) ✅
- 2 versões por peça com QR próprio; decide só por leitura→check-in; "sem vencedora ainda" até ~356 leituras por versão; promover só com amostra.
- Trade-off: custo de construção × aprendizado agregado na plataforma (visão de negócio).

**D35 — "Aprende com o dono" mantido, restrito ao próprio restaurante** (19/11, U + Rev) ✅
- Alternativa: só registrar edições.
- Trade-off: efeito pouco visível na demo × loop de feedback da cultura; restrição evita contaminar prompts entre visitantes.

**D36 — Automação semanal cortada** (19/11, U) ❌ (o plano da semana de D206 é sob aprovação do dono, não automação)
- Motivo: menor valor relativo no prazo; a recomendação sob demanda cobre o caso.

**D37 — MCP fora do protótipo (roadmap)** (19/11, U) 🔁 D212 (MCP volta, último na fila)
- Trade-off: menos cobertura "AI-operable" × tempo; API-first e OpenAPI deixam o caminho pronto; o candidato já fez MCP em produção (resposta forte na entrevista).

**D38 — Entrada "produto primeiro" com modo apresentação escondido; tudo responsivo** (19/11, U) ✅
- Alternativas: página de escolha; direto no Portal; cockpit lado a lado como entrada.
- Motivo: o candidato apontou que o cockpit seria "mais demo do que produto"; entrada com 1 botão principal + 1 secundário (Rev).

**D39 — Painel com 4 abas + "Bastidores"** (19/11, Rev) ✅
- Visão geral · Kit · Clientes · Configurações; Qualidade da IA, Configurações do protótipo e Como funciona nos Bastidores.

**D40 — Portal completo também no celular** (19/11, U) ✅
- Alternativa (revisão): sem edição/impressão do kit no celular. Trade-off: mais trabalho de interface × responsividade total pedida.

**D41 — Display e cartaz como um único modelo em 2 tamanhos** (19/11, Rev) ✅

**D42 — Clone visual total do iFood, com logo e barra de protótipo** (19/11, U) ✅
- Alternativas: extensão fiel sem logo; identidade própria.
- Trade-off: imersão "extensão do app" × risco de marca/phishing; mitigado por barra fixa, `noindex`, nome neutro no domínio e nenhum dado real (Search Console removido por D88).

---

## C. Técnica e arquitetura

**D43 — Next.js (TypeScript) num só projeto** (19/11, IA) ✅
- Alternativas: Python/FastAPI + React separados; gerador de app (Lovable/Bolt).
- Trade-off: um deploy e visual fiel × nenhum; Python separado dobraria deploys na VPS; gerador de app reduz o controle e o "mudar na hora".

**D44 — Monólito modular por domínio com portas e adaptadores; fronteiras verificadas no CI** (19/11, U) ✅
- Alternativas: pastas por camada; front + back separados; microsserviços.
- Trade-off: algumas horas de estrutura × desacoplamento real e extensibilidade; filas, framework de DI e CQRS ficam fora de propósito.

**D45 — Portas só nos 5 pontos de variação** (19/11, Rev) ✅
- IA, fonte do cardápio, canal de campanha, relógio, repositório principal.

**D46 — Modelo de dados com 4 melhorias** (19/11, U) ✅
- Cliente global + relação por restaurante; PII em tabela separada; simulação por rodada; benefício polimórfico com contrato por tipo. Mais: versões imutáveis, eventos append-only, UTC + dia em SP, isolamento por restaurante, migrações versionadas.

**D47 — Relógio como porta e fuso de São Paulo explícito** (19/11, Rev) ✅
- Motivo: container em UTC erraria dia e turno na demo das 17h; teste fixo para 23/11 17h10.

**D48 — Painel por polling (~3 s)** (19/11, IA [C]) ✅
- Alternativa: tempo real. Trade-off: atraso de segundos × simplicidade.

**D49 — Leituras registradas por beacon no navegador, com deduplicação** (19/11, Rev) ✅

**D50 — Fotos de cardápio nunca guardadas; redimensionadas no navegador** (19/11, IA + Rev) ✅

---

## D. IA

**D51 — Um modelo por tarefa, escolhido por mini-avaliação medida** (19/11, U) ✅
- Alternativas: um modelo só; escolher pela shortlist sem testar.
- Motivo: decisão por número; o assistente (Claude) é parte interessada e declarou o conflito.

**D52 — Todos os modelos só via OpenRouter** (19/11, U) ✅
- Alternativa: Vercel AI SDK com chaves por provedor.
- Trade-off: taxa de ~5,5% nos créditos e mais um intermediário × uma chave, troca e reserva entre modelos.

**D53 — Vercel AI SDK + `@openrouter/ai-sdk-provider`; laço de reserva no nosso código** (19/11, IA + Rev) ✅
- Motivo: a lista `models` do OpenRouter só troca em erro do provedor, não em JSON inválido.

**D54 — Guardrails em 5 camadas** (19/11, U) ✅
- Contrato (Zod) → regras fixas com **referências** (`{fato:…}`, `{prato:…}`, `{beneficio}`) e palavras proibidas → revisor de outro provedor → aprovação do dono → observabilidade.
- Substitui a proibição cega de dígitos (Rev): bloqueava "Pizza 4 queijos" e deixava passar "metade do preço".

**D55 — Revisor assíncrono, bloqueia só em problema grave** (19/11, U + Rev) ✅

**D56 — Modo sem IA nas 3 tarefas e cache das extrações de exemplo** (19/11, Rev) ✅
- Motivo: o fluxo precisa funcionar sem o candidato e sem crédito (critério 2).

**D57 — Construção por prioridade com flags** (19/11, U) ✅
- Ordem: fluxo integral → guardrails → modo sem IA → mini-avaliação T1 → E2E em produção → A/B → revisor → aprende com o dono. O que não estiver pronto e testado na noite de 22/11 fica desligado.

**D58 — Prompts editáveis ao vivo, no banco, só o bloco de instruções/tom** (19/11, IA + Rev) ✅
- Alternativa: gerenciador de prompts do Langfuse. Trade-off: menos recursos prontos × demo sem depender de serviço externo; "testar com exemplo" e voltar versão.

**D59 — Langfuse Cloud (plano gratuito) para rastreio** (19/11, U) ✅
- Alternativas: Langfuse auto-hospedado; rastreio próprio.
- Motivo: o auto-hospedado pede ≈ 11 CPUs e 25 GB (docs oficiais) contra 2 núcleos e 2,2 GB livres na VPS. Rastros só com dados fictícios e sem PII.

**D60 — Duas chaves OpenRouter e limites por visitante, IP e global; orçamento US$ 10** (19/11, U + Rev) ✅ (tetos e uso em desenvolvimento: D85)

---

## E. Infraestrutura e deploy

**D61 — VPS do candidato com Easypanel, projeto isolado** (19/11, U) ✅
- Alternativa: Vercel + Supabase. Trade-off: risco compartilhado com 33 serviços de produção × sempre ligado, sem pausa de plano gratuito, controle total.
- Permissão: criar e alterar **só o projeto novo**.

**D62 — Build no Easypanel (não no GitHub Actions)** (19/11, U) ✅
- Alternativa: imagem montada no GitHub. Trade-off: risco de pico de memória na VPS × consistência com os outros serviços do candidato; mitigado por D63 e limites de memória.

**D63 — Deploy só com CI verde (webhook)** (19/11, Rev) ✅
- Congelamento = desligar o gatilho.

**D64 — Domínio gerado do Easypanel e nome neutro do serviço** (19/11, U + Rev) ✅
- Alternativa: subdomínio do domínio do candidato. Motivo: zero DNS, neutro, sem associar a empresa do candidato; sem "ifood" no hostname.

**D65 — Só local + produção, sem homologação** (19/11, U) ✅
- Trade-off: menos um ambiente × menos builds na VPS; compensado por CI e E2E em produção.

**D66 — Congelamento às 15h de 23/11** (19/11, U) ✅
- Alternativas: 12h; noite de 22/11. Trade-off: mais tempo de construção × 2 h de folga antes da sessão.

---

## F. Entregáveis e entrevista

**D67 — Formato da sessão conforme os e-mails 1 e 2** (19/11, U) ✅
- 2 min pessoal + 8 min case e demo + 10 min perguntas + 25 min conversa.

**D68 — Slide do processo em PPTX** (19/11, U) ✅

**D69 — Repositório público limpo, separado** (19/11, U) ✅
- Cópia filtrada sem `docs/contexto/`, `docs/pessoal/` e `referencias/`, com varredura de segredos.

**D70 — Envio pelos dois canais (resposta ao e-mail + formulário)** (19/11, IA) ✅
- Motivo: os e-mails divergem sobre o canal.

**D71 — Preparação da entrevista com projetos reais do candidato** (19/11, U) ✅
- Base: currículo, portfólio e preparação de People; ganchos com o case; alinhar "semanal × quinzenal" no portfólio antes de 23/11.

---

## G. Decisões [C] do plano de implementação (abertas a correção)
- Limiar de 300 m para "perto"; tempo limite de GPS de 8 s.
- Código de resgate com 6 caracteres sem ambíguos.
- Telefone fictício com DDD 00.
- Rótulos de horário "Noturno / Dia e Noite / Diurno".
- Limite de 5 extrações de cardápio por visitante por dia.
- Definição de "voltou": 1º check-in atribuído nos últimos 60 dias e 2º em outro dia até 30 dias depois.
- Limiares das 6 ações candidatas (ver plano, Tarefa 3.3).
- Drizzle como ORM; `qrcode`; dependency-cruiser para as fronteiras; Vitest e Playwright.

---

## H. Fatia S0 — Fundação (planejamento de 19/11, sessão 2)
Detalhes em [docs/fatias/S0/planejamento.md](../fatias/S0/planejamento.md).

**D77 — Commits no branch da sessão atual** (19/11, U) ✅
- Alternativa: manter o nome fixo `claude/tender-dirac-iou9li` (sessão anterior).
- Trade-off: nenhum relevante × o nome fixo quebra a cada sessão nova (o ambiente só permite push no branch da sessão).
- Efeito: CLAUDE.md e `implementar-fatia` passam a dizer "branch da sessão atual".

**D78 — Exceção a D12 na S0: 1 merge antecipado do esqueleto** (19/11, U) ✅
- O que vai: projeto base, health, banco, CI, página "/" e E2E de fumaça. O resto da S0 segue D12.
- Alternativas: seguir D12 à risca (1º deploy só no fim da S0); apontar o Easypanel para o branch durante a S0.
- Trade-off: produção recebe código antes da revisão da fatia × falhas de infra (memória do build, SHA, migração no boot) aparecem cedo. O esqueleto não tem código de produto.

**D79 — Design system: base na S0, componentes de domínio na fatia que os usa** (19/11, U) ✅
- Na S0: tokens, fonte, logo, 2 cascas, barra e primitivos (Button, Tabs, Chip, Badge, BottomSheet).
- Ficam para depois: TicketCard e StampCard → S1; DaySelector, Stepper, SidePanel e DataTable → S2; FunnelBars e StatCard → S3.
- Alternativa: os 13 componentes do plano já na S0.
- Trade-off: menos consistência antecipada × componentes desenhados contra a tela real, sem props especulativas, e S0 menor.

**D80 — Vermelhos medidos nos prints** (19/11, U; revisada após a revisão independente) ✅
- Fundo de botão com texto branco: `#E71C2B` (4,57:1, AA em qualquer tamanho; a olho não se distingue de `#EA1D2C`).
- `#EA1D2C` exato no logo e em áreas sem texto.
- Texto vermelho pequeno: `#D72E3B` (medido em app/13, 4,83:1).
- Barras do funil: `#EF5652` (medido em portal/05; gráfico, ≥ 3:1).
- Versão anterior: `#EA1D2C` exato, só com texto grande, e `#C8101E` para texto pequeno. A revisão de produto mostrou que o Portal usa texto branco de ~14 px nos botões vermelhos e que `#C8101E` não aparece nos prints.
- Alternativa: manter a versão anterior.
- Trade-off: diferença invisível de cor no fundo dos botões × AA garantido com fidelidade ao layout.

**D81 — Só o logo padrão do iFood, em SVG público** (19/11, U; revisada após a revisão independente) ✅
- Fonte do arquivo registrada; conferido com portal/01; usado na "/", na galeria e no Portal. Sem o lockup "ifood pra comer fora".
- Versão anterior: SVG do iFood + "pra comer fora" composto em texto. A revisão mostrou que essa composição não existe no produto real (o logo real é um pin com carinha + texto fino).
- Alternativas: sem logo na S0; recorte do print.
- Trade-off: menos "cara de Comer Fora" × nada inventado sobre a marca.

**D82 — Fonte Inter e tokens de referência** (19/11, U + IA [C]) ✅
- Fonte: o candidato indicou designmd.app/brands/ifood (terceiros, extraído de ifood.com.br em 05/07/2026). Segundo essa fonte, a fonte oficial é a "Tipo iFood" (proprietária, não verificado) e o fallback web é o Inter. Inter self-hosted, para o build não depender de rede.
- Tokens: os da designmd.app são a base (cores neutras, raios, sombras, espaçamento de 4 px); quando divergem, o print vence (regra [C]).
- Alternativa: comparar 3 fontes livres e escolher.
- Trade-off: os tokens vêm do site de marketing, não do app × uma referência pública declarada, conferida com os prints.

**D83 — Chaves no ambiente de nuvem; implementação da S0 em sessão nova** (19/11, U) ✅
- Variáveis cadastradas pelo candidato nas configurações do ambiente; só uma sessão nova as enxerga. Refina D75.
- Alternativas: spike só em produção (chaves só no Easypanel); spike fora da S0.
- Trade-off: troca de sessão entre o planejamento e a implementação × spike e mini-avaliação rodam no ambiente de desenvolvimento, sem chave no chat.

**D84 — Langfuse Cloud na região EU, conta nova** (19/11, U) ✅
- `LANGFUSE_BASE_URL=https://cloud.langfuse.com`. O pacote `@langfuse/otel` 6.x lê `LANGFUSE_BASE_URL`, não `LANGFUSE_HOST`.
- Motivo: GDPR é a referência mais próxima da LGPD, o que ajuda a responder na entrevista.

**D85 — 2 chaves OpenRouter: pública US$ 3, demo US$ 7; o desenvolvimento usa a demo** (19/11, U; reconfirmada após a revisão) ✅
- Alternativa: 3ª chave "dev" (dev 3, pública 2, demo 5).
- Trade-off: o spike e a mini-avaliação consomem o saldo da demo × menos chaves. O candidato recarrega se preciso.

**D86 — Quem cadastra os segredos** (19/11, U) ✅
- Pelo assistente, via conector: segredos internos gerados (senha do Postgres, `SESSION_SECRET`, `PHONE_HASH_SECRET`).
- Pelo candidato, na interface: chaves pagas ou de terceiros e a senha dos Bastidores.
- Alternativa: o candidato cadastra tudo.
- Trade-off: segredos internos passam pelo histórico da sessão (só protegem dados fictícios) × menos trabalho manual.

**D87 — `noindex` e cabeçalhos básicos já na S0** (19/11, U) ✅
- Itens: meta robots, `X-Robots-Tag`, `X-Content-Type-Options`, `Referrer-Policy` e `frame-ancestors 'self'`. A CSP completa com nonce fica na S3, via `proxy.ts` (no Next 16 o `middleware` virou `proxy`).
- Alternativas: tudo já na S0, inclusive a CSP; manter na S3.
- Motivo: a URL pública com visual do iFood existe desde o 1º deploy.

**D88 — Search Console removido; risco de marcação como phishing aceito** (19/11, U; reconfirmada após a revisão) ❌ Search Console
- A revisão de produto lembrou o risco: robôs antiphishing acham domínios novos pelos logs de certificados, e sem Search Console não há como pedir revisão.
- Alternativas: voltar o Search Console com cuidados extras (página "/" sem marca, login sem campo de senha, checagem diária); só os cuidados extras.
- Decisão: manter, sem mitigação extra. Proteções que ficam: barra, `noindex` e nome neutro.

**D89 — `npm audit` bloqueia só "critical" de produção** (19/11, U) ✅
- `npm audit --omit=dev --audit-level=critical`; o nível "high" aparece no log e é reportado na revisão da fatia.
- Alternativas: bloquear "high" e "critical"; só relatório.
- Trade-off: um "high" pode passar × um deploy não trava na véspera por alerta sem correção disponível.

**D90 — Serviços do `case-salao` sem limite de CPU/memória** (19/11, U) ✅ (substitui "ambos com limite" da espec. 4.5)
- Candidato: "Deixa sem limite. Se precisar, posso pausar serviços na VPS sem problemas."
- Mantidos: heap de 1 GB no build, medição local antes do 1º build e checagem de ≥ 1,5 GB livres antes de cada deploy.
- Alternativas: app 512 MB e banco 256 MB; mais ou menos folga.
- Trade-off: risco para os serviços do candidato × o app nunca morre por limite na demo.

**D91 — E2E da fatia bloqueiam o deploy** (19/11, U) ✅
- Alternativa: E2E só local e na revisão.
- Trade-off: CI ~2 min mais lento × nenhuma tela quebrada publicada.

**D92 — Barra de protótipo responsiva; links só na S3** (19/11, U) ✅
- Abaixo de 640 px, o texto exato quebra em até 2 linhas (≤ 44 px de altura); a partir de 640 px, 1 linha de ≤ 28 px.
- "Trocar de lado" e "Como funciona" só aparecem quando os destinos existirem, com alvo mínimo de 24 px (WCAG 2.5.8). É uma exceção registrada à regra de 44 px.
- Alternativa: texto curto no celular, com o texto completo no toque.
- Motivo: o texto completo não cabe numa linha legível em 390 px, e os links levariam a páginas inexistentes.

**D93 — Página de componentes e página "/" com logo** (19/11, U) ✅
- `/bastidores/componentes`: pública, com logo e o cabeçalho "Base do design system · tokens medidos em prints de referência".
- "/" da S0: logo iFood + "Comer Fora no Salão · protótipo de case em construção · versão final em 23/11".
- Alternativas: galeria atrás de senha ou só fora de produção; "/" neutra, sem marca.
- Trade-off: mais superfície "com cara de iFood" na URL pública × visual e evidência de profundidade visíveis.

**D94 — S0 sem linha de corte** (19/11, U) ✅
- Alternativa: núcleo obrigatório, com Tabs/Chip/Badge indo para a S1 e PortalShell para a S2 se o tempo estourasse.
- Trade-off: a S0 pode invadir 20/11 × a base completa fica pronta.

**D95 — Revisão independente do plano em toda fatia** (19/11, U) ✅
- Nova etapa da skill `planejar-fatia`: 2 subagentes em paralelo, sem a conversa — técnico (back-end, front-end, infra) e produto (UX/design, aderência ao case e ao iFood).
- Os achados passam pelo filtro do assistente; os que mudam decisão voltam ao candidato.
- Trade-off: tempo e tokens × na S0 a revisão achou 5 bloqueantes técnicos e 2 decisões de design baseadas em premissas erradas.

**D96 — Escolhas técnicas da S0** (19/11, IA [C]) ✅
- Banco e migração:
  - local neste ambiente: Postgres 16 nativo; `docker-compose.yml` mantido para máquinas com Docker;
  - driver `pg` com pool em `globalThis` e timeouts;
  - migração em `instrumentation.ts`, ignorando a fase de build; tenta por 30 s e depois segue com o health em `db:"down"`.
- IA e rastreio:
  - `generateText` + `Output.object`, `maxRetries: 0`, reparo de JSON desligado, `usage.include` para o custo;
  - `@langfuse/vercel-ai-sdk` + `startActiveObservation`;
  - contrato de IA ampliado (arquivos, `ModelRef` com provedor/PDF, `AttemptLog`, `GuardResult`, 402 → encerra).
- Build e deploy:
  - empacotador escolhido pelo pico de memória medido (Turbopack × webpack);
  - SHA por 3 alternativas em ordem;
  - CI com 3 jobs, `paths-ignore` de docs e `concurrency` no deploy.
- Interface e testes:
  - Tailwind 4 com `@theme` (sem `tailwind.config.ts`);
  - `BottomSheet` em `<dialog>` nativo;
  - Vitest com projetos `unit` e `integration`;
  - teste de contraste dos pares de tokens;
  - galeria testada em 390 e 1280 px.

**D97 — Créditos do OpenRouter comprados antes da implementação** (19/11, U) ✅
- Achado: pelo MCP OpenRouter (só leitura), a conta tinha `total_credits: 0`. Todo modelo pago responderia 402, e o spike e a demo falhariam.
- Decisão: o candidato compra os US$ 10 do orçamento (D60). Na sessão de implementação, o saldo é conferido pelo MCP (`get-credits`) antes do spike; se continuar zerado, a implementação para.
- Alternativas: as chaves serem de outra conta; spike só com modelos `:free` (50 req/dia, não prova o caminho pago).

**D98 — MCP OpenRouter na construção: consulta + testes de prompt** (19/11, U) ✅
- Uso livre das ferramentas gratuitas: catálogo de modelos, documentação, saldo e custo por geração.
- `send-message` é permitido para testar prompts na S2/S3 antes de codar. O gasto conta nos US$ 10, e cada uso vai para `docs/planejamento/notas-ia.md` (modelo, objetivo, custo via `get-generation`), porque não aparece no Langfuse.
- Alternativa: só consulta; toda inferência paga pelo app.
- Trade-off: iteração de prompt mais rápida × gasto fora do rastro do app. A chave do MCP (teto US$ 20) é diferente das chaves de D85.
- Entra no slide como uso de IA na construção.

**D99 — Modelos do spike da S0** (19/11, IA [C]) ✅
- Principal: `google/gemini-2.5-flash-lite` (US$ 0,05/0,20 por M tokens; `structured_outputs`; aceita imagem e arquivo).
- Reserva: `openai/gpt-5-nano` (US$ 0,025/0,20; `structured_outputs`; aceita arquivo; expira em 11/12/2026).
- Provedores diferentes. Escolhidos pelo catálogo do MCP e reconfirmados na hora. Não é a escolha de produção: essa sai da mini-avaliação (D51).

**D100 — Serviços da S0 dentro do projeto `sites` do Easypanel** (19/11, U) ✅ (substitui "projeto novo `case-salao`" da espec. 4.5 e do CLAUDE.md)
- Achado no pré-voo da implementação: o Easypanel recusou criar o projeto `case-salao` ("You are not allowed to create more projects"); a licença atual limita a 3 projetos e já existem 3.
- Alternativas: o candidato liberar uma vaga (apagar ou consolidar um projeto); upgrade da licença; serviços dentro de um projeto existente.
- Decisão: serviços `case-salao-db` (Postgres 16) e `case-salao-app` dentro do projeto `sites`, escolhido pelo candidato. Domínio gerado: `sites-case-salao-app.lyv8st.easypanel.host` (nome neutro, sem "ifood").
- Trade-off: nenhum custo e nenhum serviço do candidato removido × o app divide a rede interna do projeto com outros serviços do candidato, e um erro de nome poderia atingir algo dele. Mitigação: a regra passa a ser "só os serviços com prefixo `case-salao-` no projeto `sites`"; nomes conferidos antes de criar; banco sem porta exposta.
- Segredos: a senha do banco foi gerada pelo próprio Easypanel (não por script local), para não circular pelo chat além da resposta do conector.

---

## I. Replanejamento de produto por diferenciação (20/11)
Faixa **D201+** reservada para não colidir com a sessão paralela da S0 (D101–D199). Fonte: [especificacao.md](especificacao.md) v2.
Origem: o candidato perguntou "qual a grande diferença do que estamos construindo pra aquilo que já existe no Comer Fora? Não vai ficar muito igual?".
Foi feita uma pesquisa pública (imprensa; não há página oficial sobre o lado do restaurante), seguida de brainstorming e de 2 revisões independentes de produto.

**D201 — Hipótese H5: o dono desconfia de divulgar o iFood no próprio salão** (20/11, U) ✅
- Base indireta: Abrasel no Cade (Mercado&Consumo, 01/10/2025) e "os dados ficam com o restaurante" (Central do Varejo). A ligação com "não divulgar" é inferência [H].
- No produto: a base é declarada do restaurante; o kit e o recado levam a marca dele; abandono por passo do assistente é medido.
- Alternativas: só usar na entrevista; não usar.

**D202 — Replanejamento focado do produto, sem mexer na S0** (20/11, U) ✅
- Achado: pela pesquisa, já existem no Comer Fora a configuração de 1ª visita, a cartela, o cashback ("trilhas de marketing"), o benefício por dia/turno (prints 04 e 12), o histórico do cliente, os resultados de campanha e o Toqan. Não foram encontrados material de salão, QR por peça, atribuição, holdout, validação registrada nem recomendação focada no salão.
- Alternativas: só declarar e encolher o repetido; replanejar do zero; manter como está.
- Motivo: cerca de metade do escopo replicava o que já existe, e o "o que ela pode vir a ser é com você" do briefing premia diferenciação.

**D203 — Momento de valor: encher o horário vazio; promessa "seu salão cheio divulga seu horário vazio"** (20/11, U; promessa IA [C]) ✅
- Alternativas: ver dinheiro; zero trabalho; conhecer o cliente.
- Ressalva da revisão, aceita: benefício por turno já existe [O]. O diferencial é o convite nascido na mesa + o incremento medido, e não "benefício em horário ocioso".

**D204 — Mecânica: "algo agora" + convite de volta para o horário vazio** (20/11, U) ✅ (holdout refinado por D216; validade e código do convite por D218)
- O benefício de 1ª visita vale em qualquer horário de funcionamento (diverge do app, registrado).
- O convite vale só nos horários vazios, por 30 dias, uso único, validado pelo garçom.
- O teto semanal por horário é derivado das mesas desejadas (×4 [C]).
- Holdout de 10% dos elegíveis por cliente (hash estável).
- No máximo 1 convite ativo por cliente [C].
- Alternativas: só convite de volta; manter o benefício restrito ao horário.
- Trade-off: mais custo e regra mais complexa × o QR funciona no pico e alimenta o horário vazio.

**D205 — Convite: regra aprovada na ativação + plano da semana ajusta** (20/11, U, após revisão) ✅
- O convite da mesa segue a regra aprovada (oferta, horários, teto). O plano da semana ajusta oferta e teto e dispara a reativação simulada dos identificados com opt-in, fora do holdout.
- O cliente vê o convite como 2º card depois do "agora" e na Jornada.
- O garçom usa uma única tela, "Validar código", que reconhece o tipo.
- Alternativa: tudo pelo plano da semana (o restaurante ficaria sem convite até aprovar o 1º plano).

**D206 — P7 vira o "plano da semana": análise de dados + IA** (20/11, U) ✅ (substitui a recomendação com 6 candidatas e a campanha; "o que aprendemos" refinado por D220)
- O código calcula 4 famílias de insight:
  1. check-ins por turno × movimento declarado (renomeado após a revisão: não é ocupação);
  2. resposta aos convites, com incremento e coortes;
  3. clientes acionáveis;
  4. operação/A-B/H3 (flag).
- O código gera 2–3 ofertas validadas por horário.
- A IA escolhe por id, casa item × turno, escreve o convite e a justificativa com referências e escreve "o que aprendemos".
- O dono aprova ou ajusta.
- Alternativas: manter os dois; IA com liberdade para propor ofertas.
- Motivo: o candidato quer "análise de dados + IA" como grande diferencial, sem a IA decidir dinheiro e sem ser decorativa.

**D207 — Ativação proposta: o sistema propõe o pacote, o dono aprova** (20/11, U) ✅
- Pacote: benefício agora + convite + 1º plano, com custo estimado pelas regras e justificativa da IA.
- Novos campos declarados: intensidade do horário vazio, mesas desejadas, ticket médio e margem [C].
- Alternativa: o dono escolhe e o sistema só valida (parecido com a trilha que já existe).

**D208 — Métrica principal do dono: visitas e margem incrementais contra o holdout** (20/11, U, após revisão) ✅ (substitui "voltaram em 30 dias")
- Visitas totais por cliente nos 30 dias após a elegibilidade, convidados × holdout; margem estimada com ticket e margem declarados.
- Secundária: visitas no horário vazio. Proteção: visitas no pico (migração).
- Alternativas: visitas incrementais só no horário vazio (conta a migração como ganho); manter "voltaram em 30 dias".

**D209 — Honestidade estatística** (20/11, U, após revisão) ✅ (estados e janela detalhados em D217)
- Incremento sempre com intervalo de 95%, e "amostra insuficiente" quando o holdout tem menos de 30 clientes ou o intervalo cruza zero [C].
- O efeito da simulação é um parâmetro declarado em "Como funciona".
- A "previsão com faixa" sai.
- A prova estatística fica para o piloto com ~50 restaurantes.
- Alternativa: número simples, sem intervalo.
- Motivo: num restaurante, o holdout tem ~20 clientes (±13 p.p.); um número sem intervalo seria derrubado por um avaliador técnico.

**D210 — Cortes e mudanças de escopo** (20/11, U) ✅
- **Avaliar sai** (o app real já tem).
- **Clientes vira segmentos acionáveis**: frequentes do pico, 1 visita e sumiu, perto da recompensa, com convite ativo.
- Jornada fica, agora com convites ativos.
- "Aprende com o dono" fica.
- Escopo: tudo especificado, na ordem de prioridade, com flags e corte na noite de 22/11 (D57). O corte maior sugerido pela revisão foi recusado.

**D211 — Alavancas de IA para impacto** (20/11, U) ✅
- **C — Ativação "uau" no centro da demo**: foto → pacote → kit.
- **B — Ciclo que aprende, visível**: "o que aprendemos" no plano seguinte.
- **A — Prova de divulgação por foto: recusada.**
- O chat foi descartado de antemão: o Toqan já faz, e o case diz que uma conversa com IA sozinha não é produto.

**D212 — MCP (AI-operable) volta ao protótipo, último na fila de prioridade** (20/11, U) ✅ (reabre D37; aprovação por agente detalhada em D219)
- Servidor MCP sobre as mesmas operações (ler insights, gerar/ver/aprovar plano), com token próprio, os mesmos limites e sem PII. Flag `mcp`.
- Trade-off: escopo extra × fala direto com a cultura "AI-operable" e com a experiência real do candidato.

**D213 — Ordem de prioridade v2** (20/11, U) ✅ (atualiza D57)
1. Fluxo integral (QR → agora + convite → validar código → volta).
2. Guardrails.
3. Modo sem IA.
4. Plano da semana (insights 1–3 + "o que aprendemos") e pacote proposto.
5. Mini-avaliação (tarefas 1 e 3).
6. E2E em produção.
7. Insight 4 + A/B.
8. Revisor.
9. Aprende.
10. MCP.

**D214 — Aceitos como [C] após a revisão de produto** (20/11, IA [C]) ✅
- Unit economics declarados como [H]: o restaurante paga o benefício e o convite; o envio é custo de plataforma do iFood.
- O "algo agora" deve ser barato (custo por cliente identificado).
- Convite visível sem envio; reativação só com opt-in.
- Uso de convites medido por coorte de emissão.
- Cartão do garçom reescrito por modelo.
- Rodapé do cliente só com [Check-in] (divergência registrada).
- 5 abas no painel (Plano da semana com aba própria).
- Tarefa de IA 3 entra na mini-avaliação.

**D215 — LangChain/LangGraph não adotados** (20/11, U, por proposta da IA) ✅
- Pergunta do candidato: "Faz sentido LangGraph/LangChain? Seja crítico."
- Alternativas:
  - LangGraph para orquestrar as tarefas (grafo com estado, interrupts, checkpointing);
  - LangChain como camada de modelos;
  - plano da semana como agente com ferramentas (consultar insights, simular custo, propor, autocriticar, revisar).
- Motivo:
  - as 4 tarefas são de chamada única com saída estruturada;
  - o "humano no meio" já é estado de banco (`weekly_plans` proposto → aprovado), e não um grafo em memória;
  - o único ciclo (gera → revisor → gera de novo) cabe no `runTask` já testado da S0;
  - a stack AI SDK 7 + OpenRouter + Langfuse já cobre tudo;
  - adotar seria uma segunda abstração para a mesma chamada, com retrabalho dos guardrails e mais memória no build da VPS;
  - "mudar na hora" fica mais difícil com o framework no meio;
  - um agente com ferramentas abriria superfície de injeção pelo cardápio e contrariaria D206 (o código decide número e dinheiro).
- Quando reabrir: se o plano virar um agente com ferramentas e várias etapas (roadmap). O lado "IA operável" já está coberto pelo MCP (D212): o nosso sistema vira ferramenta de agentes externos.
- Entra no E4 como resposta preparada: "por que não LangGraph?".

### Revisão da v2 (20/11): builder check + revisão técnica + revisão de produto
As três revisões convergiram num ponto: **a medição do incremento, como estava escrita, não funcionaria**. A definição do holdout era circular, quem esbarrava no teto ficava fora dos dois grupos, e uma janela de 30 dias dentro de 30 dias simulados deixaria a métrica vazia na demo.

**D216 — Grupo de controle: sorteio só entre quem poderia receber + "convite fantasma" (intenção de tratar)** (20/11, U) ✅
- No check-in identificado, o código verifica sem olhar o grupo: plano ativo, nenhum convite ativo, teto livre. Se passar, sorteia e grava o grupo uma única vez (90/10).
- O convidável recebe um convite real. O holdout recebe um convite fantasma: invisível, com a mesma faixa e as mesmas datas, sem consumir teto.
- A comparação vale a partir da data do convite.
- Alternativas: sorteio simples por cliente desde o 1º check-in (comparação enviesada); roleta como sorteio visível (D222).
- O candidato pediu uma explicação mais clara antes de decidir. O exemplo usado: com teto de 40 em 100 check-ins, a regra antiga comparava os "clientes do começo da semana" com os "clientes da semana toda".

**D217 — Janela de 14 dias, vitrine de 60 dias e incremento com 4 estados** (20/11, U para janela e vitrine; IA [C] para a estatística) ✅
- A métrica conta só clientes com a janela de 14 dias fechada.
- A vitrine tem 60 dias de histórico (~70 clientes novos por semana) e efeito declarado de +0,20 visita em 14 dias, com 25% do extra vindo de migração. Um teste garante que o IC 95% da vitrine fica acima de zero e contém o efeito programado.
- Cálculo por Welch com aproximação normal. Estados: `amostra_insuficiente` (n < 30), `inconclusivo` (IC contém 0), `positivo`, `negativo`.
- Margem incremental por Δcusto entre os grupos (o "agora" se cancela).
- Alternativa: manter 30 dias, com simulação de 60–90 dias.
- Trade-off: janela mais curta × métrica preenchida na demo e teste rápido o bastante para o dono acompanhar.

**D218 — O convite congela na emissão; o código nasce na volta** (20/11, U) ✅
- Horário vazio é uma faixa (dias + início/fim, com id) escolhida pelo dono, dentro do horário de funcionamento.
- O convite congela a faixa (a de maior prioridade com teto livre) e a validade de 30 dias.
- O código do convite só nasce no check-in de volta, dentro da faixa e em outro dia, e vale aquele dia. Os 3 tipos de código passam a valer "hoje".
- Alternativa: o convite segue o plano vigente (o cliente pode perder o horário que viu, e a validação fica ambígua).

**D219 — O MCP pode aprovar o plano com o token do dono** (20/11, U) ✅ (detalha D212)
- O token é vinculado a 1 restaurante, guardado como hash e revogável. Comparação em tempo constante, mesmos limites, sem PII, e a aprovação fica registrada como "via agente".
- Alternativa recomendada pela IA e recusada: o MCP só lê e propõe, e a aprovação fica no Portal.
- Trade-off: demonstra autonomia operável por agentes × abre um caminho de dinheiro sem clique humano no Portal. O risco fica registrado; a flag é desligável.

**D220 — "O que aprendemos": o código decide o veredito, a IA explica** (20/11, U) ✅ (refina D206)
- Veredito `manter | trocar | cedo_demais` por oferta, calculado com indicadores antecipados (uso por coorte em 7 dias, custo por visita gerada). Não é causal.
- O incremento contra o holdout aparece só no total do restaurante, porque por oferta o holdout tem 3–10 clientes.
- A IA explica o veredito e nunca o muda.
- Alternativa: a IA recomenda (seria decisão numérica tomada pelo modelo).

**D221 — Ritual completo por fatia mantido** (20/11, U) ✅
- Cada fatia passa por planejar-fatia (perguntas + 2 revisores do plano), depois implementar-fatia, depois revisar-fatia (4 revisores + E2E).
- Alternativas: planejar S1–S3 juntas com uma única revisão do plano; ritual reduzido.
- Trade-off: ~2–3 h por fatia × controle e qualidade por fatia. O plano de implementação de S1–S3 fica no nível de tarefas e interfaces; o detalhe sai no planejamento de cada fatia.

**D222 — Roleta de benefícios vai para o roadmap** (20/11, U) ✅
- Ideia do candidato: gamificar com roleta. O "tente na próxima" funcionaria como holdout transparente e permitiria comparar ofertas.
- Fica fora do protótipo:
  - risco legal: distribuir prêmio por sorte em ação comercial tende a exigir autorização (Lei 5.768/1971; verificar a regra atual);
  - cerca de meio dia de construção;
  - o acaso ao vivo na demo;
  - pode parecer gimmick e tirar o foco do diferencial;
  - a cartela de selos já é gamificação.

**D223 — Itens aceitos como [C] das revisões da v2** (20/11, IA [C]) ✅
- **Mecânica e dados:**
  - teto por semana ISO em SP, com reserva atômica;
  - índice parcial de 1 convite ativo;
  - recalibração do teto por coortes com ≥ 7 dias;
  - simulador por agente usando as mesmas funções puras (`decideCheckin`);
  - código de 1ª visita com uma emissão por cliente;
  - índice único de código por restaurante.
- **Contaminação do holdout:**
  - antes do check-in, a página diz só "você pode ganhar um convite";
  - o roteiro do garçom fala só do "agora";
  - as peças citam o convite de forma genérica.
- **Métrica e painel:**
  - a reativação mira "1 visita e sumiu" e "perto da recompensa"; os frequentes não são alvo de deslocamento;
  - rótulo "visitas registradas (check-ins)", com a limitação declarada;
  - custo = preço × (1 − margem);
  - ticket e margem opcionais;
  - teto exibido em linguagem do dono;
  - funil reordenado;
  - indicadores antecipados sempre visíveis.
- **Operação e demo:**
  - Bastidores "antecipar convite em 1 dia" (só no restaurante de teste);
  - "modo salão" com PIN vai para o roadmap;
  - demo reescrita com mudança ao vivo e sem MCP;
  - frase de transição para a vitrine.
- **IA:**
  - contrato da tarefa 3 com schema por chamada e referências `{horario:…}` e `{oferta}`;
  - fatos declarados no 1º plano;
  - estado `gerando` contra clique duplo;
  - mini-avaliação da tarefa 3 comparando IA × linha de base sem IA;
  - incremento no nível da plataforma vai para o roadmap.
- **Revisor desatualizado (não procede):** a revisão de produto disse que D201+ não estavam registradas e que o CLAUDE.md ainda citava `case-salao`. Ela leu os arquivos antes do registro, e o CLAUDE.md já cita o projeto `sites` (D100).

**D224 — Cronograma v2 e dependência invertida** (20/11, IA [C], a partir da revisão técnica) ✅
- A S1 vai até a manhã de 21/11 e a S2 até a manhã de 22/11. O motor de candidatas e a tarefa de IA 3 sobem para a S2, porque o pacote proposto da ativação depende deles.
- O seed da vitrine (S1) traz 2 planos fixos em JSON, com referências resolvidas na tela, para não depender da tarefa 3.

**D101 — Autonomia da IA depois do planejamento aprovado** (20/11, U) ✅ (ajusta D10 e a regra "na dúvida, perguntar" fora do planejamento)
- Pedido do candidato: "Você deve ser independente do início até o final da implementação, a partir de quando terminarmos o planejamento juntos até o fim da revisão/testes."
- Com o planejamento da fatia aprovado, a IA conduz sozinha implementação → revisão (4 revisores + E2E) → correções → merge na `main` → deploy → E2E em produção, sem pedir confirmação entre etapas.
- Decisão que o planejamento não tomou: a IA decide pela especificação e pelas decisões vigentes, registra como [C] e lista no relatório final. A decisão sobre cada achado da revisão passa a ser da IA (antes era do candidato — D10).
- Limites que continuam: parar só por bloqueio que só o candidato resolve (credencial, conta paga, acesso, orçamento de IA, serviço fora dos `case-salao-`) ou por ação irreversível fora do escopo; congelamento de 23/11 às 15h; checagem de memória da VPS antes do merge; nenhum dado real.
- Alternativas: manter a decisão do candidato sobre cada achado; autonomia só na implementação, com a revisão decidida junto.
- Trade-off: velocidade e menos interrupções na reta final × o candidato vê as decisões [C] só no relatório final.
- Onde está: CLAUDE.md e skills `planejar-fatia`, `implementar-fatia`, `revisar-fatia` (não no plano de implementação, a pedido do candidato).

**D102 — Build de produção com webpack já no fim da S0** (20/11, IA [C], D101, a partir da revisão da S0) ✅ (antecipa o gatilho de D96/§6.5)
- Medição com o código final da S0: Turbopack 1.105–1.146 MB (~95% do limite de ~1,2 GB do plano); webpack com `webpackMemoryOptimizations` 944 MB.
- Dois revisores independentes recomendaram trocar já: o app vai crescer em S1–S3 e a VPS é compartilhada e sem limites (D90); um OOM na noite de 22/11 derrubaria o deploy perto do congelamento.
- Alternativas: manter o Turbopack e remedir no início da S1 (regra original); trocar só se a folga ficar abaixo de 10%.
- Trade-off: build ~25 s mais lento (~32 s contra ~7 s local) × ~20% de folga de memória. `npm run build` usa webpack; `build:turbo` fica para comparação.

**D103 — Migrações só aditivas até o congelamento; procedimento de volta escrito** (20/11, IA [C], D101, a partir da revisão da S0) ✅
- Achado: "rollback por revert" (espec. 4.5) não desfaz migração, e durante o deploy o container antigo segue servindo com o schema novo.
- Regra: até 23/11 às 15h, migrações só acrescentam (tabela, coluna anulável, índice). Remover ou renomear (ex.: `restaurants.idle_hours`) fica para depois do congelamento; a coluna obsoleta só deixa de ser usada.
- Procedimento de volta em `notas-infra.md`.
- Alternativas: migrações destrutivas com "down" manual; advisory lock no migrador.
- Trade-off: uma coluna morta no schema da demo × deploy reversível sem perda de dados.

## J. Fatia S1 — Domínio e fluxo do cliente (planejamento de 20/11)
Detalhes, revisão independente (2 subagentes) e itens [C] em [docs/fatias/S1/planejamento.md](../fatias/S1/planejamento.md).

**D104 — Vitrine com ~200 clientes novos identificados por semana** (20/11, U) ✅ (ajusta D217, "~70/semana")
- Achado da IA: com ~70/semana, só ~430 clientes têm a janela de 14 dias fechada em 60 dias (holdout ~43). Monte Carlo com efeito +0,20: IC 95% acima de zero em só 49–72% das sementes. Com ~200/semana (~1.300 sorteados): 89–99%.
- Alternativas: manter 70 e escolher uma semente (frágil); efeito declarado maior (+0,35, mais otimista).
- Efeito (+0,20 visita/14 d) e migração (25%) mantidos; o teto da vitrine é dimensionado para não limitar o sorteio (faixa A 220/sem, faixa B 140/sem).

**D105 — Segredos `PHONE_HASH_SECRET` e `SESSION_SECRET` gravados pela IA pelo conector do Easypanel** (20/11, U) ✅
- Antecipados da S2 para a S1 (a identificação do cliente vem na S1). Valores nunca ecoados no chat; ficam no transcript da chamada da ferramenta (risco aceito pelo candidato).
- Alternativa: o candidato gera e cola no Easypanel.

**D106 — Telefone sem validação de "real"** (20/11, U) ✅ (ajusta D31)
- Aceita qualquer número no formato `(DD) 9XXXX-XXXX`, como uma aplicação real. Campos continuam pré-preenchidos com fictícios (DDD 00), com "gerar outros", aviso e `autocomplete="off"`.
- A ausência de validação é **proposital** e vai documentada em "Como funciona" e no README.
- Alternativa recomendada pela IA e recusada: travar DDD 00 no servidor.
- Risco residual: alguém digitar dado real; mitigado por HMAC + 4 dígitos, rótulos "(fictício)" e, na S3, lista de Clientes da vitrine só com primeiro nome + inicial.

**D107 — Fotos de banco livre por categoria** (20/11, U) ✅
- 1 foto de salão + ~5 de comida por categoria (Unsplash/Pexels), hospedadas no site e creditadas. Alternativas: só a foto do salão; sem fotos.

**D108 — Vitrine: cantina italiana fictícia** (20/11, U) ✅
- Faixas vazias Ter–Qui 15h–18h (muito vazio, sobremesa) e Seg–Qua 21h–23h (um pouco, porção). Alternativas: bar brasileiro; hamburgueria.

**D109 — Restaurante E2E oculto para os testes em produção** (20/11, U) ✅
- `teste`, protegido da limpeza, teto alto, sem simulação. O holdout é provado criando clientes novos até cair um, sem porta dos fundos no servidor.
- Alternativa: E2E na vitrine (gastaria o teto da semana e poluiria a demo).

**D110 — S1 sem corte** (20/11, U) ✅
- Fecha com as 11 tarefas, mesmo invadindo a tarde de 21/11. Alternativa recomendada e recusada: regra "fluxo primeiro" com coortes/migração/margem para a S3. A ordem de implementação põe o fluxo integral primeiro (revisão do plano).

**D111 — Itens [C] da S1** (20/11, IA [C]) ✅
- Lista nas seções 11, 13 e 14 (mudanças durante a implementação: tetos da vitrine 340/160, fotos do Wikimedia Commons, cartela em `restaurant_customers`, token da peça pela URL, semente 20261123) do planejamento da S1 (turnos, categorias, custo do desconto = receita perdida, cartela nova depois da 6ª, convite ativo até validar ou vencer, janela de 14 dias após o dia do sorteio, idempotência depois do lock, seed fora do `register`, `protected`, entre outros).

**D112 — Demo: holdout ao vivo é assumido e explicado** (20/11, U) ✅
- Se o cliente cair no holdout (10%), a demo diz "caiu no grupo de controle — é assim que medimos" e usa "Testar como outro cliente". O cliente continua na demo (fecha o ciclo); o foco segue no dono.
- Alternativas: atalho que garante convidável no modo apresentação; tirar o cliente da demo.

**D113 — "Testar como outro cliente (fictício)" já na S1** (20/11, U) ✅
- Link discreto no resultado e na Jornada; troca só o cookie do cliente no aparelho. A S3 reaproveita a rota nos Bastidores. Alternativa: só na S3.

### Revisão da S1 (20/11) — decisões da IA (D101)
**D114 — Telefone já cadastrado só entra com o mesmo nome** (20/11, IA [C], revisão da S1) ✅ (complementa D106)
- Achado: com a D106 (qualquer número), o telefone virava senha: quem digitasse um número cadastrado recebia o cookie daquele cliente (nome, restaurantes, códigos do dia).
- Decisão: o nome digitado precisa conferir (sem maiúsculas, acentos nem espaços extras); se não conferir, 409 "telefone em uso", com a orientação de gerar outros dados fictícios. Em produção seria login iFood/OTP (declarado).
- Alternativas: OTP simulado (mais telas); não reconhecer pelo telefone (contraria espec. 3.5 "reconhecido pelo hash do telefone").

**D115 — Limites em memória nas rotas públicas até a S2** (20/11, IA [C]) ✅
- Por IP (identificação 10/min, check-in 20/min, leitura 60/min) e global por restaurante (identificação 120/min); leitura sem cookie do aparelho não conta. O restaurante E2E oculto fica fora dos limites (o E2E de produção cria clientes em sequência).
- Alternativas: esperar a S2 (teto da vitrine esgotável por script); token de bypass para o E2E (exigiria um segredo novo no GitHub, passo do candidato).
- A S2 troca por limites persistidos (Tarefa 2.2).

**D116 — Seed robusto: pool próprio, transações separadas, espera crescente; health sem motivo** (20/11, IA [C]) ✅
- Pool de 1 conexão com limite de 120 s (o de 15 s do pool principal anulava o `SET LOCAL`); restaurante E2E e vitrine em transações separadas; nova tentativa depois de falha em 60 s, 120 s, 240 s… (máx. 5); seed não começa sem os 2 segredos; o motivo da falha vai só para o log (sem PII — `safeErr`), nunca para o `/api/health`.

## K. Fatia S2 — Portal, ativação proposta com IA, kit, validação e configurações (planejamento de 20/11)
Detalhes, revisão independente (2 subagentes) e itens [C] em [docs/fatias/S2/planejamento.md](../fatias/S2/planejamento.md).

**D117 — Mini-avaliação T1 já na S2, com processo e motivo documentados** (20/11, U) ✅ (antecipa parte de D51 e da Tarefa 3.7)
- A extração do cardápio liga com um modelo escolhido por número. A base são os 3 cardápios de exemplo fictícios, criados por nós e com gabarito.
- O processo e o motivo vão para `eval/relatorio-t1.md`, `notas-ia.md` e o slide.
- Alternativa: usar o par do spike e medir só na S3. Trade-off: ~1–2 h e < US$ 0,30 × o "uau" da demo estreia com modelo medido.

**D118 — Login do dono por e-mail real + código de 6 dígitos via AWS SES, em tela idêntica ao portal/01** (20/11, U) ✅ (substitui "login demo pré-preenchido" da espec. 3.1; "login real" deixa a seção 10)
- Origem: o candidato perguntou "por que um terceiro entra na conta de outro?" e preferiu código por e-mail a senha compartilhada. Escolheu reaproveitar o AWS SES de outro projeto, com conta fora do sandbox e subdomínio novo, e **sem plano B** no envio.
- Riscos apresentados antes da decisão:
  - dado pessoal (contra a regra do case);
  - reputação da conta de envio;
  - D100;
  - critério 2 do case;
  - marcação antiphishing de tela com a marca do iFood pedindo e-mail (os 2 revisores do plano).
- Mitigação:
  - e-mail guardado só como HMAC + dica mascarada;
  - e-mail sem logo e sem link;
  - limites por e-mail, por IP e global;
  - limpeza de contas em 7 dias;
  - link do avaliador (D126).
- Alternativas: código simulado na tela; e-mail real + "entrar com conta de demonstração"; SMS; tela de login sem a marca.

**D119 — Cada conta ganha a própria cópia da vitrine** (20/11, U) ✅
- A cópia tem os mesmos 60 dias, a mesma semente e os mesmos números, e é editável. A vitrine original fica só para "Sou cliente".
- Correção técnica da revisão: simular com o id da vitrine e remapear os ids ao gravar, porque mesma semente = mesmos UUIDs.
- Alternativas: vitrine única só leitura com Validar; vitrine única editável por todos.
- Trade-off: ~3–5 s e ~15 mil linhas por conta, limpeza em 7 dias × isolamento total, e o avaliador sozinho faz tudo.

**D120 — Configurações já na S2: depois da IA, tudo fica editável pelo dono** (20/11, U) ✅ (antecipa parte da Tarefa 3.2)
- Cardápio, faixas, agora, convite (oferta, teto, texto), cartela, ticket, margem, funcionamento, recado e kit. Cada mudança é uma nova versão, e os convites já emitidos não mudam (D218).
- Alternativa: editar só no assistente, com Configurações na S3.

**D121 — Candidatas com nota só econômica; a IA escolhe casando item × turno** (20/11, U) ✅
- O código gera 2–3 ofertas válidas de famílias diferentes, com nota = economia. A IA escolhe com os fatos declarados, e o modo sem IA usa a maior nota.
- Alternativa: nota já com item × turno e a IA só redigindo (risco de "IA decorativa").

**D122 — Texto do convite da IA, aprovado pelo dono, também no 2º card do cliente** (20/11, U) ✅
- Dias, horário, oferta e validade continuam escritos pelo código. O holdout não vê nada.
- Alternativa: texto só no Portal e na reativação.

**D123 — Token secreto para o E2E de produção entrar no Portal** (20/11, U) ✅
- `E2E_LOGIN_TOKEN` (Easypanel + secrets do GitHub, gravados pelo candidato) devolve o código de e-mails de teste `e2e-dono+N@exemplo.invalid`, sem enviar.
- Alternativa: E2E do dono só local.

**D124 — S2 sem corte; a ordem protege o núcleo** (20/11, U) ✅
- O que não couber até a manhã de 22/11 vai para a S3, registrado. A revisão do plano ajustou só a sequência: os limites de login vêm logo depois do login, e a T1 antes da extração.

**D125 — Texto do convite editado pelo dono: livre, só com aviso** (20/11, U) ✅
- Números, "%", "R$", "grátis" e "desconto" no texto do dono geram aviso, não bloqueio. No texto da IA, bloqueiam.
- Alternativa recomendada pelos 2 revisores e recusada: bloquear números e preços também no texto do dono.
- Risco aceito: promessa diferente da regra (o garçom recusa); mitigado por aviso e prévia do 2º card.

**D126 — Link privado do avaliador** (20/11, U) ✅ (complementa D118)
- `/parceiro/acesso/<token>` vai junto com a entrega do case e abre uma conta própria sem e-mail, com a cópia da vitrine. Não há botão público. O token (`EVALUATOR_LINK_TOKEN`) fica só no Easypanel.
- Origem: revisão de produto do plano (login idêntico ao iFood + e-mail real sem plano B).
- Alternativas: tirar a marca da tela de login; manter só o e-mail.

**D127 — PDF sempre convertido em imagem no navegador** (20/11, U — ideia do candidato) ✅
- O pdf.js é carregado só quando o dono escolhe um PDF e renderiza até 5 páginas, enviadas como JPEG.
- Ganhos: entrada igual para todos os modelos, contagem de páginas confiável, e o PDF não sai do aparelho.
- Custo: ~1 MB carregado sob demanda e a camada de texto do PDF perdida.

**D128 — OCR só como linha de base da T1, fora do produto** (20/11, U) ✅
- Pergunta do candidato: "e se tentarmos OCR primeiro com fallback pra IA?". A análise: o difícil no cardápio é estruturar (item × preço × categoria em 2 colunas e foto torta), não ler as letras. A IA custa ~US$ 0,0005 por cardápio, e o OCR no celular é pesado e lento.
- Decisão: medir em vez de supor, com 3 linhas de base na T1: Tesseract + regras, Google Vision + regras e Vision + LLM de texto (híbrido).
- Credencial: service account do Google em `GOOGLE_VISION_CREDENTIALS` no Easypanel, lida pelo conector só para a T1. A chave privada passa pelo histórico da sessão (aceito pelo candidato).
- Alternativas: OCR primeiro com IA de reserva no produto; sem OCR.

**D129 — Modelos da T1** (20/11, U) ✅
- Modelos:
  - `google/gemini-2.5-flash-lite` (linha de base do spike; sem data de expiração no catálogo);
  - `google/gemini-3.1-flash-lite`;
  - `openai/gpt-6-luna`;
  - `deepseek/deepseek-v4.1-flash` (só imagem; dados possivelmente na China);
  - `anthropic/claude-haiku-5.5` (conflito declarado);
  - `qwen/qwen3.8-flash`;
  - `google/gemini-3.8-flash` (referência de qualidade).
- Configuração: esforço de raciocínio baixo e provedor por latência.
- Fora: `gpt-5-nano` (expira em 11/12) e `muse-ember` (raciocínio "max" obrigatório por padrão).

**D130 — Itens [C] da S2** (20/11, IA [C]) ✅
- Lista nas seções 11 e 13 do planejamento da S2:
  - textos e regras do login e do e-mail;
  - cópia e limpeza;
  - exemplos fictícios;
  - regra de escolha da T1;
  - regras das candidatas (famílias, pisos e tetos de custo, nota, fallback distinto);
  - "sem dígito fora de referência" e palavras proibidas;
  - teto diário da chave pública;
  - barra lateral só com itens que funcionam;
  - porta `MailSender`;
  - tabelas da `0002`;
  - limites persistidos;
  - apelidos curtos no prompt;
  - `SEED_VERSION` 2.

### Implementação da S2 — decisões da IA (D101)
**D131 — Modelos da extração escolhidos pela T1** (20/11, IA pela regra [C] aprovada no plano) ✅
- Principal `google/gemini-3.1-flash-lite` (nota 1,000 nos 3 fictícios e na foto real; p50 2,4 s; US$ 0,0017 por cardápio). Reserva `openai/gpt-6-luna` (0,994; empatou com `deepseek-v4.1-flash`, desempate pelo menor custo — e sem a ressalva de dados na China).
- Linhas de base: Tesseract + regras 0,46; Google Vision + regras 0,42; Vision + LLM de texto 0,73 → a IA de visão é o caminho (D128 respondida com número).
- Pacote e kit usam os mesmos dois modelos, provisoriamente, até a T3 da S3 [C].
- A foto real enviada pelo candidato entrou só na avaliação (`eval/privado/`, fora do produto e da cópia pública); os itens extraídos dela não são gravados nos resultados.
- Relatório: `eval/relatorio-t1.md`; processo: `docs/planejamento/notas-ia.md`.

**D132 — SES: identidade do remetente pendente** (20/11, bloqueio do candidato) ✅
- Preflight: conta fora do sandbox e envio habilitado em `sa-east-1`, mas `case.automato.pro` não está verificado nessa região ("Email address is not verified"). Usuário IAM `automato-ses` (do outro projeto; reputação compartilhada — risco já aceito na D118).
- Ação do candidato: verificar o domínio `case.automato.pro` (DKIM) no SES de São Paulo e, de preferência, DMARC. Até lá o login real em produção falha com "Não conseguimos enviar o código agora"; o link do avaliador (D126) continua funcionando. Conferido de novo antes do merge.
- O endereço do simulador do SES (E2E de produção) fica isento do limite por e-mail (só IP e global), porque não entrega a ninguém [C].

**D133 — Ajustes [C] da implementação da S2** (20/11, IA [C]) ✅
- **Candidatas (muda a regra 4 da seção 4.5 do plano):** item grátis entra se o **preço ≤ 50% do `ticket_ref`**; o teto de **custo ≤ 35%** só vale quando o custo é conhecido (margem declarada). Alternativa: manter só o teto de custo sobre o preço cheio. Trade-off: com o preço cheio como custo (sem margem), quase nenhum item passava e o pacote ficava vazio no restaurante novo. Achado pelo teste de Configurações.
- **pdf.js fora do webpack:** servido de `public/vendor/pdfjs-<versão>/` e importado com `webpackIgnore`; um teste confere a pasta contra a versão instalada. Alternativa: empacotar (padrão). Trade-off: um passo manual ao atualizar a dependência × −90 MB no pico do build (1,48 → 1,39 GB).
- **Pico do build em 1,39 GB** (acima da linha de ~1,2 GB das notas, que era o critério para trocar o Turbopack pelo webpack, já trocado). O crescimento vem do nº de rotas (26 rotas de API, ~15 páginas). Aceito: a VPS tinha ~2,4 GB livres; a memória livre é conferida antes do merge. Alternativa: dividir o build ou reduzir rotas (custo alto, ganho incerto).
- **Fila serializada da cópia da vitrine** no pool do seed (1 conexão) e estado `setup_status` com vencimento de 120 s.
- **Rotas de E2E:** contas `via=e2e` e o restaurante de E2E isentos dos limites por restaurante (já previsto no plano; estendido às rotas públicas do check-in).
- **Passo 5 sem `router.refresh()`** depois de ativar (o refresh redirecionava para fora do assistente antes de o dono ver "Ver meu kit").
- **Faixa nova em Configurações:** a oferta vem de "Sugerir com IA" (tarefa 3 com uma faixa) ou, sem IA, da maior nota livre.
- **E2E com axe espera o `<title>`** (durante o `router.refresh` o título some por alguns ms e o axe acusava falso positivo).

**D134 — Itens [C] da revisão da S2** (20/11, IA [C]) ✅
- **Convite que vale o "agora":** `buildCandidates` prefere, em cada família, o item cujo valor para o cliente (preço do item grátis ou parte descontada) alcança o do benefício da 1ª visita; as que alcançam vêm antes na lista. Alternativas: excluir as que não alcançam (pacote vazio em cardápio pequeno) ou deixar como estava (convite mais fraco que o "agora" contradiz a tese). A nota continua só econômica (D121).
- **Contrato do plano (`planContentSchema`) ajustado:** opções da faixa podem vir vazias; `candidateId` pode ser `manual:<kind>:<itemId>` (o dono escolheu fora das candidatas); textos guardados com folga (800/1200), porque o limite de 160/400 vale para o texto renderizado e já é conferido pelos guardrails. A ativação confere o contrato (`planContentFromRow`) e registra em log se algo escapar, sem travar o dono.
- **Conta do link do avaliador usa a chave de demo** (o teto da chave pública pode ser gasto por terceiros); a IA da faixa nova conta no limite do pacote (10/dia).
- **Texto do dono no kit e no recado:** dia, turno ou item de convite viram aviso (não bloqueio, como na D125), porque aparecem também para o grupo de controle.
- **Horário dentro de frases por extenso** ("terça, quarta e quinta, das 15h às 18h"); rótulos curtos continuam nos títulos.
- **Fatos declarados com unidade** ("4 mesas", "300 clientes por semana") e intensidade no feminino ("muito vazia", concordando com "a faixa").
- **Limites novos:** contas novas 10/dia por IP e 100/dia no total; corpo do upload até 24 MB; até 8 horários vazios; IP pelo último item do X-Forwarded-For; sessão do dono com validade de 30 dias no servidor.
- **Uma versão vigente por benefício:** lock do restaurante nas edições + índice único parcial (migração 0003, que antes acerta duplicatas).
- **Dívidas para a S3:** editar versão já impressa (A/B), número "IA ≠ maior nota" em "Qualidade da IA", métricas no painel, aviso de item antigo no texto editado, cartão do garçom na cópia da vitrine, limpeza de acoplamentos, polimento visual (raio, ícones, Stepper no celular).

**D135 — Remetente do código de login em `msg.automato.pro`** (20/11, candidato) ✅
- Muda a D118 ("subdomínio novo `case.automato.pro`"): o domínio novo não estava verificado no SES de São Paulo (D132). `msg.automato.pro` já está verificado (DKIM) e tem DMARC; a troca é só a variável `MAIL_FROM` = `Comer Fora no Salão <acesso@msg.automato.pro>` no Easypanel, sem DNS nem código.
- Alternativas: verificar `case.automato.pro` (DKIM na Hostinger, minutos a horas); usar `envios.automato.pro`. Trade-off: reputação de envio dividida com o outro projeto — já dividida antes, porque a conta SES e o usuário IAM são os mesmos.

## L. Fatia S3 — Painel, plano da semana, apresentação e bastidores (planejamento de 20/11)
Detalhes, revisão independente (2 subagentes) e itens [C] em [docs/fatias/S3/planejamento.md](../fatias/S3/planejamento.md).

**D136 — S3 sem corte, 1 merge no fim** (20/11, U) ✅
- Ritual padrão: uma revisão e um merge ao fim da fatia; a ordem protege o núcleo e os extras entram por flag (desligados se não estiverem prontos).
- Alternativas: 2 merges (núcleo, depois extras — recomendado pela IA); só o núcleo; dividir em S3 e S3b; depois da revisão do plano, gatilho de contingência em 22/11 às 14h (recomendado pela revisão de produto) — **recusado: merge único sempre**.
- Trade-off: diff grande perto do congelamento × menos ciclos de revisão.

**D137 — T3 em 3 camadas** (20/11, U) ✅
- Checagem por código (JSON, guard, referências, "IA ≠ maior nota", latência, custo) + **juiz de IA cego e fixo** (provedor que não concorre, nunca Anthropic) + **nota cega do candidato** (~10 pares), com a concordância entre os dois no relatório.
- A linha de base sem IA ganha uma justificativa modelo montada pelo código, para não ser reconhecível (revisão técnica).
- Alternativas: só juiz de IA (recomendado); só o candidato; só regras.

**D138 — Prompt global com senha + tom por restaurante** (20/11, U) ✅ (estende D58)
- Bastidores (senha): bloco de instruções/tom por tarefa, com versões, "testar com exemplo", publicar e voltar; flags.
- Configurações do dono: "Tom da IA do seu restaurante" (≤ 200 caracteres), que entra como dado delimitado no conteúdo do usuário (não no `system`), com "Ver como fica".
- Alternativas: só global (recomendado); só por restaurante. Trade-off: +2–3 h e mais uma entrada livre no prompt × o avaliador também "muda na hora".

**D139 — `BASTIDORES_PASSWORD` gerada e gravada pela IA** (20/11, U) ✅
- Gravada no `case-salao-app` pelo conector do Easypanel, sem ecoar no chat; o candidato lê no Easypanel. Mesmo procedimento da D105. Alternativa: o candidato cria (D86).

**D140 — "Antecipar convite em 1 dia" no 2º card e na Jornada (só restaurante de teste)** (20/11, U) ✅ (ajusta espec. 3.1, que o punha só nos Bastidores)
- Alternativas: painel no Início do restaurante de teste; Bastidores sem senha.

**D141 — No restaurante de teste, "Antecipar" também encaixa o horário** (20/11, U) ✅
- Achado do planejamento: o código do convite exige volta em outro dia **e** dentro da faixa; recuar 1 dia (visita e convite, por causa de "1 check-in por dia") não resolve a faixa.
- Se agora estiver fora da faixa, o convite ganha `test_valid_day = hoje` e vale fora do horário só naquele dia; card, código e Validar mostram "Só no teste: liberado hoje, fora do horário".
- Quebra a faixa congelada (D218) só no sandbox, de forma declarada. Alternativas: só aviso + roteiro; horário de teste no assistente.

**D142 — Reativação usa até 50% do teto livre por faixa** (20/11, U, a partir da revisão do plano) ✅ (ajusta espec. 3.3)
- A prévia diz quanto vai usar e quanto sobra para a mesa. A cota é decidida antes do sorteio do grupo (intenção de tratar): sem vaga, pula convidável e holdout.
- Alternativas: teto todo (espec.); o dono escolhe na hora.

**D143 — Motivo visível quando o 2º card não aparece, só em restaurante de teste** (20/11, U, a partir da revisão do plano) ✅ (complementa D112)
- "Este cliente caiu no grupo de controle (1 em 10)…" ou "O teto de convites desta semana acabou." + "Testar como outro cliente". Vitrine e cópias continuam sem nada (holdout não contaminado).
- Alternativa: só no roteiro.

**D144 — "Visão da plataforma" nos Bastidores públicos** (20/11, U, a partir da revisão do plano) ✅
- `/bastidores/plataforma`, agregada sobre as contas do protótipo (sem E2E): restaurantes ativados, % divulgando, novos usuários do Comer Fora vindos do salão, tempo até ativar, abandono por passo (H5), custo de IA por restaurante e conta de bolso rotulada [H].
- Alternativas: por flag no fim; só no slide e na entrevista.

**D145 — Itens [C] da S3** (20/11, IA [C]) ✅
- Lista na seção 13 do planejamento da S3: limiares do veredito (10 convites; 15%; sem critério de custo), segmentos, funil (só convites da mesa), reativação como função pura única também no simulador (`SEED_VERSION` 3, vereditos calculados), Simular 30 dias com `idScope` e só até a semana anterior, CSP só em produção, rotas com despacho por segmento, MCP em JSON-RPC escrito à mão, SIGTERM manual, kit travado só com leituras, entre outros.

### Implementação da S3 — decisões (D101)
**D146 — Semente da vitrine trocada para 20261157** (20/11, candidato decidiu trocar; critério final [C]) ✅ (ajusta D111 "semente 20261123")
- Achado: com a reativação como função pura única também no simulador (D142, revisão T-B3), a semente 20261123 passou a dar `inconclusivo` nas cópias criadas às quintas-feiras. A robustez geral se manteve: IC > 0 em 132 de 140 combinações (20 sementes × 7 dias da semana) e em 16 de 20 sementes para 23/11.
- O candidato escolheu trocar a semente (recomendação: 20261124, a primeira positiva nos 7 dias). Ao rodar a suíte, a 20261124 falhou em outros 2 critérios já existentes dos testes: o IC conter o efeito programado (+0,20) e o teto da semana em curso ter folga. Pelo critério completo, só 3 de 40 sementes (20261124–20261163) passam nos 7 dias; ficou a de maior folga, **20261157** (limite inferior do IC ≥ +0,068; uso do teto da semana ≤ 50%).
- Declarado em "Como funciona": a semente foi escolhida entre as que cumprem os critérios, e a robustez é medida em 20 sementes. O efeito declarado (+0,20) não muda.
- Alternativas: manter 20261123 (quinta-feira `inconclusivo`); voltar à reativação antiga só no simulador (contraria espec. 3.8).

**D147 — Modelos do pacote/plano e do kit pela T3: google/gemini-3.8-flash + reserva openai/gpt-6-luna** (20/11, IA [C] pela regra fixada no planejamento da S3; nota cega do candidato pendente) ✅ (ajusta D51 "provisórios até a T3")
- Achado da 1ª rodada: o prompt usava `{horario:FAIXA}` como marcador e 3 modelos copiaram "FAIXA" literalmente (o guard reprovou). Correção: `{horario:X}` com exemplo (`{horario:A}`); versões `pacote-v2`/`plano-v2`. A 1ª rodada foi descartada.
- 2ª rodada (5 fixtures × 2 repetições; juiz fixo e cego `moonshotai/kimi-k3.1-pro`): elegíveis pela regra (regras ok ≥ 90%, p50 ≤ 15 s) só gemini-3.8-flash (90%; p50 2,8 s; juiz 4,42) e gpt-6-luna (90%; 1,5 s; juiz 3,53). Vence a maior média do juiz; a reserva é o melhor elegível de outro provedor. Nos 9 pares cegos (vencedor × linha de base), o juiz prefere a IA em 8.
- Kit [C]: segue o vencedor (não foi medido na T3; mesma família de texto curto com referências).
- Trade-offs: ~10× o custo por chamada (US$ 0,002 contra 0,0002) e ~1,3 s a mais de p50 × melhor nota do juiz. Amostra pequena: a ordem entre modelos próximos pode mudar de uma rodada para outra (o gemini-3.1-flash-lite caiu de 80% para 70% em regras entre as rodadas).
- Alternativas: gpt-6-luna como principal (mais barato e rápido, nota menor); manter os provisórios (gemini-3.1-flash-lite ficou abaixo de 90% em regras).
- Nota cega do candidato (20/11, 9 pares pelo chat): preferiu a IA em 8 de 9 (só o par 5, desconto em Temaki, ficou com a linha de base). Concordância com o juiz: 7 de 9 (78%; IC 95% de Wilson 45%–94%; κ 0,55, indicativo). A escolha se mantém.

**D148 — Os 5 recursos com flag entram ligados por padrão; revisor fora das contas E2E** (20/11, IA [C]) ✅
- A, B, C: A/B com "promover vencedora" (só com amostra e diferença significativa), insight 4 (alertas de teto, peça 2× pior e turno com ≥ 30% de códigos sem validação), revisor (deepseek, 3º provedor), aprende (edições do dono que passam no guard viram exemplos de estilo) e MCP (JSON-RPC escrito à mão, token com hash). Todos com testes de unidade e integração.
- Regra do plano ("ligado só se testado") cumprida; os Bastidores desligam qualquer um ao vivo.
- Revisor: "revisando" (até 20 s) e "bloquear" seguram aprovar e imprimir; texto reescrito pelo dono libera (ele assume o texto, com o guard em modo dono). Contas `via=e2e` ficam fora do revisor (custo e espera não determinística nos testes de produção).
- Limiares [C]: peça "2× menos" só com ≥ 50 leituras por versão; turno com códigos sem validação só com ≥ 10 códigos em 30 dias.
- Alternativas: tudo desligado até a S4; ligar só A/B e alertas (sem custo de IA). Trade-off: mais superfície na demo × critérios 3 e 4 (IA e negócio) visíveis no produto.

### Revisão da S3 — decisões (D101)
**D149 — O revisor confere só os textos que chegam ao cliente** (20/11, IA [C], ajusta D148) ✅
- Achado da E2E profunda: o revisor bloqueava planos bons porque recebia a oferta pelo título genérico ("Entrada grátis") e via o prato no convite; corrigido passando o ganho concreto ("Bruschetta grátis"). Mesmo assim, numa medição com IA real (eval/run-revisor.ts, 10 planos), ele bloqueou 2 de 10 por "números inventados" nas justificativas ao dono, números que o código escreveu a partir dos dados do restaurante.
- Decisão: revisar só os convites (plano) e as peças e o recado (kit), que chegam ao cliente. Justificativa e "o que aprendemos" são para o dono e já passam pelo guard (referências, sem dígitos da IA). Remedição: 0 de 10 bloqueados, 3 com "atenção" (não bloqueia).
- Também: a liberação do "bloquear" no plano exige que o dono reescreva TODOS os convites; o veredito do kit não sobrescreve um texto editado durante a revisão; o revisor vale também pelo MCP (está dentro de `generateWeeklyPlan`).
- Alternativas: rebaixar "bloquear" para "atenção" (perde o freio); passar os fatos ao revisor (mais contexto no prompt, mais chances de erro de leitura).

**D150 — Dívidas da S3 fechadas depois do merge** (20/11, candidato pediu "corrija as dívidas"; foto: candidato escolheu nova busca no Commons; resto IA [C]) ✅
- **Limites diários:** viram à meia-noite de SP, não às 21h (UTC). Teste nas bordas 20h59/21h01 e 23h59/00h01.
  - Alternativa: manter UTC (documentado). Trade-off: nenhum relevante.
- **"Antecipar 1 dia":**
  - grava `invites.advanced_at`; a repetição idempotente só vale com o marcador;
  - convite nascido ontem de verdade não ganha liberação fora da faixa (migração aditiva 0005, que também tira o índice redundante `plan_sends_plan_idx`).
- **Modo apresentação:**
  - com menos de 1024 px para o Portal, o iframe fica com 1024 px lógicos e é reduzido em escala (ex.: 0,80 a 1280 px), em vez de cair no layout de celular;
  - a barra lateral "Comer Fora no salão · Novo" fica visível. Alternativa recusada: barra de ícones entre 768 e 1023 px em todo o Portal (mexe no layout real).
- **Foto do salão:** colorida, "Modern dining area with wooden decor…" (Nenad Stojković, CC BY 2.0, Wikimedia Commons), com crédito em CREDITOS.md e em "Como funciona".
- **Limpezas:**
  - texto de faixa em `beneficios/domain/slot-text`; `randomSuffix` em `shared/random`;
  - tipos `Executor` no kit e na aprovação;
  - o plano reaproveita as linhas de clientes.
- **Polimento:**
  - "Trocar de lado" sem sessão mostra aviso no login;
  - "Validar código" com contorno;
  - Qualidade sem "D121".

## M. Replanejamento de 21/11 — Produto real e valor ao dono (fatias S4, S5, S6; entregáveis viram S7)
Detalhes, itens [C], sub-fatias e revisão independente (2 subagentes) em [docs/fatias/S4/planejamento.md](../fatias/S4/planejamento.md). Origem: o candidato pediu foco em valor para o dono e conversão de clientes (skill de copywriting), e tirar do produto tudo que o apresenta como teste/simulação, mantendo só a barra de protótipo. Ele também apontou "pouca inovação, resultado e técnica"; a análise crítica concordou: o diferencial mora nas regras e só aparece em "Como funciona", o resultado vem de um efeito programado e a técnica fica nos Bastidores.

**D151 — Fatias novas S4–S6 até segunda 23/11 às 10h; entregáveis (antiga S4) viram a S7, a última** (21/11, U) ✅
- Alternativas: fatia única até domingo 18h (recomendado pela IA); só limpeza + landing.
- Trade-off: mais produto × S7 (slide, vídeo, repositório público, preparação) espremida entre 10h e 15h de segunda.

**D152 — Sistema real só com seed** (21/11, U) ✅ (substitui D140, D141, D143 e a "simulação declarada" da espec. 3.1)
- A cópia da Cantina aparece sem "demonstração"/"simulado". O restaurante criado é real e começa vazio, com "Primeiros passos".
- Saem do produto: "Simular 30 dias", "Limpar simulação", "Antecipar 1 dia", "Importar do delivery (simulado)" e o motivo do grupo de controle mostrado ao cliente.
- Alternativa: manter "Simular" com outro nome.

**D153 — "Avançar 1 dia" nos Bastidores (Ferramentas do avaliador)** (21/11, U) ✅
- Alternativas: tirar de vez (fere "funciona sem depender do candidato"); regra "voltar hoje" (muda o domínio).

**D154 — Cliente entra com nome, telefone e e-mail + código de 6 dígitos por e-mail; campos livres, sem pré-preenchimento** (21/11, U) ✅ (substitui D22/D30/D31 no que se refere a dados fictícios do cliente)
- Alternativas: identificação em degraus (recomendado); só telefone; pré-preenchido realista.
- Risco aceito: dado pessoal real de clientes (ver D161).

**D155 — Reativação entregue de verdade** (21/11, U) ✅
- Convite na Jornada ("Seus convites", com aviso de novo) e por e-mail para quem consentiu. Alternativa: só tirar "(simulado)".

**D156 — Atalhos: fica só "Como funciona" na barra** (21/11, U) ✅
- Saem o roteiro da entrada, "Trocar de lado" e "Testar como outro cliente" (vira "Sair" na Jornada). Caminho real para o cliente: QR do kit e "Ver minha página".

**D157 — Vídeo da S7 com telas reais (roteiro automatizado no Playwright, legendas e narração por IA)** (21/11, U) ✅
- Alternativas: vídeo gerado por IA (inventa telas); sem vídeo.

**D158 — Apostas: ciclo semanal por e-mail com Aprovar, plano como agente com ferramentas e "Por que esta oferta?"; kit ampliado só no porta-conta** (21/11, U) ✅
- Alternativa recusada: arte do kit gerada por IA (prato que não existe; contraria o kit sem fotos).

**D159 — Agente decidido por número** (21/11, U) ✅
- T3 refeita com código + juiz cego, agente × chamada única no mesmo modelo, em pares cegos (revisão técnica). Vira padrão com regras ok ≥ 90%, p50 ≤ 20 s e juiz não pior; senão fica atrás de flag desligada. Critério indicativo (n pequeno).

**D160 — Ordem de corte** (21/11, U) ✅
- (1) limpeza + login do cliente + reativação entregue + Bastidores; (2) painel em R$ + meta + feed; (3) landing, página do QR, convite com agenda; (4) "Por que esta oferta?"; (5) ciclo semanal por e-mail; (6) modo garçom; (7) agente; (8) porta-conta. Corte: domingo 22h, por flag.

**D161 — Login completo no check-in, com linha de consentimento e retenção de 7 dias** (21/11, U, após a revisão de produto) ✅
- "Protótipo de case, não é o iFood. Seus dados são apagados em 7 dias" + "Apagar meus dados" na Jornada. Aparelhos da demo logados antes (cookie de 180 dias).
- A revisão de produto apontou como bloqueante o anti-objetivo "página confundida com o iFood que colete dados reais" e a queda do funil. Alternativas: e-mail só para guardar o convite (recomendado); sem aviso.

**D162 — Selo "Restaurante de exemplo · histórico gerado" na Cantina** (21/11, U, após a revisão de produto) ✅ (mantém D209)
- Topo em R$: "R$ X a mais em margem entre N convidados até agora" (a margem soma todas as janelas fechadas, não "30 dias"). Alternativa: sem rótulo.

**D163 — Tudo por e-mail** (21/11, U) ✅ (reabre a mitigação "e-mail sem logo e sem link" da D118)
- Resumo semanal do dono com "Revisar e aprovar" + convite, lembrete e reativação por e-mail aos clientes com consentimento. Texto simples, sem logo, links só para o nosso domínio, aprovação por POST. Alternativas: só o resumo do dono (recomendado); sem agendador.

**D164 — Rodapé "Protótipo" no impresso e no e-mail; barra sem "dados fictícios"** (21/11, U) ✅
- Barra: "Protótipo de case · não é produto oficial do iFood".

**D165 — Consentimento continua ligado por padrão** (21/11, U) ✅
- A IA propôs desmarcado (LGPD, dado real); o candidato manteve como na espec. e no app. Risco registrado e declarado em "Como funciona".

**D166 — Plano como agente reabre a D215** (21/11, U via D158) ✅
- Defesas da D215 mantidas: ferramentas só de leitura sobre fatos agregados (sem texto livre do cardápio nem PII), saída final presa às candidatas, decisão por número (D159).

**D167 — 1 merge no fim da S6** (21/11, U) ✅ (mantém D12/D136)
- Alternativa: 2 merges, o 1º no sábado (recomendado pela revisão técnica, porque a S4 não tem flag).

**D168 — E-mails por evento + agendador; meta de merge antes de segunda 08:30** (21/11, U) ✅
- Por evento: convite ao nascer, reativação ao aprovar, "Enviar agora". Agendador: resumo do dono segunda 08:30 e lembrete no dia do convite, com regra de recuperação e estados reservado → enviado. Alternativa: só por evento (recomendado).

**D169 — Itens [C] do replanejamento** (21/11, IA [C]) ✅
- Lista completa em docs/fatias/S4/planejamento.md §3 e "Correções da revisão técnica": e-mail do cliente com HMAC (`cliente-email:`) + AES-256-GCM (`CUSTOMER_EMAIL_KEY`), e-mail como chave do cliente (telefone deixa de ser único), `owners.email_enc` (muda D118), enums internos mantidos, slugs pelo nome, seed v4 com sobrenomes comuns, .ics de 1 evento, 4 estados do topo, varredura de textos pelo Playwright, flag de emergência `login_cliente_email`.
