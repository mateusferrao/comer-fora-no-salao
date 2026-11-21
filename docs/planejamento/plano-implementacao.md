# Comer Fora no Salão — Plano de Implementação

> **Fluxo de cada fatia (D05):** skill `planejar-fatia` (leitura completa, análise e discussão crítica com o candidato; aprovação) → skill `implementar-fatia` (usa superpowers:executing-plans de forma nativa, TDD e verificação antes de concluir — D07) → skill `revisar-fatia` (4 revisores independentes + verificação E2E profunda pela IA, local e em produção — D08, D09, D13). Commits por tarefa no branch da sessão; merge na `main` ao fim da fatia, após revisão aprovada (D12). Este plano é o ponto de partida de cada fatia; o planejamento da fatia pode refiná-lo. Decisões em [decisoes-e-tradeoffs.md](decisoes-e-tradeoffs.md). Os passos usam checkbox (`- [ ]`).

**Objetivo:** construir, até 23/11/2026 às 15h, o produto "Comer Fora no Salão" — extensão do Portal do Parceiro e do app Comer Fora em que o dono ativa o salão, divulga com um kit gerado por IA com QR por peça, e acompanha retorno atribuído (check-in → resgate validado → volta) com recomendação de próxima ação.

**Arquitetura:** monólito modular em Next.js (App Router). Domínio puro por módulo (`beneficios`, `salao`, `onboarding`, `kit`, `analytics`, `recomendacoes`, `simulacao`, `config`, `ia`), casos de uso na camada de aplicação, adaptadores só nos 5 pontos de variação (IA, fonte do cardápio, canal de campanha, relógio, repositório). Postgres via Drizzle. IA só pelo OpenRouter, com guardrails em 5 camadas e rastreio no Langfuse Cloud.

**Tech stack:** Node 22 · Next.js 16 (App Router, TypeScript estrito) · Tailwind 4 · Drizzle ORM + Postgres 16 · Zod · Vercel AI SDK 7 + `@openrouter/ai-sdk-provider` · Langfuse (`@langfuse/vercel-ai-sdk` + `@langfuse/otel`) · `qrcode` · Vitest · Playwright · dependency-cruiser · GitHub Actions · Easypanel.

**Spec:** [docs/planejamento/especificacao.md](especificacao.md) (fonte única) e [00-contexto-problema-recorte.md](00-contexto-problema-recorte.md).

## Global Constraints

