# Revisão da fatia S0 — Fundação

Data: 20/11/2026 · Base: `acafce6` · Revisado: `b245c2d` (+ docs) · Produção: `9cd22c1` (merge da S0, no ar às 02:24 UTC)

Revisores independentes (D08): aderência ao case e ao iFood · técnica e arquitetura · produto, design e UX · segurança, IA e qualidade. E2E profunda feita pela IA (D09). Decisões sobre cada achado tomadas pela IA (D101), registradas abaixo.

## 1. Resumo e veredito
**Pronta para merge** depois das correções desta revisão. Nenhum achado crítico. Os 5 achados altos foram corrigidos (rastro com arquivos, health sem migração, Button carregando, memória do build, contrato de IA com dados perdidos). O que ficou para depois está na seção 2 com a fatia responsável.

## 2. Achados consolidados
| # | Grav. | Frente | Achado | Evidência | Correção | Decisão |
|---|---|---|---|---|---|---|
| 1 | alto | segurança/IA | Rastro gravava entradas e enviava mídia ao Langfuse por padrão — contradiz "imagem nunca guardada" (espec. 4.4, D46) | `ai` `recordInputs` "Enabled by default"; `@langfuse/otel` `mediaUploadEnabled` padrão `true` (conferido nos `.d.ts`) | `mediaUploadEnabled: false`, `mask` que apaga data URI/base64, `recordInputs: false` quando há arquivos; testes da máscara | **corrigido** (`cb4ab36`) |
| 2 | alto | técnica | Health respondia 200 com migração falhada; gate do deploy passaria com schema errado | `migrateOnBoot` só registrava; health fazia `select 1` | `ensureMigrated` (uma execução por vez, nova tentativa quando o banco volta); health 503 até migrar; testes | **corrigido** (`c3c2205`) |
| 3 | alto | produto/UX | Button carregando perdia o foco (`disabled`), parecia desabilitado e o Portal carregando dava 2,3:1 | `Button.tsx` `disabled={disabled \|\| loading}` + `opacity-50` | `aria-disabled` + clique ignorado, cor cheia, `aria-live`; E2E do foco | **corrigido** (`b245c2d`) |
| 4 | alto | aderência/técnica/seg. | Build Turbopack a ~95% do limite de memória | `notas-infra.md` (1,10–1,15 GB × ~1,2 GB) | Trocar já para webpack + `webpackMemoryOptimizations` (944 MB) | **corrigido** (`c3c2205`, D102) |
| 5 | médio→alto | técnica/IA | Contrato de IA perdia dados: modelo servido, motivos do guard, detalhe do erro, custo da saída inválida; guard que lança virava `provider` | `run-task.ts`, `openrouter-gateway.ts` (sondas do revisor técnico) | `servedModel`, `notes`, `detail`, `usage` no erro `invalid`, guard que lança → `guard` | **corrigido** (`cb4ab36`) |
| 6 | médio | técnica | Orçamento e latência medidos com o `Clock` de negócio (com `fixedClock`, orçamento ignorado e latência 0) | sonda do revisor | `stopwatch` próprio no contexto (padrão `Date.now`); teste com `fixedClock` | **corrigido** |
| 7 | médio | segurança/IA | 401/403 tratados como `provider` (tenta o próximo modelo com a mesma chave); classificação real sem teste | `openrouter-gateway.ts` | `auth` terminal; testes com `APICallError`/`NoObjectGeneratedError` reais | **corrigido** |
| 8 | médio | segurança/IA | Sem cancelamento externo nem teto de saída (402 por custo estimado) | `RunTaskContext`, `generateText` | `signal?` no contexto, `maxOutputTokens?` no `TaskDef` | **corrigido** |
| 9 | médio | técnica | Regra de fronteiras incompleta (`pg`, `@langfuse`, camadas, `app/` passavam) | sonda do revisor | regra ampliada + 7 casos na fixture | **corrigido** (`c3c2205`) |
| 10 | médio | técnica | Deploy exigia SHA exato; push de docs na `main` no meio daria falso vermelho | `ci.yml` | aceita descendente (`merge-base --is-ancestor`), fumaça no SHA real | **corrigido** |
| 11 | médio | segurança | "Rollback por revert" não desfaz migração | espec. 4.5 | Migrações só aditivas até o congelamento + procedimento de volta | **corrigido** (D103, `notas-infra.md`) |
| 12 | médio | aderência | S0 sem prova em produção (IA, rastro e design system só locais) | health de produção em `06fea7b` | merge + deploy + fumaça (inclui a galeria) | **corrigido nesta revisão** (seção 4) |
| 13 | médio | produto/UX | Selo "Novo" e sidebar não batem com portal/05 (pílula contornada; item ativo com fundo rosado e barra vermelha) | `Badge.tsx`, `PortalShell.tsx` × portal/05 | tom `outline-red` em pílula + `NavItem` com `aria-current` | **corrigir depois — S2** (quando o Portal ganhar o item "Comer Fora no salão"; D79) |
| 14 | médio | produto/UX | Faltam primitivos genéricos: campo com rótulo/erro, painel lateral, aviso, tabela com rolagem | espec. 3.1, portal/01, Apêndice B | — | **corrigir depois — S2** (a lista da S2 já tem `SidePanel`, `DataTable`, `Toast`; acrescentar `Field`) |
| 15 | médio | produto/UX | API do BottomSheet estreita (todo `children` como texto cinza; fundo sempre fecha) | `BottomSheet.tsx` | `description` × `children`, `dismissible` | **corrigido** (`b245c2d`) |
| 16 | médio | produto/UX | "Fechar" do sheet é branco no print, cinza na galeria | app/11 × sheet-390 | variação `outline-app` | **corrigido** |
| 17 | médio | segurança | `SafeExporter` só no caminho de teste | `tracing.ts` | teste com o exportador **padrão** para endereço inacessível, sem rejeição solta | **corrigido** (teste prova o caminho real) |
| 18 | baixo | aderência/E2E | 404 padrão do Next em inglês, sem saída | captura 404 (E2E da IA) | `app/not-found.tsx` em português | **corrigido** |
| 19 | baixo | produto/UX | Título do sheet em 2 linhas | sheet-390 | 20 → 18 px | **corrigido** (ainda 2 linhas: a Inter é mais larga que a fonte do app; aceito) |
| 20 | baixo | produto/UX | Galeria sem "Pular para o conteúdo"; rótulo "Menu principal (gaveta)" | `PortalShell.tsx` | skip link + rótulo único | **corrigido** |
| 21 | baixo | produto/UX | Spinner gira com `prefers-reduced-motion`; fundo do sheet sem desfoque | `Button.tsx`, app/11 | `motion-safe:animate-spin`; `backdrop-blur-sm` | **corrigido** |
| 22 | baixo | produto/UX | Inglês e jargão na galeria pública ("Bottom sheet", "PortalShell", "self-hosted") | Galeria | textos em português | **corrigido** |
| 23 | baixo | segurança | Sem HSTS | `curl -I` | `Strict-Transport-Security: max-age=31536000` (sem `includeSubDomains`) | **corrigido** |
| 24 | baixo | segurança | Langfuse sem `environment`/`release` | `tracing.ts` | `producao`/`desenvolvimento`/`spike` + SHA | **corrigido** (spike conferido no Langfuse) |
| 25 | baixo | técnica | Pool sem timeout de consulta | `client.ts` | `query_timeout`/`statement_timeout` 15 s | **corrigido** |
| 26 | baixo | segurança | OpenRouter sem `provider.data_collection: "deny"` | `openrouter-gateway.ts` | — | **corrigir depois — S2** (conferir no spike da extração se os modelos continuam roteando) |
| 27 | baixo | segurança/técnica | Logs em texto livre; sem flush do rastro no SIGTERM | espec. 4.8 | — | **corrigir depois — S3** (`ai_calls` + logs estruturados) |
| 28 | baixo | técnica | `restaurants.owner_id` sem índice | schema | — | **corrigir depois — S1** (migração `0001`, aditiva) |
| 29 | baixo | técnica | Migrador sem advisory lock | `migrate.ts` | — | **não corrigir**: migrações aditivas (D103) e o retry cobrem a sobreposição de containers |
| 30 | baixo | técnica | CHECK com listas literais em vez das constantes | schema | — | **não corrigir**: o Drizzle não interpola arrays em `check`; o teste de integração cobre |
| 31 | baixo | aderência | Health não diz se a IA está configurada | — | — | **não corrigir**: variáveis conferidas por nome no Easypanel (pré-voo); o 1º rastro de produção (1ª rota de IA, S2) confirma — item do E2E da S2 |
| 32 | baixo | técnica | 402 de orçamento em voo é transitório e encerra o laço | doc. OpenRouter | — | **não corrigir agora**: `maxOutputTokens` reduz a causa; reavaliar na S2 |
| — | — | produto/UX | "Chip pequeno (~14 px no print)" | medição de pixels em app/04: ~8,3 pt de tinta ≈ 11–12 px | — | **não procede**: o chip de 12 px bate com o print |
| — | — | aderência | Logo grande e barra de 24 px em "/" (risco de marca) | home-1280 | — | **não corrigir**: D88/D93 vigentes; "/" é substituída na S3 |
| — | — | produto/UX | Rolagem do fundo no iOS e `viewport-fit=cover` (suspeitas) | — | — | **verificar na S1** (telas do cliente que abrem o QR) |

