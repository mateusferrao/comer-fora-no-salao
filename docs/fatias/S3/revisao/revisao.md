# Revisão da fatia S3 — Painel, plano da semana, apresentação e bastidores

Data: 20/11/2026 · Base: `caf85ff` · Revisado: `b471a40` · Produção: `b471a40` (/api/health: db up, seed ok)

## 1. Resumo e veredito
- **Revisão feita:** 4 revisores independentes (aderência, técnica, produto/UX, segurança/IA) + E2E profunda feita por mim.
- **E2E profunda:** IA real no servidor standalone local, 43 verificações, capturas em `capturas/`.
- **Achados:** nenhum crítico de segurança. Os críticos e altos de produto e de correção foram corrigidos e testados (§2 e §6).
- **Veredito:** pronta para merge.
- **Suíte depois das correções:**
  - unidade: 271 verdes;
  - integração: 83 verdes;
  - E2E local: 64 verdes;
  - tipos, lint e fronteiras sem erros;
  - build com heap de 1 GB: pico de 1,08 GB de RSS.
- **Pendente:** a nota cega do candidato na T3 (D137). A página Qualidade diz "em andamento" até a resposta. Isso não bloqueia o merge.

## 2. Achados consolidados
Frentes: Ad (aderência), Tec (técnica), Pr (produto/UX), Seg (segurança/IA) e E2E (minha verificação).