- Node **22**; TypeScript `strict: true`; Next.js App Router com saída `standalone`.
- Modelos de IA **somente via OpenRouter**; toda saída de IA validada por **Zod** antes de uso.
- Fuso de negócio **`America/Sao_Paulo`** em todo cálculo de dia, horário e turno; banco em UTC + coluna `day_sp` (`YYYY-MM-DD`).
- **PII nunca entra em prompt**; fotos de cardápio **nunca são persistidas**; coordenada do cliente nunca é enviada ao servidor (só o status de GPS).
- Telefone guardado como **HMAC-SHA256** (segredo `PHONE_HASH_SECRET`) + 4 últimos dígitos.
- Desconto com teto **50%**; consumo mínimo com alerta acima de **2× o preço médio** do cardápio.
- Cartela: **6 selos**, **1 check-in por cliente por restaurante por dia**, validade **90 dias** após o 1º check-in, recompensa só no local.
- **1 benefício de 1ª visita por cliente por restaurante**, válido em qualquer horário de funcionamento. Benefício, convite e recompensa só valem **após o código validado** pelo garçom.
- **Convite de volta (v2):** faixa e validade (30 dias) **congeladas na emissão**; no máximo 1 ativo por cliente; teto por faixa e **semana ISO em SP** com reserva atômica; o código do convite nasce só no check-in de volta, dentro da faixa e em outro dia.
- **Grupo de controle (v2):** sorteio 90/10 só entre quem poderia receber (plano ativo, sem convite ativo, teto livre), gravado uma única vez; holdout recebe **convite fantasma** (invisível, não consome teto).
- **Incremento (v2):** janela de **14 dias** fechada; Welch; estados `amostra_insuficiente` (n < 30) · `inconclusivo` · `positivo` · `negativo`; margem por Δcusto entre grupos.
- Códigos (3 tipos: 1ª visita, convite, recompensa): **6 caracteres** do alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, únicos por restaurante, válidos até 23:59:59 do dia em que nascem (SP), uso único. [C]
- Holdout: **10%** por hash determinístico de cliente + restaurante (ver "Grupo de controle").
- A/B: amostra mínima por versão para detectar +10 p.p. absolutos com α = 0,05 bilateral e poder 0,8 (≈ **356** para 30%→40%); antes disso, status "Sem vencedora ainda · faltam ~N leituras".
- Leituras deduplicadas: **mesmo aparelho + mesma versão em 30 min = 1**; ignorar robôs de prévia de link.
- GPS: "perto" se ≤ **300 m** [C]; tempo limite **8 s**; nunca bloqueia o check-in.
- Texto exato da barra de protótipo: **"Protótipo de case · não é produto oficial do iFood · dados fictícios"** (≤ 28 px em 1 linha a partir de 640 px; até 2 linhas e ≤ 44 px abaixo — D92).
- Texto exato do aviso de GPS (igual ao app): título **"Parece que você não está no restaurante!"**; corpo **"O GPS pode não ser preciso. Se você já está no restaurante, confirme abaixo para tentarmos validar seu benefício novamente."**; botões **"Fechar"** e **"Confirmar localização"**.
- Texto do código ao cliente: **"Informe este código ao garçom"**.
- IA nunca escreve números, nomes de pratos ou benefícios diretamente: usa `{fato:<chave>}`, `{prato:<id>}`, `{beneficio}`, `{recompensa}`, `{horario:<slotId>}`, `{oferta}`; o código substitui. Na tarefa 3, a escolha é um id de candidata validada; o veredito de cada oferta é do código.
- Edição ao vivo de prompt: só o **bloco de instruções/tom**; schema e guardrails ficam no código.
- `noindex` (meta + `X-Robots-Tag`) em todas as páginas; nenhum `dangerouslySetInnerHTML` com conteúdo vindo de IA ou usuário.
- Serviços no Easypanel com prefixo `case-salao-` no projeto `sites` (D100), sem "ifood". Deploy **só com CI verde** (webhook). **Congelamento: 23/11 às 15h.**
- Fronteiras: `src/modules/*/domain/**` não importa `next`, `drizzle-orm`, `ai`, `@openrouter/*` nem `src/db/**` (verificado por dependency-cruiser no CI).
- Recursos com flag (`app_config.flags`): `ab`, `revisor`, `aprende`, `insight_operacao`, `mcp`. O que não estiver pronto e testado na noite de 22/11 fica desligado.

## Review Focus

1. **Ensaio antes da demo:** um check-in no ensaio das 15h faz o mesmo aparelho receber "já fez check-in hoje" às 17h. Esperado: "Novo cliente fictício" gera identidade e cookie novos, e o resultado volta a ser 1ª visita. → teste na Tarefa 3.6.
2. **Clique duplo** em Ativar, Gerar/Aprovar plano ou Confirmar código. Esperado: um único efeito (idempotência por chave). → testes nas Tarefas 2.5, 2.7, 3.3.
3. **Foto inadequada:** imagem de 8 MB, formato HEIC ou foto que não é cardápio. Esperado: redimensionamento no navegador ou mensagem clara ("isso não parece um cardápio" / "formato não suportado") e oferta de exemplo, sem erro 500. → teste na Tarefa 2.5.
4. **Código** usado duas vezes, depois da meia-noite em SP ou em outro restaurante. Esperado: resultados distintos e claros (`JA_USADO`, `EXPIRADO`, `OUTRO_RESTAURANTE`). → teste na S1.
6. **Teto e grupo sob concorrência:** dois check-ins simultâneos com 1 vaga de teto → 1 convite real; o mesmo cliente nunca recebe dois grupos. → teste de integração na S1.
7. **Demo da volta:** "antecipar convite em 1 dia" (só restaurante de teste) permite o código do convite no mesmo dia. → E2E na S3.
5. **IA indisponível** (todos os modelos falham ou estouram o tempo; crédito esgotado). Esperado: modo sem IA nas 3 tarefas, sem erro 500, com rótulo. → teste na Tarefa 2.3.