## 3. Matriz E2E (local, standalone + Postgres)
| Cenário | Persona | Tela | Esperado | Observado | Evidência | Veredito |
|---|---|---|---|---|---|---|
| Abre "/" | avaliador sozinho | 390/768/1280 | barra legível, logo, texto exato, sem erro de console | ok; ~0,55 s até carregar; 0 erros | `home-*.png` | ok |
| Abre a galeria | avaliador | 390/768/1280 | todos os componentes, cabeçalho exato | ok | `galeria-*-topo/inteira.png` | ok |
| Barra em telas estreitas | avaliador no celular | 320/360/390/639/640 | ≤ 44 px abaixo de 640; ≤ 28 px a partir de 640 | 40/40/40/24/24 px | `home-320.png` | ok |
| Navegação só por teclado | avaliador | 1280 | foco visível em todo focável | 40 Tabs, todos com contorno; "Pular para o conteúdo" é o 1º | E2E | ok |
| Painel inferior | cliente (base S1) | 390/1280 | abre, Tab circula, Esc/fundo fecham, foco volta; confirmação não fecha no fundo | ok | `sheet-*.png`, E2E | ok |
| Gaveta do Portal | dono no celular | 390/768 | abre, foco preso, Esc fecha, item fecha e navega sem esconder a seção sob a barra | ok (seção a 48 px do topo) | `gaveta-*.png`, E2E | ok |
| Button carregando | dono (base S2) | 390 | foco mantido, clique ignorado, cor cheia | ok | `botoes-foco-*.png`, E2E | ok (após correção) |
| Recarregar com o painel aberto | qualquer | 1280 | volta fechado, sem erro | ok | E2E da IA | ok |
| 404 | avaliador que erra a URL | 390 | português, barra, caminho de volta, `noindex` | antes: inglês; depois: ok | `404-390.png` | ok (após correção) |
| Modo escuro do sistema | avaliador | 390 | página continua clara e legível | ok | E2E da IA | ok |
| Texto a 200% | avaliador | 390 | barra cresce sem corte | ok | E2E da IA | ok |
| Banco fora no boot | operação | — | servidor sobe em ~30 s, health 503 `db:"down"` | 31 s, 503 | container local | ok |
| Banco volta depois | operação | — | health migra e volta a 200 sem restart | coberto por `ensureMigrated` (testes) | unit + integração | ok |
| Exportador do rastro fora | operação | — | tarefa ok, sem rejeição solta | ok | `tracing.test.ts` | ok |
| Spike real | — | — | árvore tarefa → tentativa → geração com custo; ambiente "spike" | 14 observações, US$ 0,0005 | Langfuse | ok |
| axe | todas | 390/1280 | 0 violações | 0 (antes: `region` na barra, corrigido) | E2E | ok |

