# Notas de infraestrutura

Registro pedido no planejamento da S0 (§6.5). Sem IP nem dados dos serviços do candidato.

## Onde roda (D100)
- Easypanel, projeto `sites`, serviços `case-salao-app` (GitHub `main`, Dockerfile, auto-deploy desligado, sem limites — D90) e `case-salao-db` (Postgres 16, sem porta exposta).
- Domínio: `https://sites-case-salao-app.lyv8st.easypanel.host`.
- Deploy: job `deploy` do CI chama o webhook do Easypanel depois de `check`, `integracao` e `e2e` verdes; em seguida espera o SHA no `/api/health` e roda a fumaça contra produção.

## Memória do build (medição local, 19/11, 4 CPUs, Node 22, `experimental.cpus: 1`, heap 1 GB)
| Empacotador | Tempo | Maior processo (`/usr/bin/time -v`) | Soma da árvore de processos (amostragem) |
|---|---|---|---|
| Turbopack (`next build`) | 5 s | 697 MB | 918 MB |
| webpack (`next build --webpack`) | 27 s | 524 MB | 562 MB |

- **Fim da S0 (20/11, com IA, rastro e design system):** Turbopack 1.105–1.146 MB (7–26 s); webpack 896 MB (33 s).
- Regra do plano: webpack só se o pico passar de ~1,2 GB → **Turbopack**, mas já a ~95% do limite. **Remedir no início da S1**; ao passar de 1,2 GB, trocar para `build:webpack` no Dockerfile. A medição local usa 4 CPUs; a VPS tem 2, o que tende a reduzir o pico do Turbopack. Trocar é uma linha (`build` → `build:webpack` no Dockerfile).
- Reavaliar a cada fatia: o app cresce e a VPS tem ~2,4 GB livres (19/11).
- Imagem final: 422 MB no esqueleto; 426 MB no fim da S0. App em repouso: ~47 MB (esqueleto) → ~62 MB (com rastro ligado).

## Empacotador (D102, 20/11)
- Trocado para **webpack** no fim da S0: `npm run build` = `next build --webpack` com `experimental.webpackMemoryOptimizations`. Pico local 944 MB em ~32 s (Turbopack: 1.105–1.146 MB). `npm run build:turbo` fica para comparação.

- **Fim da S1 (20/11, webpack):** maior processo 676 MB (`/usr/bin/time -v`), soma da árvore 826 MB (amostragem), 26 s. Folga confortável abaixo de ~1,2 GB.
- **Fim da S2 (20/11, webpack):** maior processo **1,48 GB** com o pdf.js empacotado → **1,39 GB** com o pdf.js servido de `public/vendor` (47 s). O resto do crescimento vem das rotas novas (26 rotas de API). Acima da linha de ~1,2 GB; aceito (D133) com a memória livre da VPS conferida antes do merge.
- **Seed da vitrine (S1):** 60 dias simulados (~1.700 clientes, ~2.900 check-ins) gravados em ~2,3 s localmente, fora do `register` (health 503 até terminar).

## Pico na VPS (1º build, 19/11 23:43 UTC)
- Antes: 2,52 GB livres. Durante o build (amostra com CPU em 79%): 2,07 GB livres (~455 MB a mais em uso). Depois: 2,16 GB livres.
- O monitor do Easypanel só dá amostras pontuais; o pico real pode ter sido um pouco maior. Folga confortável acima de 1,5 GB.

## SHA do commit no health
- Ordem: 1) `ARG GIT_SHA` no build; 2) `.git/HEAD` + refs liberados no `.dockerignore`; 3) variável `GIT_SHA` no serviço.
- Local (`docker build`): alternativa 2 funcionou (`resolve-sha: <sha> (fonte: .git)`).
- Na VPS: o SHA chegou certo no 1º deploy (`06fea7b`), por ARG ou por `.git` — sem acesso ao log de build pelo conector, não dá para dizer qual. A alternativa 3 não foi necessária.

## Boot com banco fora
- Teste local com banco inacessível: o servidor fica pronto em ~31 s (11 tentativas) e o health responde 503 `db:"down"`.
- Se o banco voltar depois, as migrações só rodam no próximo restart do serviço (aceito: na S0 só há a migração inicial).

## Tempo do commit até o ar
- 1º deploy (19/11): push na `main` 23:42:14 → CI verde e webhook 23:43:35 → SHA no health 23:44:59. **~2 min 45 s do push ao ar** (~1 min 25 s de build/troca na VPS).
- Fumaça contra produção (4 testes, com SHA esperado) verde no próprio job.
- Merge da S0 (20/11, build webpack): push 02:19:58 → webhook 02:22:04 → no ar 02:24:22. **~4 min 24 s do push ao ar** (~2 min 18 s de build/troca na VPS). Memória livre na VPS: 2,41 GB antes, 2,28 GB durante (amostra).

## Procedimento de volta (D103)
1. Identificar o último commit bom (SHA no `/api/health` antes do problema; histórico do job `deploy`).
2. `git revert` do(s) commit(s) ruim(ns) no branch da sessão → CI verde → merge na `main` (o deploy sai pelo webhook).
3. Conferir `/api/health` com o SHA do revert e a fumaça contra produção (o job `deploy` faz isso).
4. Migrações são só aditivas até o congelamento: o revert de código convive com o schema novo; nada de "down".
5. Último recurso: no Easypanel (`sites` → `case-salao-app`), refazer o deploy a partir do commit bom.

## Último commit seguro em 23/11
_A preencher antes do congelamento (15h)._

## Ambiente de desenvolvimento (nuvem)
- Docker Hub e o frontend `# syntax=` respondem 429 a partir do proxy deste ambiente; para teste local, a imagem `node:22-bookworm-slim` vem de `mirror.gcr.io` e a CA do proxy entra por um Dockerfile de teste fora do repositório. O Dockerfile do repositório não depende disso.

## Fumaça manual em produção (S7, 22/11)
- Workflow `.github/workflows/fumaca-producao.yml` (`workflow_dispatch`): roda só a fumaça contra produção, com a mesma lista de specs do job `deploy`, sem build nem deploy. Entrada opcional `expected_sha`.
- Uso: antes de enviar o link e depois de "Recriar minha demo"/"Recriar vitrine" na manhã de 23/11.