---

## Mapa de arquivos

```
app/                                  # Next.js App Router (telas e rotas)
  page.tsx                            # entrada (1 botão principal + 1 secundário)
  parceiro/                           # Portal do Parceiro (dono)
    login/page.tsx
    salao/page.tsx                    # Visão geral
    salao/kit/page.tsx  salao/clientes/page.tsx  salao/configuracoes/page.tsx
    salao/ativar/[passo]/page.tsx     # assistente
    salao/validar/page.tsx            # Validar benefício (garçom)
    salao/kit/imprimir/[pieceId]/page.tsx
  r/[slug]/page.tsx                   # página do restaurante via QR
  app/jornada/page.tsx  app/avaliar/[slug]/page.tsx
  apresentacao/page.tsx               # modo apresentação
  bastidores/{config,qualidade,como-funciona,componentes}/page.tsx
  api/**/route.ts                     # rotas JSON (Zod nas bordas)
src/
  shared/      clock.ts tz.ts hmac.ts ids.ts session.ts rate-limit.ts errors.ts result.ts
  db/          client.ts migrate.ts seed.ts schema/*.ts
  modules/
    beneficios/domain/{benefit-types.ts,schedule.ts,stamp-card.ts,redemption-code.ts}
    salao/domain/{checkin-outcome.ts,scan-dedupe.ts,geo.ts,fictitious-identity.ts}
    salao/application/{register-scan.ts,do-checkin.ts,identify-customer.ts,validate-redemption.ts,submit-review.ts}
    onboarding/application/{extract-menu.ts,save-menu.ts,save-salon.ts,save-benefit.ts,activate.ts}
    onboarding/adapters/{menu-source.ts,photo-source.ts,example-source.ts,delivery-import-simulated.ts}
    kit/application/{generate-kit.ts,edit-piece.ts,approve-piece.ts,mark-in-salon.ts}
    analytics/domain/{funnel.ts,metrics.ts,ab-stats.ts,holdout.ts}
    analytics/application/get-dashboard.ts
    recomendacoes/domain/{facts.ts,candidates.ts,scoring.ts}
    recomendacoes/application/{generate-recommendation.ts,approve-campaign.ts,dismiss.ts}
    recomendacoes/adapters/crm-channel-simulated.ts
    simulacao/domain/generator.ts  simulacao/application/{simulate.ts,clear.ts}
    config/domain/flags.ts  config/application/{get-config.ts,publish-prompt.ts,rollback-prompt.ts}
    ia/
      gateway.ts openrouter-gateway.ts run-task.ts tracing.ts fallback-templates.ts
      tasks/{menu.ts,kit.ts,recommendation.ts,reviewer.ts,registry.ts}
      guardrails/{references.ts,forbidden.ts,pii.ts,index.ts}
  ui/          tokens.css (Tailwind 4 @theme) components/* shells/{PortalShell,AppShell,PrototypeBar}.tsx
tests/unit/**  tests/integration/**  tests/e2e/**
eval/          menus/*.png menus/*.json run-eval.ts report.md
Dockerfile .dockerignore docker-compose.yml .dependency-cruiser.cjs .github/workflows/ci.yml
```

---

## Fatia S0 — Fundação (19/11 noite → pode invadir 20/11, D94)
> **Fonte detalhada e aprovada:** [docs/fatias/S0/planejamento.md](../fatias/S0/planejamento.md) (prevalece sobre este resumo). Decisões D77–D96.

Entrega testável: app no ar no domínio gerado com barra, `noindex` e logo iFood; `/api/health` com banco e SHA; CI verde (check, integração, E2E, audit) acionando deploy; relógio de SP testado; laço de reserva testado + spike real com rastro aninhado no Langfuse; base do design system em `/bastidores/componentes`.