| # | Gravidade | Frente | Achado | Decisão |
|---|---|---|---|---|
| 1 | crítico | Pr | Plano da vitrine: "Doce grátis" com veredito "trocar", mas mantido por falta de candidata | corrigido: aviso "Sem outra oferta válida… mantida, apesar do veredito" |
| 2 | crítico | Pr | Visão da plataforma: "Tempo até ativar" negativo; "US$ 0,0000" | corrigido: filtra `activated_at >= created_at`, mostra h/min e "< US$ 0,01" |
| 3 | alto | Ad, Tec, Seg | MCP gerava plano sem revisor (o agente aprovava sem revisão) | corrigido: revisor dentro de `generateWeeklyPlan` (mesmo update da proposta); teste no MCP |
| 4 | alto | E2E | Revisor bloqueava plano bom (oferta pelo título genérico; números das justificativas escritos pelo código) | corrigido: oferta concreta ao revisor; revisa só o que chega ao cliente (D149). Medição com IA real: 0 de 10 bloqueados |
| 5 | alto | Tec | Aprovar × check-in: ordem de locks invertida (deadlock ou erro 500) | corrigido: check-in faz `FOR SHARE` no restaurante e relê o contexto; teste com `Promise.all` |
| 6 | alto | Tec | Convites vencidos ainda "ativos" encolhiam a reativação em silêncio | corrigido: vencem no início da aprovação; teste |
| 7 | alto | Tec | Aprovação não gravava a semana: proposta de domingo aprovada na segunda virava "Vencido" | corrigido: `weekKey` da aprovação; teste |
| 8 | alto | Pr | Teto em mesas por `cap/4`; opções sem o prato; "Por quê" desatualizado; aprovar ativo durante geração/revisão | corrigido: mesas = teto × uso real (+ custo esperado e teto sugerido); opção com o prato; aviso no "Por quê"; botão desabilitado com motivo |
| 9 | alto | Pr, Tec, Seg | "% aceitas sem edição" e "IA ≠ maior nota" contavam o "Exemplo pronto", o modo sem IA e contas E2E | corrigido: só planos da IA e sem E2E |
| 10 | alto | Ad | Página Qualidade afirmava nota cega humana ainda não feita; "cego" sem ressalva | corrigido: "nota humana: em andamento" e a ressalva da linha de base reconhecível |
| 11 | médio | Seg | Liberação do "bloquear" ampla demais; veredito do kit sobrescrevia edição feita durante a revisão | corrigido: o dono precisa reescrever todos os convites; o veredito só vale se o texto ainda está "revisando" |
| 12 | médio | Seg | Tom cortado em 60 caracteres; aceitava `«»`, e-mail e telefone | corrigido: `toneForPrompt` (200), recusa delimitador e PII; testes |
| 13 | médio | Seg | Páginas públicas pesadas sem cache | corrigido: memo de 60 s por processo |
| 14 | médio | Tec | `generateWeeklyPlan` sem try/catch: plano preso em "gerando" | corrigido: cai no modo sem IA |
| 15 | médio | Tec | Veredito pela versão atual: aprovar no meio da semana zerava "o que aprendemos" | corrigido: versão vigente na segunda 0h (SP); teste |
| 16 | médio | Tec | Polling de 3 s empilhava requisições | corrigido: uma por vez |
| 17 | médio | Tec | Kit: `regenerateField` não rechecava a trava depois da IA | corrigido |
| 18 | médio | Pr | Funil numa escala só: as barras do convite sumiam | corrigido: 2 grupos, cada um com a sua escala |
| 19 | médio | Pr | Métrica sem período; margem negativa como "a mais"; "inconclusivo" em destaque | corrigido |
| 20 | médio | Pr | Semana em linguagem técnica ("sem. 47") | corrigido: "Semana de 16–22/11" |
| 21 | médio | Pr | Reativação com faixa zerada ("Usa até 0…") | corrigido: "não usa convites desta vez" |
| 22 | médio | Ad | Visão da plataforma: 20% com denominador diferente; conta de bolso sem meta | corrigido: "% dos criados" + ressalva; meta de ~125 novos usuários/ano por restaurante [H] |
| 23 | médio | Pr, E2E | Visão geral a 390 px rolava na horizontal; tabelas roláveis sem foco (axe) | corrigido |
| 24 | médio | Pr | `/apresentacao` a 1280 px abre o Portal no layout de celular | corrigido (pós-merge, D150): Portal em escala no modo apresentação |
| 25 | médio | Ad | Revisor sem taxa de falso bloqueio medida | corrigido: `eval/run-revisor.ts`, publicado em Qualidade |
| 26 | baixo | Seg, Tec | SIGTERM fechava o pool com requisições em andamento | corrigido: folga de 1,5 s antes de fechar o pool |
| 27 | baixo | Seg | `desde=1e20` derrubava a rota de eventos | corrigido: limitado à última hora |
| 28 | baixo | Tec | Aprovar e descartar sem limite | corrigido: 30/h |
| 29 | baixo | Tec | MCP comparava `Origin` com `req.url` (proxy) | corrigido: aceita também a origem pública |
| 30 | baixo | Seg | Faltavam testes: rotas dos Bastidores sem cookie; token A × plano B | corrigido: E2E (roda em produção) e integração |
| 31 | baixo | Seg | Índice único de `plan_sends` sem pré-checagem na migração | corrigido: deduplicação antes do índice na 0004; migração testada do zero |
| 32 | baixo | Pr | "Testar como outro cliente" 2×; faltava "Fazer check-in de novo" | corrigido |
| 33 | baixo | Pr | `summary` da métrica com a frase inteira | corrigido: só "Como medimos" |
| 34 | baixo | Tec | "Já antecipado" aceita convite emitido ontem sem marcador | corrigido (pós-merge, D150): marcador `advanced_at` |
| 35 | baixo | Ad | Selo "simulado" só na métrica; Plataforma conta ensaios do candidato | não corrigir: o cabeçalho da cópia já declara os 60 dias de exemplo; ensaios são uso real do protótipo |
| 36 | baixo | Tec | `tx as unknown as Db`; índice `plan_sends_plan_idx` redundante; `loadCustomerRows` 2× no plano | corrigido (pós-merge, D150) |
| 37 | baixo | Pr | "Trocar de lado" sem aviso; "D121" na Qualidade; "Validar" em vermelho compete com "Revisar plano" | corrigido (pós-merge, D150) |
| — | — | Seg | `isEvalSupported: false` no pdf.js | não procede: a opção não existe no pdf.js 6 (testado na S3.1); o E2E de PDF com a CSP passa |
| — | — | E2E | Links de 17 px ("Abrir como cliente", "ver Clientes", "Como funciona") | não procede: links dentro de frases (exceção da WCAG 2.5.8) |
| — | — | Pr (S2 #38) | Raio dos botões 2 px | não procede: 4 px, igual à captura portal/02 |

## 3. Matriz E2E (local, IA real, servidor standalone)
| Cenário | Persona | Telas | Observado | Evidência | Veredito |
|---|---|---|---|---|---|
| Link do avaliador → Visão geral | avaliador | 1280 | cópia pronta em 4,1 s; métrica positiva; A/B e alertas | A01–A03 | ok |
| Plano: gerar com IA → revisor → aprovar | avaliador | 1280 | gerado em 9,4 s, "Gerado pela IA"; revisor "ok"; aprovado e "enviado para 106 clientes (simulado)" | A04–A07 | ok (antes da correção 4: bloqueio falso — A06 da 1ª rodada) |
| Clientes, Kit, Configurações, Agente/MCP | avaliador | 1280 | axe limpo; token gerado; `tools/list` = 4; `ler_insights` só agregados | A08–A11 | ok |
| Mesmas telas | avaliador | 390 | sem rolagem horizontal; axe limpo | B01–B05 | ok (antes: 116 px e `scrollable-region-focusable`) |
| "/", Como funciona, Qualidade, Plataforma, Bastidores | público | 390 | axe limpo; `x-robots-tag: noindex`; CSP | C01–C05 | ok |
| Bastidores: testar com exemplo (kit e plano) | candidato | 1280 | 3,3 s e 5,9 s com IA real; saída renderizada | C06 | ok |
| Suíte automatizada | todas | 390/1280 | 64 verdes: antecipar, holdout com motivo, simular/limpar, apresentação, PDF+CSP, Bastidores (local) | `tests/e2e` | ok |

## 4. Matriz E2E (produção, `b471a40`)
| Cenário | Esperado | Observado | Evidência | Veredito |
|---|---|---|---|---|
| CI na `main` (check, integração, E2E, deploy) | tudo verde | run 49 verde; deploy esperou o SHA no /api/health | GitHub Actions | ok |
| E2E contra produção | specs de fumaça, cliente, dono, painel, volta, entrada e apresentação verdes | 41 passaram; 4 pulados de propósito (só locais: criar restaurante, Bastidores com senha) | job `deploy` | ok |
| Páginas públicas a 390 e 1280 px | 200, axe limpo, sem rolagem lateral, sem "undefined/NaN" | ok em "/", Como funciona, Qualidade, Plataforma, Bastidores › Config; `noindex` e CSP presentes | P01, P02 | ok |
| Rotas dos Bastidores sem senha | 401 | 401 (E2E) | entrada.spec | ok |
| MCP sem token | 401 | 401 | verificação manual | ok |
| Vitrine pública | 200 | `/r/cantina-nonna-lucia` 200 | verificação manual | ok |

## 5. Console, rede, tempos e acessibilidade
- **Console e rede:** sem erros depois das correções. Os únicos 409 vieram do bloqueio falso do revisor, que foi corrigido.
- **Tempos com IA real:**
  - gerar plano: 5,4–9,4 s;
  - revisor: ~2–4 s;
  - testar com exemplo: 3,3 s (kit) e 5,9 s (plano).
- **Acessibilidade:** axe sem violações em todas as telas visitadas, a 390 e 1280 px.

## 6. Correções aplicadas
Commits "fix(s3): revisão — …", "fix(ia): revisor só nos textos que chegam ao cliente (D149)…", "fix(a11y)…" e "test(e2e)…" no branch da sessão. Cada um foi verificado com os testes citados em §2.

## 7. Decisões novas registradas
- **D147:** modelos pela T3.
- **D148:** extras ligados por padrão.
- **D149:** o revisor só nos textos que chegam ao cliente.

## 8. Produção
Merge em avanço rápido na `main` (`b471a40`), com 2,3 GB livres na VPS antes do build. Deploy e E2E de produção verdes (§4).

## 9. Dívidas fechadas depois do merge (D150)
`/apresentacao` a 1280 px (Portal em escala 0,80, barra lateral visível — captura D01), marcador de antecipação, limpezas técnicas (índice redundante, tipos, consulta duplicada, acoplamento), limites diários na meia-noite de SP, polimento (aviso do "Trocar de lado", Validar com contorno, Qualidade sem "D121") e foto colorida do salão (D02). Verificação: unidade 271, integração 85, E2E local 66, migração do zero (6) e build com pico de 1,21 GB.
Produção: `b369045` (/api/health: db up, seed ok; migração 0005 aplicada). CI run 52 verde, com E2E de produção de 43 testes (4 locais pulados), incluindo `/apresentacao` a 1280 px com a barra lateral do Portal e o aviso do "Trocar de lado". Conferência manual em produção: foto nova (P03), créditos em "Como funciona" e Qualidade sem "D121".
