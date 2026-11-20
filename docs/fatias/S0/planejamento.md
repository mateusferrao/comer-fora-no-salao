# Planejamento da fatia S0 — Fundação

Status: **aprovado em 19/11/2026 pelo candidato** (após discussão por perguntas e revisão independente do plano por 2 subagentes).
Implementação: numa **sessão nova** (D83), depois que o candidato cadastrar as chaves no ambiente de nuvem (seção 6.6).

## 1. Objetivo e entrega testável
Deixar a fundação técnica e visual pronta e **no ar**, para que S1–S3 só construam produto.

Ao fim da S0:
- App no ar no domínio gerado do Easypanel (`case-salao`), com barra de protótipo, `noindex` e logo iFood.
- `GET /api/health` → `{ ok, db, sha }` com o SHA do commit publicado.
- CI verde (check, integração com Postgres, E2E da fatia, audit) acionando o deploy pelo webhook; docs não disparam deploy.
- Relógio e fuso de São Paulo testados (inclusive 23/11/2026 17h10).
- Plataforma de IA: laço de reserva testado com gateway falso + spike real no OpenRouter com rastro aninhado no Langfuse (tarefa → tentativa → geração).
- Base do design system visível em `/bastidores/componentes`.

Prova: suíte local completa verde; CI verde; `curl /api/health` em produção com SHA = commit; `X-Robots-Tag: noindex`; E2E de fumaça contra produção; rastro do spike no Langfuse.

## 2. Requisitos e rastreabilidade
| Requisito | Fonte | Como será provado |
|---|---|---|
| Next.js App Router, TS estrito, standalone, Node 22 | espec. 4.1, 4.5; plano Global Constraints | build local e na VPS; `tsc --noEmit` |
| Fronteiras do domínio verificadas no CI | espec. 4.1; D44 | `tests/unit/boundaries.test.ts` + `npm run check:boundaries` |
| Drizzle + Postgres, migração programática no boot | espec. 4.2, 4.5 | `tests/integration/db.test.ts`; health em produção `db:"up"` |
| `/api/health` com banco e SHA | espec. 4.3, 4.5 | `tests/unit/health.test.ts`; `curl` em produção |
| Fuso de SP e relógio como porta | espec. 4.7; D47 | `tests/unit/tz.test.ts`, `tests/unit/clock.test.ts` |
| Deploy só com CI verde; congelamento = desligar gatilho | espec. 4.5; D63 | job `deploy` dependente dos 3 jobs; 1º deploy pelo merge antecipado (D78) |
| Mitigações de memória do build | espec. 4.5; D90 | medição local (Turbopack × webpack) + pico no 1º build registrado em `notas-infra.md` |
| IA só via OpenRouter, saída validada por Zod, laço de reserva no nosso código | espec. 4.4; D52, D53 | `tests/unit/ia/run-task.test.ts`; spike real |
| Rastro no Langfuse Cloud, exportador nunca derruba a requisição | espec. 4.8; D59 | spike com árvore no Langfuse; teste com exportador que lança |
| Barra de protótipo com texto exato, `noindex` em todas as páginas | espec. 3.1; D22, D87, D92 | `tests/e2e/fumaca.spec.ts`, `componentes.spec.ts` |
| Tokens medidos nos prints, fonte livre declarada, duas cascas, acessibilidade AA | espec. 4.9; D79–D82 | `componentes.spec.ts` (axe, foco, alvos) + `tests/unit/ui/contrast.test.ts` |
| Verificação de dependências no CI | espec. 4.6; D89 | job `check` com `npm audit` |

## 3. Decisões desta fatia
Registro completo (alternativas, trade-offs, motivo) em [decisoes-e-tradeoffs.md](../../planejamento/decisoes-e-tradeoffs.md), seção H.

| ID | Decisão | Quem |
|---|---|---|
| D77 | Commits no **branch da sessão atual**; CLAUDE.md e `implementar-fatia` sem nome fixo | U |
| D78 | Exceção a D12 só na S0: **1 merge antecipado do esqueleto** (base + health + banco + CI + "/" + E2E de fumaça) | U |
| D79 | Design system: base na S0; componentes de domínio na fatia que os usa | U |
| D80 | Vermelhos medidos: botão com texto branco `#E71C2B`; `#EA1D2C` no logo e áreas sem texto; texto pequeno `#D72E3B`; funil `#EF5652` | U (revisada após revisão) |
| D81 | Só o **logo padrão do iFood** em SVG público; sem lockup "pra comer fora" | U (revisada após revisão) |
| D82 | Fonte **Inter** self-hosted; tokens da designmd.app como base, **print vence** | U + IA [C] |
| D83 | Chaves no ambiente de nuvem; implementação em sessão nova | U |
| D84 | Langfuse Cloud EU, conta nova; `LANGFUSE_BASE_URL` | U |
| D85 | 2 chaves OpenRouter (pública US$ 3, demo US$ 7); desenvolvimento usa a demo | U (reconfirmada) |
| D86 | Segredos internos por mim via conector; chaves pagas e senha dos Bastidores pelo candidato | U |
| D87 | `noindex` e cabeçalhos básicos já na S0; CSP completa na S3 | U |
| D88 | Search Console removido; risco de phishing aceito sem mitigação extra | U (reconfirmada) |
| D89 | `npm audit` bloqueia só "critical" de produção | U |
| D90 | Serviços sem limite de CPU/memória no Easypanel | U |
| D91 | E2E da fatia bloqueiam o deploy | U |
| D92 | Barra: 2 linhas no celular, 1 linha ≥ 640 px; links só na S3 (24 px mínimo) | U |
| D93 | `/bastidores/componentes` pública com logo e cabeçalho; "/" com logo iFood | U |
| D94 | S0 sem linha de corte | U |
| D95 | Revisão independente do plano em toda fatia (nova etapa da skill `planejar-fatia`) | U |
| D96 | Escolhas técnicas [C] desta fatia (seção 6) | IA [C] |
| D97 | Créditos do OpenRouter comprados antes da implementação; saldo conferido no pré-voo | U |
| D98 | MCP OpenRouter: consulta + testes de prompt registrados | U |
| D99 | Modelos do spike: Gemini 2.5 Flash Lite + GPT-5 Nano (reserva) | IA [C] |