Ordem: **0.0** pré-voo + projeto `case-salao` no Easypanel e passo humano (webhook e chaves) logo no início → **0.1** projeto, fronteiras, health, barra, cabeçalhos noindex, "/" → **0.2** banco e migração em `instrumentation.ts` (nunca no build) → **0.3** relógio de SP + `adjustableClock` → **0.4** CI (3 jobs, `paths-ignore` de docs, `concurrency`), Dockerfile, medição de memória local, `fumaca.spec.ts` e **merge antecipado do esqueleto** (D78) → **0.5** plataforma de IA (contrato ampliado, `generateText` + `Output.object`, `@langfuse/vercel-ai-sdk`, spike) → **0.6** design system base (tokens `@theme`, Inter, logo iFood, `PrototypeBar`, `AppShell`, `PortalShell`, `Button`, `Tabs`, `Chip`, `Badge`, `BottomSheet` em `<dialog>`).

**Interfaces produzidas (consumidas por S1–S3):**
- `GET /api/health` → `{ ok, db: "up"|"down", sha }` (503 em down); `npm run check:boundaries`.
- `getDb()`, `runMigrations()`; tabelas `owners`, `restaurants`.
- `Clock`, `systemClock`, `fixedClock(iso)`, `adjustableClock(iso)` (`set`, `advance`); `daySP`, `weekdaySP`, `minutesOfDaySP`, `endOfDaySP`.
- IA: `AiInput` (texto ou texto + arquivos), `ModelRef { id; provider; acceptsPdf? }`, `TaskDef<T> { name; promptVersion; models; schema; perAttemptTimeoutMs; totalBudgetMs; guard? }`, `GuardResult`, `AttemptLog`, `TaskResult<T>` (`ok` | `fallback: invalid|timeout|unavailable`, ambos com `attempts`), `AiGateway`, `Tracer`, `runTask(task, system, input, ctx)`.
- UI: tokens, `Logo`, `PrototypeBar`, `AppShell`, `PortalShell`, `Button`, `Tabs`, `Chip`, `Badge`, `BottomSheet`.

---

> **v2 (20/11):** as fatias S1–S3 abaixo substituem a versão v1 (recomendação com 6 candidatas, campanhas, Avaliar, holdout por campanha), que está no histórico do git. Seguem a [especificação v2](especificacao.md) e as decisões D201–D224. Pela D221, **cada fatia é detalhada no próprio `planejar-fatia`** (perguntas + 2 revisores); aqui ficam as tarefas, as interfaces e os testes-chave.

> **Dívidas da revisão da S0** ([revisao.md](../fatias/S0/revisao/revisao.md)): S1 — índice em `restaurants.owner_id` na `0001` (aditiva, D103), conferir rolagem do fundo dos sheets no iOS e `viewport-fit=cover`; S2 — `provider.data_collection: "deny"` conferido no spike da extração, componentes acima; S3 — logs estruturados e flush do rastro no SIGTERM com `ai_calls`.

## Fatia S1 — Domínio e fluxo do cliente (20/11 → manhã de 21/11)
> **Fonte detalhada e aprovada:** [docs/fatias/S1/planejamento.md](../fatias/S1/planejamento.md) (prevalece sobre este resumo). Decisões D104–D113.

Entrega testável: na vitrine semeada (60 dias), um cliente abre o QR, faz check-in (GPS não bloqueante), se identifica, recebe o "agora" com código e, se sorteado convidável e houver teto, o 2º card do convite; na volta dentro da faixa, em outro dia, recebe o código do convite; Jornada mostra convites ativos; regras e estatística cobertas por testes; simulador recupera o efeito declarado.