## 4. Matriz E2E (produção — https://sites-case-salao-app.lyv8st.easypanel.host)
| Cenário | Esperado | Observado | Evidência | Veredito |
|---|---|---|---|---|
| Deploy pelo CI | 3 jobs verdes → webhook → SHA do merge no health → fumaça | push 02:19:58 → webhook 02:22:04 → no ar 02:24:22 (~4 min 24 s; build webpack na VPS ~2 min 18 s) | run 9 do CI na `main` | ok |
| `/api/health` | `ok:true`, `db:"up"`, SHA do merge | `{"ok":true,"db":"up","sha":"9cd22c1…"}` | curl | ok |
| Suíte E2E inteira contra produção | fumaça + galeria (390/1280, axe, foco, gaveta, painel, alvos) + correções (Button, skip link, confirmação, 404) | **24/24 verdes** com `EXPECTED_SHA` | Playwright com `BASE_URL` | ok |
| Cabeçalhos | `noindex`, `nosniff`, `Referrer-Policy`, `frame-ancestors`, HSTS | todos presentes | `curl -I` | ok |
| 404 | 404 em português com a barra | ok | E2E | ok |
| Console e rede nas 3 larguras | 0 erros, 0 respostas ≥ 400 | 0 / 0; "/" ~1,4 s e galeria ~0,85 s até `networkidle` | `capturas/producao/*` | ok |
| Memória da VPS no build | ≥ 1,5 GB livres | 2,41 GB antes; 2,28 GB durante (amostra) | conector Easypanel | ok |

## 5. Console, rede, tempos e acessibilidade
- Console e rede: 0 erros e 0 respostas ≥ 400 nas 3 larguras (exceto o 404 proposital).
- Tempo até a tela útil (local): ~0,55 s.
- Build: webpack 944 MB / ~32 s (local, D102).
- axe: 0 violações na galeria (390/1280) e com a gaveta aberta.

## 6. Correções aplicadas
| Achados | Commit | Verificação |
|---|---|---|
| 1, 5–8, 17, 24 | `cb4ab36` | 41 testes de IA; spike real com rastro no Langfuse |
| 2, 4, 9–11, 23, 25 | `c3c2205` | 86 testes; build webpack medido; regex e ancestralidade do deploy conferidos |
| 3, 15, 16, 18–22 | `b245c2d` | 24 E2E (incl. foco do Button, skip link, confirmação, 404); capturas novas |

## 7. Decisões novas registradas
D101 (autonomia), D102 (webpack), D103 (migrações aditivas e procedimento de volta) → `decisoes-e-tradeoffs.md`.
