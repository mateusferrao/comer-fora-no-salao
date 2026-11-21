# Planejamento da fatia S8 — Copiloto do salão (roda antes da S7)

Status: **aprovado em 21/11/2026 (~21h SP) pelo candidato.** Planejado num worktree separado (outra sessão mexe no código em paralelo e já usou D238–D246 e a migração 0009; por isso esta fatia usa **D260–D271** e a migração **0010**). Roda antes da S7 (entregáveis).

## Contexto
O candidato pediu um agente de IA em formato de chat para melhorar a experiência do dono no **onboarding** (ativação em 5 passos) e nas **edições** (Configurações com 7 abas e 2 formas de salvar — dívida D231; plano; kit). Isso reabre a D211 ("chat descartado: Toqan já faz; conversa sozinha não é produto") e o anti-objetivo "virar chat com IA". Novo argumento: **não é conversa sozinha, é interface sobre ações que o código valida** — a IA propõe, o código confere e calcula, o dono aplica com 1 clique — e a mesma camada de ferramentas é exposta a agentes externos pelo MCP (catálogo único, 2 portas; #EatYourOwnDogFood, "AI-operable"). Prazo: corte por flag domingo 22/11 22h; S7 segunda 10–15h; entrevista 17h.

## 1. Entrega testável
Painel "Assistente do salão" no Portal. O dono escreve um pedido ou dúvida e recebe resposta com valores escritos pelo código e **cartões de proposta** (antes → depois, alcance real, impacto/custo do código, avisos) com Aplicar / Editar no formulário / Descartar. Aplicar chama as **mesmas funções de aplicação** de hoje. No passo 2 do onboarding, uma frase preenche o formulário "Seu salão". O MCP passa a usar o mesmo catálogo (leituras novas, clientes sem contato, propor + aplicar). Métricas em Bastidores › Qualidade da IA.

## 2. Decisões (U = candidato; [C] = IA)
| ID | Decisão | Alternativas | Quem |
|---|---|---|---|
| D260 | Copiloto que **age por proposta**; reabre D211 com novo argumento; o assistente de 5 passos continua | onboarding inteiro por chat; só dúvidas; não fazer | U |
| D261 | **Sempre cartão + clique no Portal** (inclusive aprovar plano); a IA nunca grava | aplicar direto o reversível; aplicar tudo | U |
| D262 | **Modelo vê clientes por nome, nunca contato**: primeiro nome + inicial e atributos (visitas, selos, segmento) por apelido `{cliente:C3}`; e-mail/telefone só na tela, escritos pelo código; Langfuse sem entrada/saída da tarefa `copiloto`. (1ª resposta foi "modelo vê tudo"; revista após os fatos da revisão: "Como funciona" ficaria falso, o aceite do cliente não cobre provedores, nenhuma ação usa contato) | modelo vê nome e contato; nada de clientes; só por referência | U |
| D263 | Demo: **60 s no bloco do plano (3:45–5:30)**, pedido por chip (nada digitado), cartão → Aplicar → campo destacado; o fechamento 6:45–8:00 continua com o candidato mudando tom/prompt + guardrails + Langfuse | fechar a demo com o copiloto; só se perguntarem | U |
| D264 | **"IA nunca escreve número" vale no chat**: resposta com `{fato}`, `{prato}`, `{horario}`, `{cliente}`; números das propostas em campos tipados | relaxar no chat | U |
| D265 | Onboarding: **"Seu salão" por frase + dúvidas** em qualquer passo | também ajustar pacote; só dúvidas | U |
| D266 | Modelo escolhido por **mini-avaliação T4**, regra fixada antes | reusar gemini-3.8-flash | U |
| D267 | **Catálogo único de ferramentas, 2 portas** (copiloto + MCP) | copiloto como cliente MCP; só MCP | U |
| D268 | **MCP vê clientes** do mesmo jeito que o copiloto (nome + atributos, sem contato) — ajustada junto com D262 | só agregados | U |
| D269 | **MCP edita por propor + aplicar** (`propor_*` não grava; `aplicar_proposta(id)` grava, `via: agente`) | só leituras (recomendado) | U (contra recomendação) |
| D270 | **Escopo: tudo, cortado por flag às 22h** na ordem do §7 | núcleo + onboarding (recomendado); núcleo + MCP | U (contra recomendação dos 2 revisores) |
| D271 | Itens [C] do §9 | — | [C] |

## 3. Produto e fluxos
- **Onde:** botão "Assistente" (desktop: flutuante embaixo à direita; celular: no cabeçalho fixo). Desktop: painel **não modal** de 400 px que **empurra** o conteúdo (formulário visível e atualizado ao aplicar). Celular: tela cheia modal (`useModalDialog`). Só dono logado; flag `copiloto`. Sem logo do iFood no painel; linha de protótipo no rodapé.
- **Desenho "pedido → cartões"** (não balões de chat): chips em destaque, um campo, poucas mensagens. Chips por tela (texto do código, escritos contra o seed): Convites "Trocar a oferta de Ter–Qui 15h–18h"; Cardápio "Tirar um prato das ofertas"; Plano "Aprovar com ajustes"; ativar/2 "Descrever meu salão"; Visão geral "Como foi a semana?"; Clientes "Quem está perto da recompensa?".
- **Turno:** mensagem (≤ 1000 caracteres) + histórico (12 turnos, só no navegador em `sessionStorage`) → agente com leituras (≤ 3 passos) → saída estruturada `{resposta ≤600, propostas[≤3], sugestoes[≤3]}` → guard → código monta os cartões (prévia) → tela.
- **Cartão:** título em linguagem do dono, antes → depois, **alcance real** ("vale Ter, Qua e Qui"), impacto ("até 8 convites/semana · custo máximo R$ 64"), avisos ("convites já emitidos continuam com a oferta antiga" — D218; "vai mandar e-mail para N clientes" na aprovação do plano), botões com nome próprio ("Aplicar: trocar a oferta de Ter–Qui"). Estados: pendente, aplicando, aplicada ✓ (seção remontada + destaque; no celular "Ver em Configurações › Convites"), recusada pelo código (motivo do `ERR` existente), expirada (30 min ou "antes" mudou), descartada. Aplicar avisa se a seção tem edição não salva.
- **Recusas visíveis:** pedido fora das regras vira explicação do código (ex.: "acabou o tiramisù" → "o Tiramisù é a recompensa da cartela: troque a recompensa antes"; desconto > 50%). Declarado: não existe "pausar só hoje".
- **Onboarding (D265):** em ativar/2, a frase vira um cartão que **preenche o formulário no navegador** (junta com o que já está; número que não aparece no texto do dono fica "não informado"); o dono revisa e clica "Continuar". Não grava nada. Fora da demo (a ativação da demo usa o exemplo em cache).
- **Modo sem IA:** "Não consegui responder agora" + atalhos do código para a aba certa. Sem erro 500.
- **Textos:** rodapé "As respostas usam IA e passam por provedores fora do Brasil. Nomes de clientes podem ser enviados; contatos não. No Portal, nada muda sem o seu clique." Nota de Configurações › MCP: "agentes conectados por token podem propor e aplicar mudanças". "Como funciona" e espec. §1 (linha Toqan, sem afirmar que ele "só conversa") atualizados no mesmo commit.
- **Métricas [H: o dono não ajusta porque Configurações é difícil — D231]:** propostas aplicadas ÷ mostradas; recusas do código; % de turnos sem IA; tempo pedido → aplicado; edições por copiloto × formulário; passo 2: tempo e abandono com × sem frase. Em Bastidores › Qualidade da IA.

## 4. Catálogo (D267) e ações
Módulo `src/modules/agente/` (`domain/`: tipos de ação, textos e diffs puros; `application/`: catálogo, prévia, aplicar, turno). Ferramenta: `{ name, description, input: Zod, kind: "leitura"|"proposta"|"escrita", portas: ("copiloto"|"mcp")[], execute(ctx) }`, `ctx = { db, restaurantId, ownerId, now, origin }` (restaurante sempre do contexto).
- **Leituras:** `ver_configuracao` (`getSettingsView`), `ver_numeros` (`getPlanInsights` + topo/funil, chaves `{fato}`), `ver_plano` (`getPlanView`), `buscar_clientes` (segmento/busca; nome + inicial, atributos, apelido; sem contato), `guia` (regras do produto, texto do código).
- **Propostas onda 1:** `oferta` (agora|recompensa|convite; item, tipo, %, teto, texto → `updateOffer`), `item` (disponível, fora das ofertas, preço/nome → `setMenuItemActive`/`setItemOfferAllowed`/`updateMenuItem`), `faixa` (editar/desativar → `updateSlot`/`deactivateSlot`).
- **Onda 2:** `aprovar_plano` com trocas/teto/texto (→ `approvePlan`, `scheduleInviteEmails` depois do commit, erro `revisor`, `ApproveVia` += `copiloto`), `tom`, `avisos`, `restaurante`, `item_novo`, `faixa_nova`, `kit` (campo/recado).
- **Copiloto:** propostas só na saída estruturada (sem ferramentas `propor_*`, para latência). **MCP:** as 4 ferramentas atuais migram sem mudar nome/comportamento (`gerar_plano`/`aprovar_plano` com `portas:["mcp"]`) + leituras + `buscar_clientes` (flag `mcp_clientes`) + `propor_*` e `aplicar_proposta` (flag `mcp_edicao`, só `origin='mcp'`). Ambas as portas usam a mesma `preview` + `applyProposal`.

## 5. Técnica
- **Gateway (aditivo):** `AiInput` += `{ messages: {role:"user"|"assistant"; text}[] }`; `toMessages` trata. **Spike na 1ª hora**: `Output.object` + união discriminada + tools nos 3 modelos da T4 via OpenRouter; se falhar, schema achatado (`acao` enum + `nullable`).
- **Tarefa `copiloto`** (`src/modules/ia/tasks/copilot.ts`): `RefContext` do turno **pronto do código** (resumo de `getSettingsView`, fatos, pratos, faixas e clientes com apelidos P1/F2/C3, como `slotByAlias`/`candByAlias` em `plan-agent.ts`); ≤ 3 passos; meta p50 ≤ 12 s; respeita `aiFeatures.agente` (D197).
- **Guard `chat`:** `GuardField` += `"chat"`; `GuardOptions.forbidden` opcional (mantém `reais`, `r$`, `metade`, `dobro`, `ifood paga`, `garantid`); bloqueia dígito cru, número por extenso, URL, PII crua, referência desconhecida, formato, tamanho. Referência nova `{cliente:alias}` em `src/modules/textos/domain/references.ts`.
- **Injeção indireta:** saída de ferramentas e dados de terceiros (nomes de clientes e pratos) num envelope `<dados_de_terceiros>` com `scrub` exportado de `owner-data.ts`; nenhuma escrita sem clique (Portal) ou `aplicar_proposta` explícito (MCP).
- **Prévia sem duplicar regra:** extrair `checkOffer(ctx, menu, input) → OfferError[]` puro de `updateOffer` (`update-settings.ts:84-101`) e de `approvePlanInTx` (`approve-plan.ts:95-100`), usado pelos três; custo por `unitCost` (`offers.ts:88`); `itemInUse`/`candidateCount` expostos na aplicação.
- **Dados — migração 0010 (aditiva, D103)** gerada por `drizzle-kit generate` no fim, depois de trazer a `main`: `agent_proposals` (id, restaurant_id, origin, action, payload jsonb, preview jsonb, base_hash, status pendente|aplicando|aplicada|descartada|expirada|falhou, error, ai_call_id, created_at, decided_at; índice por restaurante/data). Conversa não é guardada no servidor. `recordAiCall` passa a devolver o id.
- **Aplicar (idempotente):** `UPDATE … SET status='aplicando' WHERE id AND restaurant_id = loja atual AND status='pendente' AND created_at > now()-30min RETURNING` → recalcula o `base_hash` do "antes" (diferente → `expirada`) → função de aplicação (revalida tudo) → `aplicada|falhou`.
- **Rotas:** `POST /api/parceiro/copiloto` (turno; `rejectCrossSite`, `requireStore()` ou `{draft:true}` no onboarding, Zod, histórico com limite de bytes e papéis alternados, `consume` 60/dia e 10/10 min, isenção E2E e `PRESENTER_EMAILS`); `POST /api/parceiro/copiloto/proposta` (`{id, acao: aplicar|descartar}`). Chave: `gatewayFor(ex, keyKindFor(owner), now, env)` + teto diário próprio do copiloto (US$ 0,20) na chave pública, para não derrubar plano/kit.
- **Observabilidade:** `ai_calls` (task `copiloto`); Langfuse com `sessionId` e **sem entrada/saída** da tarefa copiloto (teste); nada de PII no stdout.
- **UI:** `src/ui/portal/copiloto/{CopilotLauncher,CopilotPanel,ProposalCard}.tsx`, montados no `PortalShell` (grid ganha coluna opcional no desktop) via `app/parceiro/salao/layout.tsx`; chips por `usePathname`. Seções do `ConfigManager` com `key` = hash dos dados da seção. `Step2Salao` recebe o preenchimento por um setter exposto ao painel (sem gravar).
- **Gateway falso do E2E:** só com `COPILOT_FAKE_AI=1` **e** chaves vazias **e** token E2E local; `/api/health` expõe `fakeAi:false` e a E2E de produção confere.

## 6. Testes
- **Unit:** `checkOffer` com valores exatos (60% → `desconto_acima_do_teto`; item de outra categoria → `categoria_incompativel`); prévia (teto 8 × custo 800 → "R$ 64"; Tiramisù → `em_uso`; faixa A → alcance "Ter, Qua e Qui"); guard `chat` (dígito cru, "doze", URL, e-mail, `{cliente:C9}` desconhecido → reprovam); `{cliente}` renderiza; `base_hash` estável; paridade do catálogo por porta e flag; `toMessages` com histórico; preenchimento do salão ignora número ausente do texto.
- **Integração (Postgres + gateway roteirizado, padrão `tests/integration/plan-agent.test.ts`):** turno → proposta → aplicar → oferta nova + `owner_edits` + `aplicada`; 2 aplicar em paralelo → 1 efeito; outra loja → recusa; vencida/"antes" mudou → `expirada`; gateway falho → sem IA; `buscar_clientes` sem e-mail/telefone na saída; MCP: 4 ferramentas antigas sem regressão (`tests/integration/mcp.test.ts`), `propor_oferta` + `aplicar_proposta`, flags desligadas escondem ferramentas; Langfuse sem entrada da tarefa.
- **E2E local** (`copiloto.on.spec.ts`, gateway roteirizado): chip → cartão → Aplicar → aba atualizada e destacada; recusa do Tiramisù; Esc/foco; axe; 390 px; ativar/2 por frase preenche sem avançar.
- **E2E produção / revisão (D09):** conversa real com a chave demo (pedido, recusa, aplicar, roteiro dos 60 s da demo); `fakeAi:false`.
- **T4 (D266):** `eval/run-t4.ts` — 12 pedidos com gabarito contra a cópia da Cantina (inclui Tiramisù/recusa, faixa A Ter–Qui, sábado sem faixa, dúvida, cliente perto da recompensa) × `google/gemini-3.8-flash`, `openai/gpt-6-luna`, `anthropic/claude-haiku-5.5` (conflito declarado) × 1; mede ação+parâmetros certos, recusa certa, resposta sem número cru, p50, custo. **Regra:** maior acerto; empate → menor p50; p50 > 12 s → sai da demo. < US$ 0,30; `eval/relatorio-t4.md`; linha em `notas-ia.md`.

## 7. Ordem de implementação e corte (D270; flags; corte domingo 22h)
1. Spike do gateway + multi-turno + guard `chat` + `{cliente}`.
2. `checkOffer` + `agent_proposals` + prévia + aplicar + rotas (onda 1).
3. Painel + cartões + chips; E2E local.
4. T4 → modelo; E2E produção. **← mínimo da demo (flag `copiloto`)**
5. Onboarding "Seu salão" por frase.
6. MCP sobre o catálogo: leituras → `mcp_clientes` → `mcp_edicao`.
7. Onda 2 (aprovar plano pelo chat, tom, avisos, restaurante, item/faixa nova, kit).
Às 22h: o que não estiver verde fica com a flag desligada (e sem rotas novas expostas). Depois: revisão (4 revisores + E2E), merge na `main` (trazendo antes o que a outra sessão subiu), deploy e E2E em produção antes de segunda 08:30; S7 às 10h.

## 8. Riscos
| Risco | Mitigação |
|---|---|
| Prazo e outra sessão no mesmo código (D270 contra os revisores) | ordem do §7 protege o mínimo da demo; worktree próprio; `main` trazida antes do merge; migração gerada no fim |
| Contradiz D211 e "por que não um chat?" | nova resposta no E4: "pedidos viram propostas conferidas pelo código, sobre as mesmas ferramentas do MCP; no Portal nada muda sem clique" |
| Nomes de clientes ao modelo e a agentes MCP | sem contato por construção; Langfuse sem entrada; `data_collection: deny`; aviso no painel; "Como funciona" atualizado; `mcp_clientes` desligável |
| Injeção indireta (nome de cliente/prato) | envelope de dados de terceiros + `scrub`; guard bloqueia URL; escrita só por clique/aplicar explícito |
| Escrita por MCP sem clique (D269) | 2 chamadas, mesmas validações, `via: agente`, flag `mcp_edicao` |
| Latência (~14 s no agente atual) | contexto pronto, ≤ 3 passos, propostas na saída, p50 ≤ 12 s na regra da T4 |
| IA ao vivo na demo | só 60 s, chip testado no ensaio, plano B = formulário |
| Custo e chave pública compartilhada | teto próprio do copiloto; limites por restaurante |
| Formulário perde edição ao aplicar | `key` por seção + aviso de edição não salva |

## 9. Itens [C] (D271)
Nome "Assistente do salão"; painel não modal que empurra o conteúdo; histórico só no navegador (12 turnos); proposta expira em 30 min ou se o "antes" mudar; ≤ 3 propostas; limites 60/dia e 10/10 min; teto US$ 0,20/dia na chave pública; guard `chat` com lista própria de proibidas; modo sem IA com atalhos; flags `copiloto`, `mcp_clientes`, `mcp_edicao`; gateway falso só no E2E local; chip da demo = trocar a oferta do convite de Ter–Qui 15h–18h; todas as correções técnicas da revisão (§10).

## 10. Revisão independente do plano (D95)
- **Produto** (fatos conferidos): B1 PII ("Como funciona" `app/bastidores/como-funciona/page.tsx` ~l.131, aceite `src/ui/cliente/textos.ts:15`, `recordInputs` em `openrouter-gateway.ts:135`) → candidato → D262/D268 revistas; I1 lugar na demo (`Presenter.tsx` 1024 px) → candidato → D263; I7 escopo → candidato → D270; métricas, roteiro contra o seed, alcance real no cartão, número ausente = "não informado", aviso de edição não salva, texto honesto do MCP, sem logo, tela "pedido → cartões", espec. §1 sem afirmar que o Toqan "só conversa", isenção `PRESENTER_EMAILS` → [C].
- **Técnico** (fatos conferidos): 0008 e 0009 já existem → 0010 no fim; Tiramisù é recompensa (`vitrine.ts:67`) → vira caso de recusa; prévia duplicaria regra e quebraria o lint → `checkOffer` puro + prévia na aplicação; aplicar não idempotente → reserva por `UPDATE … RETURNING`; sem `updated_at` → `base_hash`; aprovar plano sem e-mails → `scheduleInviteEmails` (onda 2); `saveSalon` substitui tudo e avança o passo (`wizard.ts:80-84`) → preencher no navegador; `RefContext` frágil → pronto do código com apelidos; guard sem URL e sem lista configurável → `forbidden` + URL + número por extenso; spike de schema+tools; latência/teto compartilhado → contexto pronto + teto próprio; gateway falso protegido; `portas` no catálogo → [C].

## 11. Perguntas respondidas pelo candidato (21/11)
1. Formato do agente (o chat contradiz D211 e o anti-objetivo; ~27 h até o corte) → **copiloto que age** (recomendado).
2. Como a mudança vira realidade → **sempre cartão + clique** (recomendado).
3. Dados de clientes no chat → 1ª resposta **"copiloto vê clientes"** (contra a recomendação); a IA voltou com a alternativa "clientes por referência" → candidato manteve **"modelo vê clientes"**; depois da revisão independente ("Como funciona" ficaria falso, aceite do cliente não cobre provedores, Langfuse grava, nenhuma ação usa contato) → **"nome sim, contato não"** (recomendado). Vale para o MCP (D268).
4. Lugar na demo → "vira a mudança ao vivo" (recomendado na 1ª rodada); depois da revisão (1024 px no modo apresentação; critério 5 é o candidato mudar) → **60 s no bloco do plano** (recomendado).
5. "IA nunca escreve número" no chat → **sim, por referência** (recomendado).
6. Onboarding → **preencher "Seu salão" + dúvidas** (recomendado).
7. Modelo → **mini-avaliação T4** (recomendado).
8. "Podemos reutilizar o MCP, só melhorando ele?" (pergunta do candidato) → a IA explicou que o MCP sozinho não chega ao dono (token + cliente externo; grava sem clique) → **catálogo único, 2 portas** (recomendado); **MCP vê clientes como o copiloto** (contra a recomendação de só agregados); **MCP edita por propor + aplicar** (contra a recomendação de só leituras).
9. Escopo × prazo (os 2 revisores: não cabe tudo) → **tudo, cortando por flag às 22h** (contra a recomendação "núcleo + onboarding").

## Depois da aprovação
1. Escrever `docs/fatias/S8/planejamento.md` (template da skill) a partir deste plano; D260–D271 em `decisoes-e-tradeoffs.md` (com "D211 reaberta" e "D262/D268 revistas na mesma rodada"); atualizar espec. (§1 linha Toqan, §4.3 MCP, §4.4 PII do copiloto, §5 demo, §6 E4 "por que não um chat?"), `plano-implementacao.md` (fatia S8 antes da S7) e `log-conversa-ia.md` (linha 83); commit no worktree e push (documentos vão para a `main` na hora — D12).
2. Seguir para `implementar-fatia` sem novas confirmações (D101), na ordem do §7.

## Verificação
`npm run check` (tipos, lint, fronteiras), `npm test` (unit + integração com Postgres), `npx playwright test` (inclui `copiloto.on.spec.ts`), `npx tsx eval/run-t4.ts`, deploy pelo CI verde, `/api/health` com SHA e `fakeAi:false`, E2E de produção com `E2E_FLAGS=on` e 1 conversa real com a chave demo.