| # | Tarefa | Interfaces produzidas | Testes-chave |
|---|---|---|---|
| 1.1 | Faixas e turnos | `Slot{id,days,start,end,intensity,extraTables}`, `isInSlot(slot, at)`, `turnOf(at)` (tabela fixa [C], ex.: almoço 11–15, tarde 15–18, jantar 18–24), `weekKeySP(at)` | faixa fora do funcionamento rejeitada; 23/11 17h10 em SP; virada de semana ISO |
| 1.2 | Ofertas polimórficas (`role: agora\|convite\|recompensa`) | `OfferStrategy{schema,validate,describe,unitCostCents(menu, margin?)}`, `offerRegistry` | teto 50%; item fora da categoria; custo = preço × (1 − margem) |
| 1.3 | Cartela | `applyCheckin(card, at)` | 1/dia; 6º selo; 90 dias |
| 1.4 | Códigos (3 tipos) | `generateCode(rng)`, `checkCode(code, ctx) → OK\|INVALIDO\|JA_USADO\|EXPIRADO\|OUTRO_RESTAURANTE` | alfabeto sem ambíguos; vale o dia; uso único |
| 1.5 | Experimento | `assignArm(customerId, restaurantId)` (hash 90/10), `decideInvite(state, at) → real\|fantasma\|teto_esgotado\|ja_tem_ativo\|sem_plano` | 1000 clientes → 7–13% holdout, estável; fantasma não consome teto; 1 ativo |
| 1.6 | `decideCheckin` puro (fonte única) | resultado com `outcome`, selos, código(s), convite (2º card) ou lembrete | 1ª visita; volta na faixa em outro dia → código do convite; mesmo dia → sem código; fora da faixa → lembrete; holdout → sem 2º card |
| 1.7 | Estatística | `incremental(t, h) → {state,nT,nH,diff?,lo?,hi?}`, `marginIncrement(...)`, `migration(...)`, `cohorts(...)` | Welch com valores conhecidos; n < 30 → insuficiente; IC contém 0 → inconclusivo; Δcusto cancela o "agora" |
| 1.8 | Esquema v2 | `idle_slots`, `codes`, `invites(arm,status,slot_id,...)`, `invite_quota`, `restaurant_customers.arm`, `weekly_plans`, `plan_sends`, eventos com `simulation_run_id` | índice parcial 1 ativo; reserva atômica do teto com 2 check-ins simultâneos; `arm` gravado 1 vez |
| 1.9 | Casos de uso do cliente | identificação (HMAC + 4 dígitos), leituras por beacon (dedupe 30 min, robôs), check-in em transação (convite + teto + código) | idempotência; corrida do teto; robôs |
| 1.10 | Simulador por agente + seed da vitrine | `simulate({seed, days:60, weeklyNew:200, effect:+0.20, migrationShare:0.25, now})` usando `decideCheckin`; seed idempotente com 2 planos fixos (JSON com referências) | mesma semente → mesmos eventos; **IC da vitrine > 0 e contém o efeito**; limpar remove só a rodada |
| 1.11 | Telas do cliente | página do restaurante (sem Avaliar; linha "você pode ganhar um convite"), check-in/GPS, identificação, resultado com 2º card, Jornada com convites; componentes `TicketCard`, `StampCard` | E2E 390 px com GPS negado: 1ª visita + código + 2º card; cliente holdout sem 2º card |

> **Dívidas da revisão da S1** ([revisao.md](../fatias/S1/revisao/revisao.md)): S2 — ativação com IA (foto → pacote) é o 1º item **não cortável**; limites persistidos substituem os em memória (D115). S3 — "Antecipar convite" **não cortável** + roteiro curto na entrada (grupo de controle → "Testar como outro cliente"; volta → restaurante de teste + Antecipar); "Como funciona" com "simulação baseada em agentes (sem IA)", "IC > 0 em 17 de 20 sementes", créditos das fotos e telefone sem validação (D106/D114); foto colorida do salão; lista de Clientes da vitrine com primeiro nome + inicial. S4 — "cola" dos [C] da S1 e ensaio de "mudar na hora" (`HOLDOUT_PCT`, teto).

## Fatia S2 — Portal, ativação proposta, kit e validação (21/11 → manhã de 22/11)
> **Fonte detalhada e aprovada:** [docs/fatias/S2/planejamento.md](../fatias/S2/planejamento.md) (prevalece sobre este resumo). Decisões D117–D130: login por e-mail real (SES) + link do avaliador, cópia da vitrine por conta, Configurações já na S2, T1 da mini-avaliação antecipada (com OCR como linha de base), PDF → imagem, texto da IA no 2º card.
Entrega testável: o dono entra (demo ou teste), ativa com cardápio (IA ou exemplo), recebe o **pacote proposto** (agora + convite + 1º plano, com custo e justificativa da IA ou modo sem IA), aprova/ajusta, gera e imprime o kit, e o garçom valida qualquer um dos 3 códigos.