## 4. Produto e fluxos
A S0 não tem fluxo de produto. O que um visitante vê:
- **`/`**: logo iFood + "Comer Fora no Salão · protótipo de case em construção · versão final em 23/11" + barra de protótipo (D93). Substituída pela entrada real na Tarefa 3.4 (S3).
- **`/bastidores/componentes`**: galeria da base do design system, com logo e cabeçalho "Base do design system · tokens medidos em prints de referência" (D93).
- **`/api/health`**: JSON técnico.

Textos exatos:
- Barra: **"Protótipo de case · não é produto oficial do iFood · dados fictícios"** (sempre completo; D92).
- Página "/": **"Comer Fora no Salão · protótipo de case em construção · versão final em 23/11"**.
- Cabeçalho da galeria: **"Base do design system · tokens medidos em prints de referência"**.

## 5. Telas, estados e textos
### 5.1 Barra de protótipo (`PrototypeBar`, layout raiz)
- Fixa no topo, fundo escuro neutro, texto claro (contraste AA).
- < 640 px: o texto exato quebra em até 2 linhas, altura ≤ 44 px. ≥ 640 px: 1 linha, altura ≤ 28 px.
- Sem links na S0. "Trocar de lado" e "Como funciona" entram quando os destinos existirem (S3), com alvo mínimo de 24 px (WCAG 2.5.8). É uma exceção registrada à regra geral de 44 px (D92).
- O modo apresentação (S3) vai embutir o app num iframe; a barra precisa poder ser escondida quando embutida (prever prop/variação, sem implementar o modo).

### 5.2 Cascas
- **`AppShell`**: coluna central de 420 px no computador; largura total no celular; fundo da página fora da coluna em cinza neutro.
- **`PortalShell`**: sidebar fixa ≥ 1024 px; < 1024 px vira gaveta com botão (alvo ≥ 44 px), foco preso na gaveta aberta, Esc fecha e devolve o foco; logo iFood no topo da sidebar (como em portal/05). Sem itens de navegação reais na S0 (só exemplos na galeria).

### 5.3 Primitivos
| Componente | Variações | Estados | Acessibilidade |
|---|---|---|---|
| `Button` | `primary-app` (preto `#151515`, texto branco, pílula), `secondary-app` (cinza `#F5F5F5`, texto escuro), `primary-portal` (vermelho `#E71C2B`, texto branco), `outline-portal` (borda e texto `#D72E3B`) | normal, foco, desabilitado, carregando | alvo ≥ 44 px, foco visível, `aria-busy` no carregando |
| `Tabs` | sublinhado escuro como em app/04 | ativa, inativa, foco | `role="tablist"`, setas do teclado |
| `Chip` | cinza claro com texto escuro (como "Ter, Qua" em app/04) | — (não interativo na S0) | texto ≥ AA |
| `Badge` | neutro, vermelho, verde | — | verde `#52AA6E` só com texto escuro ou texto grande em negrito [C], porque branco sobre ele dá 2,86:1 |
| `BottomSheet` | com alça; título; conteúdo; ações | aberto, fechado | `<dialog>` com `showModal()`, foco preso, Esc fecha, devolve o foco ao gatilho, fundo inerte |
| `Logo` | logo iFood em SVG | — | `alt="iFood"` |

### 5.4 Tokens (`src/ui/tokens.css`, Tailwind 4 `@theme`)
- **Cores medidas nos prints** (D80, D82): `#151515` (botão principal do app), `#F5F5F5` (secundário), `#E71C2B` (fundo de botão vermelho), `#EA1D2C` (logo e áreas sem texto), `#D72E3B` (texto vermelho pequeno), `#EF5652` (barras do funil, para a S3), `#52AA6E` (verde). Neutros e demais papéis: designmd.app como base, confirmando no print quando houver.
- **Raios, sombras**: escalas da designmd.app (raio 4/8/12/16/24/pílula; sombras low…highest); medir no print o raio do botão e do sheet (app/11) e preferir o print.
- **Espaçamento**: escala padrão do Tailwind 4 (`--spacing` 0,25 rem = 4 px), igual à da referência; não redefinir.
- **Fonte**: Inter (self-hosted via `@fontsource-variable/inter` ou `next/font/local`), ligada com `@theme inline { --font-sans: ... }`. A fonte oficial ("Tipo iFood", segundo terceiros) é declarada como não verificada e substituída.

### 5.5 Responsividade
Testado em 390 e 1280 px na S0 (768 px entra na revisão visual).