| # | Tarefa | Interfaces produzidas | Testes-chave |
|---|---|---|---|
| 2.1 | Sessão, contas demo e isolamento | `getOwnerSession`, `forRestaurant` | dono A não lê B; cookie inválido |
| 2.2 | Limites de uso | `consume(...)`, `clientIp(...)`, bypass E2E | 6ª extração bloqueada; `X-Forwarded-For` |
| 2.3 | Guardrails com referências novas | `resolveReferences` (+ `{horario}`, `{oferta}`), `checkForbidden`, `checkPii`, `guardCopy` | referência desconhecida reprova; "metade do preço" bloqueado |
| 2.4 | Cardápio (fonte + extração IA) | `MenuSource`, `extractMenu`, cache dos exemplos | HEIC; > 8 MB; não é cardápio; PDF só para `acceptsPdf` |
| 2.5 | **Motor de candidatas + tarefa de IA 3 + modo sem IA** | `buildCandidates(facts, menu, slots) → por faixa 2–3 ofertas com pontuação, teto e custo`; `TaskDef` montado por chamada (`slotId`/`candidataId` como enum, guard confere pertença e permutação); `fallbackPlan(...)` | escolha fora das candidatas reprova; `{fato:x}` desconhecido reprova; gateway falho → modo sem IA rotulado; estado `gerando` evita 2 chamadas |
| 2.6 | Assistente com pacote proposto | `saveSalon` (faixas com id, ticket/margem opcionais), `proposePackage`, `approvePackage`, `activate` | ativar 2× → 1 `activated_at`; pacote com fatos declarados; ajuste do dono registrado |
| 2.7 | Kit (convite genérico, garçom só "agora") | `generateKit`, `editPiece`, `approvePiece`, `markInSalon`, QR por versão | peça não cita oferta do convite; cartão do garçom ≤ 2 frases |
| 2.8 | Validar código (3 tipos) | `lookupCode`, `confirmCode(…, idempotencyKey)` | confirmar 2× → 1 efeito; dia anterior → `EXPIRADO`; mostra tipo e condições |
| — | Componentes | `DaySelector`/seletor de faixas, `Stepper`, `SidePanel`, `DataTable`, `Toast`, `Field` (rótulo + erro, portal/01), `NavItem` (ativo com `aria-current`, portal/05) e `Badge` tom `outline-red` em pílula (selo "Novo") — dívidas da revisão da S0 | acessibilidade (foco, Esc, rótulos) |

## Fatia S3 — Painel, plano da semana, apresentação e bastidores (22/11)
> **Fonte detalhada e aprovada:** [docs/fatias/S3/planejamento.md](../fatias/S3/planejamento.md) (prevalece sobre este resumo). Decisões D136–D145: merge único; T3 com juiz de IA cego + nota cega do candidato; prompt global com senha + tom por restaurante; "Antecipar" no 2º card (encaixa o horário no teste); reativação até 50% do teto livre (função pura única, também no simulador); motivo do holdout visível no teste; Visão da plataforma.

Entrega testável: painel com métrica principal (4 estados), indicadores antecipados e funil reagindo ao vivo; **plano da semana** com insights, veredito do código, escolha e explicação da IA, "o que aprendemos", aprovação (Portal ou MCP) e reativação com fantasma; modo apresentação; bastidores; mini-avaliação; E2E em produção; extras por flag.

| # | Tarefa | Interfaces produzidas | Testes-chave |
|---|---|---|---|
| 3.1 | Insights e analytics | insights 1–3 (check-ins por turno × declarado; resposta aos convites com coortes; segmentos), `verdict(offerStats) → manter\|trocar\|cedo_demais` | veredito por limiar; coortes abertas; "frequentes" fora da reativação |
| 3.2 | Painel do dono (5 abas; **Configurações já feitas na S2 — D120**) | Visão geral (métrica com estados, indicadores, funil, cartões), Clientes (segmentos), Configurações (faixas, ticket/margem, token MCP); `FunnelBars`, `StatCard` | check-in em outra aba aparece em ≤ 5 s; textos dos 4 estados |
| 3.3 | Plano da semana | `generateWeeklyPlan`, `approvePlan(…, via: portal\|agente)`, nova versão da regra, reativação simulada com fantasma | aprovar 2× → 1 efeito; reativação pula quem tem ativo; holdout recebe fantasma |
| 3.4 | Entrada, apresentação e "Como funciona" | entrada 1+1 botões; modo apresentação; página com real × simulado, parâmetros da simulação e limitações; CSP em `proxy.ts` | barra e noindex em todas as rotas |
| 3.5 | Configuração ao vivo e flags | `publishPrompt`, `rollbackPrompt`, `getFlags` | mudar o tom muda a próxima chamada sem deploy |
| 3.6 | Bastidores | Qualidade da IA, resetar demo, novo cliente fictício, **antecipar convite em 1 dia** (só teste) | Review Focus 1 e 7 |
| 3.7 | Mini-avaliação | T1 **feita na S2 (D117)**; T3 (~5 fixtures, IA × linha de base sem IA) | `scoreExtraction`; rubrica da T3 |
| 3.8 | E2E do caminho feliz (local e produção) | spec com pacote → kit → QR → agora + 2º card → validar → simular → plano → aprovar; holdout; volta com convite | verde contra produção com SHA conferido |
| 3.9+ | Por flag, nesta ordem | insight 4 + A/B · revisor · aprende · **MCP** (`/api/mcp`, token do dono por restaurante, pode aprovar — D219) | cada um com seus testes; desligado se não pronto em 22/11 à noite |

---

## Fatia S7 — Entregáveis (23/11, até 15h) — era a S4 (renumerada no replanejamento de 21/11, D151)
Entrega verificável: link estável, envio pelos dois canais, slide PPTX, material extra e preparação.

### Tarefa 4.1: Congelamento e checagem final
- [ ] E2E em produção verde com o SHA final; `resetDemo()`; backup manual do banco (`pg_dump` pelo console do Easypanel).
- [ ] Remover o webhook de deploy do CI às **15h** (congelamento).
- [ ] Verify: `/api/health` responde `ok:true` com o SHA congelado.

### Tarefa 4.2: Slide do processo (PPTX, 1 slide)
- [ ] Gerar `entregaveis/slide-processo.pptx` com 3 colunas — Prompts (evolução v1→vN com 1 falha real e a correção; mini-avaliação; guardrails e revisor; como a IA foi usada na construção), APIs (OpenRouter e porquê; modelos por tarefa com acerto/custo/latência de `eval/report.md`; AI SDK; Langfuse Cloud e por que não auto-hospedado; Postgres/Easypanel; Geolocation API), Riscos (tabela da especificação 8).
- [ ] Verify: abre no PowerPoint/LibreOffice sem erro; nenhum dado pessoal.

### Tarefa 4.3: Material extra e repositório público
- [ ] `entregaveis/documento-tecnico.md` (arquitetura, decisões, trade-offs, guardrails, avaliação, roadmap); vídeo da demo de 2–3 min.
- [ ] Repositório público gerado por cópia filtrada (sem `docs/contexto/`, `docs/pessoal/`, `referencias/`, `eval/privado/`), com varredura de segredos (token do Greenhouse, e-mails, telefones, chaves) antes do push.
- [ ] Verify: varredura sem achados; README público explica como rodar e o que é simulado.

### Tarefa 4.4: Envio e preparação da entrevista
- [ ] Enviar link + slide respondendo ao e-mail 1 e pelo formulário Greenhouse do e-mail 2.
- [ ] `docs/pessoal/preparacao-entrevista-tecnica.md`: pitch de 2 min, história do case em 1 min, ~20 perguntas com respostas, dimensionamento, conta de bolso [H], ganchos com projetos reais, desafio de logística; alinhar "semanal × quinzenal" no portfólio.
- [ ] Ensaio cronometrado de 8 min no modo apresentação; checklist do dia (saldo da chave às 16h, permissão de GPS, Langfuse logado, monitor ligado).

---