## 6. Técnica
### 6.1 Ordem das tarefas
0. **Pré-voo e passo humano cedo**
   - Conferir Node 22, Postgres local (instalar/criar banco e `DATABASE_URL` se faltar), Chromium do Playwright (`npx playwright install chromium`; plano B `channel: "chrome"`) e as variáveis do ambiente (6.6).
   - Confirmar o branch da sessão (D77).
   - Easypanel, só o projeto `case-salao`: checar ≥ 1,5 GB livres; criar o projeto, o serviço `db` (Postgres 16) e o serviço `app` (GitHub `main`, Dockerfile, **auto-deploy desligado**, sem limites — D90); gerar o domínio com HTTPS; cadastrar as variáveis internas (D86).
   - Pedir ao candidato: (a) colar o webhook de deploy no secret `EASYPANEL_DEPLOY_WEBHOOK` do GitHub; (b) colar `OPENROUTER_KEY_DEMO`, `OPENROUTER_KEY_PUBLIC`, `LANGFUSE_*` nas variáveis do `app`.
   - O nome do serviço fica fixo: o domínio vai no e-mail de envio e nos QRs do kit.
1. **0.1 Projeto, fronteiras e health** (6.2)
2. **0.2 Banco e migrações** (6.3)
3. **0.3 Relógio e fuso de SP** (6.4)
4. **CI + merge antecipado (D78)** (6.5)
5. **0.5 Plataforma de IA** (6.7)
6. **0.6 Design system base** (seção 5)
7. **Fim da fatia**: suíte completa → `revisar-fatia` → merge na `main` (D12) → E2E de fumaça em produção.