## Cobertura da especificação v2 (autorrevisão)
| Seção da especificação | Tarefas |
|---|---|
| 1–2 Resumo, hipóteses e métricas | 1.7, 3.1, 3.2 |
| 3.1 Superfícies e navegação | 0.6, 2.1, 3.4, 3.5, 3.6 |
| 3.2 Ativação proposta | 2.4, 2.5, 2.6 |
| 3.3 Agora, convite, sorteio, teto, códigos | 1.1–1.6, 1.8, 1.9, 2.8 |
| 3.4 Kit e A/B | 1.9 (leituras), 2.7, 3.9+ |
| 3.5 Fluxo do cliente | 1.6, 1.9, 1.11 |
| 3.6 Painel | 3.1, 3.2 |
| 3.7 Plano da semana | 2.5, 3.1, 3.3 |
| 3.8 Simulação | 1.10 |
| 4.1 Arquitetura | 0.1 (fronteiras), todas |
| 4.2 Dados | 0.2, 1.8 |
| 4.3 Rotas e MCP | 1.9, 2.1–2.8, 3.2–3.6, 3.9+ |
| 4.4 IA | 0.5, 2.3, 2.4, 2.5, 2.7, 3.7, 3.9+ |
| 4.5 Infra | 0.1, 0.2, 0.4, 4.1 |
| 4.6 Segurança | 1.9, 2.1, 2.2, 2.4, 3.4, 3.9+ (MCP) |
| 4.7 Testes | todas (TDD), 3.8 |
| 4.8 Observabilidade | 0.5, 3.6 |
| 4.9 Design system | 0.6, 1.11, 2.x, 3.2 |
| 5 Demo | 3.4, 3.6, 4.4 |
| 6 Entregáveis | 4.2–4.4 |
| 7 Prioridade e corte | ordem das fatias; flags em 3.5 |

Ajustes do planejamento da S0 (D77–D96) aplicados acima; detalhes em `docs/fatias/S0/planejamento.md`.

Decisões marcadas [C] neste plano (abertas a correção): limiar de 300 m para "perto"; código de 6 caracteres; telefone fictício com DDD 00; tabela fixa de turnos; limite de 5 extrações por visitante por dia; teto inicial = mesas × 4; limiares do veredito por oferta; parâmetros da simulação (+0,20 visita/14 d, 25% migração, ~200 novos/semana — D104). (Da v1, saíram: definição de "voltou" em 30 dias e limiares das 6 ações candidatas.)


---

## Replanejamento de 21/11 — S4, S5, S6 e S7
Decisões D151–D169. As fatias passam a ser:
- **S4 — Produto real e identidade** ([planejamento](../fatias/S4/planejamento.md), detalhado): limpeza de "teste/simulação", login do cliente por e-mail + código, reativação entregue (app + e-mail), Ferramentas do avaliador nos Bastidores. Sub-fatias S4.1–S4.4 (S4.1 feita no branch antes da suspensão).
- **S5 — Valor e conversão** ([planejamento aprovado](../fatias/S5/planejamento.md), D179–D185): painel em R$ (2 camadas) + metas + "Hoje no salão"; landing, página do QR de conversão e convite com agenda (`.ics`); "Por que esta oferta?" em 2 camadas. E2E em 2 projetos de flags.
- **S6 — IA que opera + sistema configurável** ([planejamento aprovado](../fatias/S6/planejamento.md), D187–D200): S6.0 base (0007, tokens, `approvePlanInTx`) · S6.1 resumo + agendador + lembrete + avisos do dono + central do cliente · S6.2 link do garçom · S6.3a IA do restaurante + pratos fora das ofertas + cardápio manual · S6.3b plano como agente (spike, T3) · S6.4 porta-conta.
- **S7 — Entregáveis** (era a "Fatia S4 — Entregáveis" acima): slide, vídeo de telas reais (D157), repositório público, preparação; segunda 23/11, 10h–15h.

Cada fatia (S5, S6, S7) é planejada com `planejar-fatia` na vez dela. Ordem de corte D160; corte por flag domingo 22h; uma revisão e um merge depois da S6 (D167), com meta antes de segunda 08:30 (D168).