### 6.2 Projeto (Tarefa 0.1)
- Create: `package.json`, `tsconfig.json` (strict), `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts` (projetos `unit` e `integration`), `.dependency-cruiser.cjs`, `.dockerignore`, `Dockerfile`, `app/layout.tsx`, `app/page.tsx`, `app/api/health/route.ts`, `src/shared/health.ts`.
- `next.config.ts`: `output: "standalone"`, `typescript.ignoreBuildErrors: true` (o CI checa), `experimental.cpus: 1`, `headers()` com `X-Robots-Tag: noindex, nofollow`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: frame-ancestors 'self'` (D87). No Next 16 o build não roda lint; o ESLint roda no CI.
- `app/layout.tsx`: `<meta name="robots" content="noindex, nofollow">` (via `metadata.robots`), `lang="pt-BR"`, `PrototypeBar`.
- Health: `createHealthHandler({ ping: () => Promise<void>, sha: string })` → 200 `{ ok:true, db:"up", sha }` | 503 `{ ok:false, db:"down", sha }`; ping com timeout ~2 s; `sha = process.env.GIT_SHA ?? "dev"`.
- Fronteiras: regra `domain-no-infra` — de `^src/modules/[^/]+/domain/` para `next`, `drizzle-orm`, `ai`, `@openrouter/*`, `^src/db/`. Script `npm run check:boundaries`.

### 6.3 Banco (Tarefa 0.2)
- Create: `docker-compose.yml` (para máquinas com Docker), `drizzle.config.ts`, `src/db/client.ts`, `src/db/migrate.ts`, `src/db/schema/{owners,restaurants}.ts`, `drizzle/` (gerado), `instrumentation.ts`.
- Driver `pg`; pool guardado em `globalThis` (hot reload); `connectionTimeoutMillis` ≈ 2000; `getDb()` sob demanda.
- Tabelas como no plano: `owners(id, kind: 'demo'|'teste', created_at)`, `restaurants(id, owner_id, slug, kind: 'vitrine'|'teste', name, cuisine, price_band, opening_hours jsonb, idle_hours jsonb, tables, weekly_customers, lat, lng, status: 'rascunho'|'ativo', activated_at, created_at)`.
- `runMigrations()` usa `migrate()` do Drizzle com a pasta `drizzle/` resolvida a partir de `process.cwd()`.
- `instrumentation.ts` → `register()`:
  - retorna sem fazer nada se `process.env.NEXT_RUNTIME !== "nodejs"` ou `process.env.NEXT_PHASE === "phase-production-build"`, para nunca migrar durante o `next build`;
  - `import()` dinâmico do banco e do tracing;
  - política de falha: tenta migrar por ~30 s com espera crescente; se não conseguir, registra o erro e segue, com o health respondendo `db:"down"`.

### 6.4 Relógio (Tarefa 0.3)
- `src/shared/clock.ts`: `interface Clock { now(): Date }`, `systemClock`, `fixedClock(iso)`, `adjustableClock(iso): Clock & { set(iso): void; advance(ms): void }` (para a Tarefa 3.6).
- `src/shared/tz.ts`: `daySP`, `weekdaySP` (0 = domingo), `minutesOfDaySP`, `endOfDaySP` com `Intl.DateTimeFormat` e `timeZone: "America/Sao_Paulo"`.

### 6.5 CI, Docker e deploy (D78, D89, D91)
- `.github/workflows/ci.yml`:
  - Gatilhos: `push` (todos os branches) e `pull_request`, com `paths-ignore`: `docs/**`, `referencias/**`, `.claude/**`, `**/*.md`.
  - Jobs:
    - `check`: `npm ci`, `eslint`, `tsc --noEmit`, `check:boundaries`, `vitest --project unit`, `npm audit --omit=dev --audit-level=critical` (o nível "high" sai no log).
    - `integracao`: serviço Postgres 16, `vitest --project integration`.
    - `e2e`: serviço Postgres 16, `next build`, `node .next/standalone/server.js`, Playwright (Chromium) `--trace off`.
    - `deploy`: só em `push` na `main`, `needs: [check, integracao, e2e]`, `concurrency: deploy`, faz `curl -fsS -X POST "$EASYPANEL_DEPLOY_WEBHOOK"`.
- `tests/e2e/fumaca.spec.ts` (entra no merge antecipado): barra com o texto exato; `meta[name=robots]` com `noindex`; cabeçalho `X-Robots-Tag` com `noindex`; `/api/health` 200. O mesmo spec roda depois contra produção (`BASE_URL`).
- **Antes do 1º build na VPS**: medir localmente o pico de memória (`/usr/bin/time -v`) de `next build` (Turbopack) e de `next build --webpack`. Se o pico passar de ~1,2 GB, usar webpack com `experimental.webpackMemoryOptimizations`. Registrar os números.
- **Dockerfile** multi-stage em Node 22:
  - build com `NODE_OPTIONS=--max-old-space-size=1024` e `NEXT_TELEMETRY_DISABLED=1`;
  - estágio final copia `.next/standalone`, `.next/static`, `public` e `drizzle/`;
  - `ENV HOSTNAME=0.0.0.0 PORT=3000`, `EXPOSE 3000`, `CMD ["node","server.js"]`.
- **`.dockerignore`**: `.git` (exceto o que a opção 2 do SHA precisar), `node_modules`, `.next`, `docs/`, `referencias/`, `eval/`, `tests/`, `**/*.pdf`, `**/*.png` com `!public/**`.
- **`GIT_SHA`** — tentar nesta ordem:
  1. `ARG GIT_SHA` preenchido pelo Easypanel no build;
  2. `.dockerignore` liberando `.git/HEAD`, `.git/refs/**` e `.git/packed-refs`, com o SHA resolvido no estágio de build;
  3. o job `deploy` grava `GIT_SHA` no serviço pelo conector antes do webhook.

  Registrar qual funcionou.
- **Merge antecipado (D78)**: checar ≥ 1,5 GB livres → merge na `main` → CI verde → deploy → `curl https://<dominio>/api/health` com SHA = commit → fumaça contra produção.
- **`docs/planejamento/notas-infra.md`**: pico de memória local e na VPS; empacotador escolhido; mecanismo do SHA; **tempo do commit até o ar**; "último commit seguro" em 23/11; comportamento de `models`/`require_parameters` no spike. Sem IP nem dados dos serviços do candidato.
- O webhook builda o HEAD da `main`, não necessariamente o commit verificado; a checagem do SHA no health cobre isso.

### 6.6 Variáveis e segredos (D83–D86)
- **Ambiente de nuvem** (o candidato cadastra antes da sessão de implementação): `OPENROUTER_KEY_DEMO`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL=https://cloud.langfuse.com`.
- **Easypanel, serviço `app`**:
  - **Por mim via conector:** `DATABASE_URL` (senha gerada do Postgres interno), `SESSION_SECRET`, `PHONE_HASH_SECRET`.
  - **Pelo candidato na interface:** `OPENROUTER_KEY_PUBLIC`, `OPENROUTER_KEY_DEMO`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` (e `BASTIDORES_PASSWORD` quando a S3 precisar).
- **GitHub, pelo candidato:** secret `EASYPANEL_DEPLOY_WEBHOOK`.
- **Créditos (D97):** a conta do OpenRouter estava sem crédito; o candidato compra os US$ 10. No pré-voo, conferir o saldo pelo MCP (`get-credits`) e parar se continuar zerado.
- **MCP OpenRouter (D98):** livre para catálogo, docs, saldo e custo por geração; `send-message` só para testes de prompt (S2/S3), com cada uso registrado em `docs/planejamento/notas-ia.md`.
- Nenhum segredo em código, log, commit ou chat.

### 6.7 Plataforma de IA (Tarefa 0.5)
- Create: `src/modules/ia/{gateway.ts,openrouter-gateway.ts,run-task.ts,tracing.ts}`, `scripts/spike-ai.ts`; tracing registrado em `instrumentation.ts`.
- Interfaces (ampliadas para S2/S3 não terem retrabalho):
```ts
type AiInput = { text: string } | { text: string; files: Array<{ data: Uint8Array | URL; mediaType: string }> };
type ModelRef = { id: string; provider: string; acceptsPdf?: boolean };
type GuardResult = { ok: true } | { ok: false; reasons: string[] };
interface TaskDef<T> { name: string; promptVersion: string; models: ModelRef[]; schema: ZodType<T>;
  perAttemptTimeoutMs: number; totalBudgetMs: number; guard?: (data: T) => GuardResult }
type AttemptLog = { model: string; ok: boolean; error?: "invalid" | "guard" | "timeout" | "provider" | "credit";
  latencyMs: number; inTokens?: number; outTokens?: number; costUsd?: number };
type TaskResult<T> = { status: "ok"; data: T; model: string; attempts: AttemptLog[] }
  | { status: "fallback"; reason: "invalid" | "timeout" | "unavailable"; attempts: AttemptLog[] };
interface AiGateway { generate(req: { model: ModelRef; system: string; input: AiInput; schema: ZodType<unknown>;
  signal: AbortSignal }): Promise<{ output: unknown; usage: { inTokens: number; outTokens: number; costUsd?: number }; model: string }> }
interface Tracer { task<R>(name: string, meta: Record<string, unknown>, fn: () => Promise<R>): Promise<R>;
  attempt<R>(meta: Record<string, unknown>, fn: () => Promise<R>): Promise<R> }
runTask<T>(task: TaskDef<T>, system: string, input: AiInput, ctx: { gateway: AiGateway; clock: Clock; trace: Tracer }): Promise<TaskResult<T>>
```
- Regras do laço:
  - modelos em sequência;
  - saída fora do schema → `invalid` → próximo modelo;
  - `guard` reprova → `guard` → próximo modelo;
  - erro do provedor 5xx/429 → `provider` → próximo modelo;
  - 402 (crédito) → `credit` → encerra já com `fallback: unavailable` (todos os modelos usam a mesma chave);
  - tempo por tentativa estourado (`AbortController` + `setTimeout`) → `timeout` → próximo modelo;
  - orçamento total (medido pelo `Clock`) estourado → `fallback: timeout`;
  - todos inválidos → `fallback: invalid`;
  - todos indisponíveis → `fallback: unavailable`.
- Gateway OpenRouter:
  - `generateText({ model, system, messages, output: Output.object({ schema }), maxRetries: 0, abortSignal })` (o `generateObject` está obsoleto no `ai` 7);
  - provider `createOpenRouter({ apiKey })` com `usage: { include: true }` (custo real);
  - plugin de reparo de JSON **desligado**, para não mascarar a taxa de reserva.
- Tracing:
  - `NodeSDK` + `LangfuseSpanProcessor` (`@langfuse/otel`) + `registerTelemetry(new LangfuseVercelAiSdkIntegration())` (`@langfuse/vercel-ai-sdk`);
  - o adaptador `Tracer` usa `startActiveObservation` (`@langfuse/tracing`), para os spans de tarefa e de tentativa passarem no filtro do Langfuse e a geração do AI SDK ficar aninhada;
  - qualquer erro do exportador é engolido e registrado no log.
- `scripts/spike-ai.ts`:
  - monta o próprio `NodeSDK` (o `tsx` não carrega `instrumentation.ts`) e chama `await sdk.shutdown()` no fim;
  - usa a chave `OPENROUTER_KEY_DEMO`;
  - modelos (D99): `google/gemini-2.5-flash-lite` (1º) e `openai/gpt-5-nano` (reserva), reconfirmados no catálogo pelo MCP na hora;
  - gasto ≤ US$ 0,10;
  - força 1 caso de reserva (schema que o 1º modelo tende a errar, ou timeout curto no 1º);
  - critério de sucesso: a árvore tarefa → tentativa → geração aparece no Langfuse, com custo e modelo reais.

### 6.8 Dados
Só `owners` e `restaurants` (migração `0000`). As demais tabelas são da S1 (Tarefa 1.5).

### 6.9 Segurança e privacidade
- `noindex` em meta e cabeçalho desde o 1º deploy, mais os cabeçalhos básicos (D87).
- O repositório é privado. A imagem Docker não leva `docs/`, `referencias/`, PDFs nem PNGs fora de `public/`.
- Segredos só em variáveis de ambiente; o exportador do Langfuse nunca registra o conteúdo das chaves.
- O SHA no health é público (risco baixo, aceito).

## 7. Testes
### 7.1 Unitários (`vitest --project unit`)
- `tests/unit/health.test.ts`: `ping` que rejeita → 503 `{ ok:false, db:"down", sha:"abc" }`; ping que resolve → 200 `{ ok:true, db:"up", sha:"abc" }`; ping que demora > 2 s → 503.
- `tests/unit/boundaries.test.ts`: depcruise sobre `tests/fixtures/boundaries/` (com `baseDir` próprio, árvore `src/modules/x/domain/bad.ts` importando `drizzle-orm`) → violação `domain-no-infra`; o run principal sobre `src/` não acusa a fixture.
- `tests/unit/tz.test.ts`:
  - `daySP(new Date("2026-11-23T20:10:00Z")) === "2026-11-23"`;
  - `weekdaySP(...) === 1`;
  - `minutesOfDaySP(...) === 1030`;
  - `daySP(new Date("2026-11-24T02:30:00Z")) === "2026-11-23"`;
  - `endOfDaySP(new Date("2026-11-23T20:10:00Z")).toISOString() === "2026-11-24T02:59:59.999Z"`.
- `tests/unit/clock.test.ts`: `adjustableClock("2026-11-23T18:30:00Z")` → `advance(100*60*1000)` → `now()` = `2026-11-23T20:10:00Z`; `set(...)` troca o instante.
- `tests/unit/ia/run-task.test.ts` (gateway falso, `vi.useFakeTimers()`):
  - 1º modelo devolve JSON fora do schema e o 2º devolve válido → `ok`, `model` = 2º, 2 tentativas (`invalid`, ok);
  - todos inválidos → `fallback: invalid`;
  - guard reprova no 1º → passa ao 2º (`guard`);
  - 1º estoura `perAttemptTimeoutMs` → `timeout` e passa ao próximo;
  - soma passa `totalBudgetMs` → `fallback: timeout`;
  - 1º responde 503 → `provider`, próximo;
  - 1º responde 402 → `fallback: unavailable` sem chamar o 2º;
  - o tracer recebe 1 `task` e 1 `attempt` por tentativa com `model`, `ok`, `latencyMs`;
  - tracer que lança não derruba o `runTask`.
- `tests/unit/ui/contrast.test.ts`, pares declarados:
  - branco/`#151515` ≥ 4,5;
  - `#151515`/`#F5F5F5` ≥ 4,5;
  - branco/`#E71C2B` ≥ 4,5;
  - `#D72E3B`/branco ≥ 4,5;
  - texto escuro/`#52AA6E` ≥ 4,5;
  - `#EF5652`/branco ≥ 3 (gráfico);
  - texto da barra/fundo da barra ≥ 4,5.

### 7.2 Integração (`vitest --project integration`, Postgres real)
- `tests/integration/db.test.ts`: `runMigrations()` 2× sem erro e a tabela `restaurants` existe; health com banco real → `db:"up"`.

### 7.3 E2E (Playwright, `--trace off`)
- `tests/e2e/fumaca.spec.ts` (local, CI e produção): texto exato da barra; `meta robots` com `noindex`; cabeçalho `X-Robots-Tag` com `noindex`; `/api/health` 200.
- `tests/e2e/componentes.spec.ts` (390 e 1280 px):
  - todos os componentes renderizam;
  - altura da barra ≤ 44 px em 390 e ≤ 28 px em 1280, com o texto completo visível;
  - `BottomSheet` abre, Tab circula dentro, Esc fecha e o foco volta ao gatilho;
  - gaveta do `PortalShell` em 390 px: abre, Esc fecha, foco volta;
  - todo alvo interativo ≥ 44 px (exceto os links da barra, que não existem na S0);
  - axe sem violações.

### 7.4 Cenários E2E da revisão (`revisar-fatia`)
- Avaliador sozinho abre `/` no celular e no computador e vê a barra legível e o logo, sem erro de console.
- Abre `/bastidores/componentes` em 390/768/1280.
- `/api/health` em produção com SHA = commit.
- Cabeçalhos via `curl -I`.
- Navegação só por teclado na galeria.
- Comparação visual dos primitivos com app/04, app/09, app/11 e portal/01.

## 8. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Build ou app esgotam a memória da VPS compartilhada (sem limites, D90) | Medição local antes; heap de 1 GB no build; webpack se o pico passar de ~1,2 GB; checagem ≥ 1,5 GB antes de cada deploy; o candidato pausa serviços se precisar |
| Domínio marcado como phishing (D88) | Barra, `noindex`, nome neutro; risco aceito pelo candidato sem mitigação extra |
| S0 invade 20/11 (D94) | Ordem por risco; passo humano no início, em paralelo |
| Saldo da chave demo consumido pelo desenvolvimento (D85) | Teto de US$ 0,10 no spike; o candidato recarrega se preciso |
| SHA não chega à imagem | 3 alternativas em ordem (6.5) |
| Saída estruturada inconsistente entre modelos | Spike real + laço de reserva + reparo de JSON desligado |
| Rastro não chega ao Langfuse | Integração oficial do AI SDK 7; spike confere a árvore; exportador nunca derruba |
| Migração trava o build | `register()` ignora a fase de build; política de 30 s no boot |
| Tokens de terceiros imprecisos | O print vence; teste de contraste; comparação visual na revisão |
| Ambiente da sessão nova sem Postgres/Chromium | Pré-voo verifica e instala |

## 9. Fora de escopo desta fatia
Componentes de domínio (D79); CSP completa com nonce (S3); rotas e telas de produto; sessão, login e isolamento (S2); limites de uso (S2); tabelas além de `owners`/`restaurants` (S1); Search Console (D88); modo apresentação (S3).

## 10. Perguntas respondidas pelo candidato
1. Branch: CLAUDE.md citava o branch da sessão anterior → **usar o branch da sessão atual e tirar o nome fixo** (D77).
2. Prints ausentes no container → o candidato **versionou os prints no repositório privado** (D76).
3. Push na `main` no meio da S0 × D12 → **exceção só para o esqueleto** (D78).
4. Quanto do design system na S0 → **base na S0, resto sob demanda** (D79).
5. Vermelho do Portal (4,46:1) → primeiro "cor exata + texto grande"; **revisto após a revisão** com tokens medidos (D80).
6. Logo → primeiro "SVG público + texto"; **revisto após a revisão: só o logo padrão do iFood em SVG** (D81).
7. Fonte → o candidato indicou designmd.app/brands/ifood → **Inter** (D82).
8. Chaves → **configurações do ambiente + sessão nova** (D83).
9. Langfuse → **não tinha conta, vai criar, região EU** (D84).
10. Tetos do OpenRouter → **2 chaves como em D60**; reconfirmado após a revisão: "qualquer coisa adiciono saldo" (D85).
11. Quem cadastra segredos → **internos pelo assistente, pagos pelo candidato** (D86).
12. noindex → **noindex + cabeçalhos básicos na S0** (D87).
13. Search Console → **não fazer**; reconfirmado após a revisão: **manter D88** (D88).
14. npm audit → **bloqueia só "critical" de produção** (D89).
15. Limites na VPS → **"deixa sem limite; se precisar, posso pausar serviços"** (D90).
16. E2E no CI → **sim, os E2E da fatia** (D91).
17. Barra no celular → **2 linhas no celular, links depois** (D92).
18. Página de componentes → **pública, com logo e cabeçalho** (D93).
19. Página "/" → **com logo iFood** (D93).
20. Linha de corte da S0 → **tudo do plano, sem corte** (D94).
21. Pedido do candidato: **revisão independente do plano por 2 subagentes** (back + front e produto) e incluir essa etapa na skill de planejamento (D95).
22. Conta do OpenRouter sem crédito (descoberto pelo MCP) → **o candidato compra os US$ 10 agora** (D97).
23. Papel do MCP OpenRouter → **consulta + testes de prompt** (D98).

## 11. Revisão independente do plano
Dois subagentes, sem acesso à conversa, leram o plano e as fontes em paralelo. Os achados passaram pelo filtro crítico do assistente; os fatos citados foram conferidos (versões publicadas dos pacotes e cores amostradas dos prints). Os que mudavam decisão voltaram ao candidato.

### 11.1 Técnica (back-end, front-end, infra) — 5 bloqueantes, 13 importantes, 9 menores
| Achado | Destino |
|---|---|
| `ai` 7: `generateObject` obsoleto; telemetria por `registerTelemetry`; `@langfuse/otel` sozinho não rastreia (existe `@langfuse/vercel-ai-sdk`) | Aceito → 6.7 |
| Migração em `instrumentation.ts` rodaria no `next build` | Aceito → 6.3 (fase de build ignorada; política de 30 s) |
| Merge antecipado com D91 ficaria vermelho (nenhum E2E ainda) | Aceito → `fumaca.spec.ts` no esqueleto |
| Barra ≤ 28 px × alvos ≥ 44 px; destinos dos links inexistentes | Levado ao candidato → D92 |
| Orçamento de 3 h não fecha | Levado ao candidato → sem corte (D94) |
| `LANGFUSE_HOST` é ignorada; o pacote lê `LANGFUSE_BASE_URL` | Aceito → D84, 6.6 |
| Filtro do Langfuse descarta spans de tracer genérico | Aceito → `startActiveObservation` |
| Spike via `tsx` não carrega `instrumentation.ts`; custo exige `usage.include` | Aceito → 6.7 |
| Contrato da IA geraria retrabalho em S2/S3 (arquivos, PDF, provedor, tentativas, guard, 402) | Aceito → interfaces em 6.7 |
| Fake timers não controlam `AbortSignal.timeout` | Aceito → `AbortController` + `setTimeout` |
| Heap do V8 não limita o Turbopack (Rust) | Aceito → medição local e webpack se preciso |
| `GIT_SHA` × `.dockerignore` | Aceito → 3 alternativas em ordem |
| Omissões do standalone (`drizzle/`, `HOSTNAME`, static, porta) | Aceito → Dockerfile |
| Health poderia travar em vez de dar 503 | Aceito → timeouts e injeção |
| Sessão nova pode não ter Postgres/Chromium | Aceito → pré-voo |
| Passo humano no meio da noite | Aceito → movido para o início |
| CI: 7 jobs, filtro de caminhos, corrida no deploy | Aceito → 3 jobs, `paths-ignore`, `concurrency` |
| Fixture de fronteiras quebrando o CI | Aceito → `baseDir` próprio |
| Menores: `middleware` → `proxy` no Next 16; fonte self-hosted e `@theme inline`; axe não prova pares de tokens; `<dialog>` nativo; relógio ajustável; Vitest em projetos; barra no iframe; Search Console em outras seções; `next start` × standalone; plugin de reparo | Aceitos → seções 5, 6 e 7 e atualização do plano |

### 11.2 Produto (UX/design, aderência ao case e ao iFood)
| Achado | Destino |
|---|---|
| Regra do vermelho contradiz o Portal (botões com texto branco ~14 px); `#C8101E` não aparece nos prints (o print usa `#D72E3B`); funil usa `#EF5652` | Levado ao candidato → D80 revisada |
| Lockup "logo iFood + 'pra comer fora' em texto" não existe no produto real | Levado ao candidato → D81 revisada (só o logo iFood) |
| Sem Search Console, não há como pedir revisão se marcarem phishing | Levado ao candidato → D88 mantida (risco aceito) |
| Barra ilegível em 390 px; links levariam a 404 | Levado ao candidato → D92 |
| Chave demo gasta no desenvolvimento | Levado ao candidato → D85 mantida |
| Escopo > 3 h sem corte | Levado ao candidato → D94 |
| Falta medir o tempo commit→no ar | Aceito → `notas-infra.md` |
| Tokens vêm do site de marketing, não do app; badge verde reprova o contraste | Aceito → print vence; regra do `Badge` verde |
| Página de componentes e página "/" eram [C] | Levado ao candidato → D93 |
| "Tipo iFood" não verificado | Aceito → declarado como [P, terceiros, não verificado] |
| Nome do serviço fixo (QRs) e pausa de serviços antes da demo | Aceito → 6.1 e checklist do dia |

## 12. Mudanças durante a implementação
- **Pré-voo (D100):** o Easypanel não permitiu criar o projeto `case-salao` (limite de 3 projetos). Por decisão do candidato, os serviços são `case-salao-db` e `case-salao-app` dentro do projeto `sites`; domínio `sites-case-salao-app.lyv8st.easypanel.host`. `app` criado com GitHub `main`, Dockerfile, auto-deploy desligado, sem limites; `DATABASE_URL` cadastrada pelo conector.
- `SESSION_SECRET` e `PHONE_HASH_SECRET` ficam para a S2, quando forem usados (nada na S0 os lê).
- **Logo (D81):** `public/logo-ifood.svg` baixado de `https://commons.wikimedia.org/wiki/File:IFood_logo.svg` (marcado como domínio público no Commons; autor "iFood"; crédito do Commons: logopng.com.br) em 19/11/2026. Conferido: sem script nem links; preenchimento `#ea1d2c`, igual ao token do logo.
- **Versões (D96, [C]):** TypeScript 6.0.3 (o 7.x é a versão nativa, sem a API JS que o typescript-eslint e o dependency-cruiser usam; o typescript-eslint exige < 6.1); `@playwright/test` 1.63.0, igual ao Chromium pré-instalado no ambiente.
- **Tabelas (0.2, [C]):** `id` uuid com `gen_random_uuid()`; `kind`/`status` como `text` + `check` (mais fácil de evoluir que enum nativo); `slug` único; `owner_id` com `on delete cascade` (a limpeza de restaurantes `teste` da S2 remove pelo dono); colunas de negócio anuláveis até a S1 definir a origem de cada uma. A rota `/api/health` entrou na 0.2 (precisa do banco), não na 0.1.
- **Boot:** a política de 30 s ficou em `src/shared/retry.ts` (`retryUntil`, testada com relógio falso: 0,5 s → 1 → 2 → 4 s, teto de 4 s).
- **Merge antecipado (D78):** feito em 19/11 23:42 UTC com o commit `06fea7b` (esqueleto). CI verde na `main`, deploy pelo webhook, health com SHA = commit e fumaça contra produção verdes. Números em `notas-infra.md`.
- **Pacotes OpenTelemetry ([C]):** `@opentelemetry/sdk-node` 0.223.2 (a 0.301 exige `@opentelemetry/api` 1.10 e exportadores ≥ 0.300, incompatíveis com o `@langfuse/otel` 6.1.1); `@opentelemetry/api` 1.9.1.
- **Motivo da reserva com falhas misturadas ([C]):** `invalid` se algum modelo respondeu fora do schema ou foi reprovado pelo guard; senão `timeout` se alguma tentativa estourou o tempo; senão `unavailable`.
- **Rastro à prova de falha:** o teste com exportador que lança revelou uma *unhandled rejection* (poderia derrubar o processo). Correção: `SafeExporter` + `SafeSpanProcessor` em `tracing.ts`.
- **Spike (19/11):** `google/gemini-2.5-flash-lite` → ok em 1,2 s (US$ 0,000092); reserva forçada por guard → `openai/gpt-5-nano` ok em 5,6 s (US$ 0,000386). Total ≈ US$ 0,0006. Árvore no Langfuse: `tarefa:*` (chain) → `tentativa:<modelo>` (span) → `invoke_agent` → `step 1` → `chat <modelo>` (generation, com custo). `provider.require_parameters: true` aceito pelos dois; o fallback do OpenRouter (`models`) não é usado (o laço é nosso). Preço do Gemini 2.5 Flash Lite no catálogo em 19/11: US$ 0,10/0,40 por M tokens (D99 registrou 0,05/0,20).
- **Design system (0.6), medições por amostragem de pixels nos prints (3x):**
  - Botão do app (app/04): 48 pt de altura, **raio 12** — não é pílula; o plano dizia "pílula" para `primary-app`, o print vence (D82). No sheet (app/11) os botões têm 52 pt e raio 16; a base usa 48/12.
  - Secundário: `#F5F5F5` com contorno `#EBEBEB`. Abas: traço de 2 pt `#151515` sobre divisor de 1 pt `#E0E0E0`; inativa `#666666`. Texto secundário e chips: `#666666`.
  - Bottom sheet (app/11): fundo `#FAFAFA`, raio ~55 pt (token `--radius-sheet: 56px`; a designmd.app sugere 16, o print vence), alça 40×4 pt `#D8D8D8`.
  - Portal (portal/01): botão com raio 4 e ~40 px de altura; aqui com altura mínima de 44 px (acessibilidade). Cores dos botões seguem D80.
  - Sombras e escala de raios: designmd.app (`low`…`highest`; 4/8/12/16/24).
  - A barra de protótipo virou `<aside aria-label="Aviso de protótipo">` (landmark), porque o axe acusou conteúdo fora de região com `role="note"`.
  - Ações do sheet: largura igual quando cabem; o rótulo maior ganha espaço em vez de quebrar linha (a Inter é mais larga que a fonte do app).
- **Impacto do replanejamento v2 (D201–D224) na S0, conferido em 20/11:** nenhuma mudança no que foi implementado (D202). Conferido item a item:
  - contrato de IA: a tarefa 3 monta o `TaskDef` **por chamada** (schema com `slotId`/`candidataId` como enum; guard confere pertença e permutação) — o `runTask` já aceita isso sem mudança; o revisor de outro provedor usa `ModelRef.provider`;
  - referências novas (`{horario:…}`, `{oferta}`, `{convite}`) são dos guardrails da S2;
  - dados: a tabela `restaurants` da migração `0000` tem `idle_hours` (substituída por `idle_slots` na v2) e não tem ticket médio e margem — ajuste na **migração `0001` da S1 (Tarefa 1.8)**. A `0000` não pode ser editada: já foi aplicada em produção;
  - `weekKeySP` (semana ISO em SP) entra na S1 (Tarefa 1.1), sobre `tz.ts`;
  - design system: `Badge` atende o selo "Novo" da sidebar; o token `red-chart` atende o funil; nada novo na base;
  - MCP (`/api/mcp`) e suas dependências ficam para a S3.
- **Verificação final (20/11):** lint, tipos, fronteiras, 59 testes (unitários + integração), 19 E2E (fumaça + galeria em 390/1280 px, axe), `npm audit` sem vulnerabilidades, imagem Docker com health `up` e rastro ligado. Memória do build em `notas-infra.md`.
