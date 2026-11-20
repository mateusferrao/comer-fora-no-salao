# Revisão da fatia S1 — Domínio e fluxo do cliente

Data: 20/11/2026 · Base: `fd7a1c9` (planejamento aprovado) · Revisado: `b001d5b` · Produção: `cf07d32` (merge da S1, no ar às 03:59 UTC)

Revisores independentes (D08): aderência ao case e ao iFood · técnica e arquitetura · produto, design e UX · segurança, IA e qualidade. E2E profunda feita pela IA (D09). Decisões sobre cada achado tomadas pela IA (D101), registradas abaixo.

## 1. Resumo e veredito
**Pronta para merge** depois das correções desta revisão. Achados:
- **1 crítico**, corrigido: telefones repetidos na simulação derrubariam o seed numa das 7 datas de início.
- **9 altos**, todos corrigidos: oferta do convite não congelada; telefone sem prova; PII em log e no health; E2E do cliente fora da produção; barra de protótipo atrás dos sheets; "Continuar" fora da tela; capturas sem o convite.
- **1 alto parcial:** o avaliador sozinho não vê a volta com código. A volta depende de "Antecipar convite", que chega na S3, e fica registrada como dívida não cortável.

Nenhuma decisão do candidato foi reaberta.

## 2. Achados consolidados
| # | Grav. | Frente | Achado | Evidência | Correção | Decisão |
|---|---|---|---|---|---|---|
| 1 | **crítico** | técnica | Telefones da simulação sorteados (`0090`+7 dígitos) colidiam: o seed da vitrine falharia (HMAC único) e o health ficaria em 503 | conferido: 1 repetido com início em 24/11 (terça) | telefone sequencial por rodada + HMAC com prefixo da rodada (nunca colide com pessoa nem entre rodadas) | **corrigido** |
| 2 | alto | técnica | Oferta do convite **não congelada**: a volta usava a oferta atual da faixa (código com item novo e versão antiga) — contraria espec. 3.3 / D218 | `do-checkin.ts` lia `ctx.convites[slot]` | oferta, item e título pela versão gravada no convite (`loadVersion`); teste de integração trocando a versão da faixa | **corrigido** |
| 3 | alto | segurança | Telefone funcionava como senha: digitar um número cadastrado dava o cookie (nome, restaurantes, códigos do dia) | `identify-customer.ts` | telefone já cadastrado só entra se o **nome confere** (sem maiúsculas/acentos); 409 "telefone em uso" com orientação; em produção, login iFood/OTP | **corrigido** [C] |
| 4 | alto | segurança | PII podia ir ao log e ao `/api/health` (mensagem do Drizzle traz parâmetros) | `drizzle-orm/errors.js` (conferido); rotas e `seedReason` | `safeErr` (só nome + código); health sem motivo | **corrigido** |
| 5 | alto | segurança/operação | E2E do cliente não rodava contra produção; segredo ausente passaria despercebido | `ci.yml` (só `fumaca.spec.ts`) | `cliente.spec.ts` no job `deploy` (beacon pulado em produção); seed falha sem os 2 segredos → health 503 | **corrigido** |
| 6 | alto | produto/aderência | Barra de protótipo some atrás do fundo dos sheets — justamente na identificação | capturas `identificacao-*`, `gps-*` | aviso repetido no topo de todo sheet + E2E "barra visível com o sheet aberto" | **corrigido** |
| 7 | alto | produto | "Continuar" fora da tela na identificação; foco no 1º campo abria o teclado | `identificacao-390/1280` (antes) | ações fixas no rodapé do sheet; foco inicial no título; botão `submit` do formulário (Enter envia) | **corrigido** |
| 8 | alto | produto/aderência | Capturas sem o 2º card (os 2 clientes eram holdout) | banco local: `arm=holdout` | **não é bug** (sorteio conferido: 9,8–10,2% com UUIDs do Node e do Postgres; acaso de ~1%); recapturado com convidável + teste de integração "1ª visita na vitrine recebe o convite" | **corrigido (cobertura)** |
| 9 | alto | aderência | Avaliador sozinho não fecha a volta com código | D223: "Antecipar convite" na S3 | dívida **S3, não cortável**: roteiro curto na entrada ("1 em 10 cai no grupo de controle → Testar como outro cliente; para ver a volta → restaurante de teste + Antecipar") | **corrigir depois — S3** |
| 10 | médio | segurança | Health refazia o seed a cada consulta depois de falha | `app/api/health/route.ts` | espera crescente (60 s, 120 s…; máx. 5) | **corrigido** |
| 11 | médio | segurança | Rotas públicas sem limite até a S2 (teto da vitrine esgotável por script; leituras infladas sem cookie) | `leitura/route.ts`, `vitrine.ts` | limite em memória por IP e por restaurante (provisório até a S2), leitura sem `cf_aparelho` não conta; restaurante E2E oculto fora dos limites | **corrigido** [C] |
| 12 | médio | técnica | Pool com `query_timeout` de 15 s anulava o limite de 120 s do seed | `client.ts` | pool só do seed (1 conexão, 120 s); vitrine e E2E em transações separadas | **corrigido** |
| 13 | médio | técnica | `params` das versões lido sem validação; desvio da interface `OfferStrategy` | `context.ts`, `offers.ts` | parse pelo schema da estratégia no carregamento (versão inválida não entra em vigor); desvio da interface registrado em D111 | **corrigido** |
| 14 | médio | técnica | Saída das rotas sem Zod | rota do check-in | `checkinViewSchema.parse` (descarta campos extras) | **corrigido** |
| 15 | médio | produto | Recarregar exigia refazer o GPS para ver o código | `CheckinFlow.tsx` | a página abre direto no resultado do dia (`getTodayResult`) | **corrigido** |
| 16 | médio | produto | Faixa branca no fim da tela escura | capturas `cartela-390`, `resultado-*` | `AppShell` com fundo da coluna | **corrigido** |
| 17 | médio | produto | O "agora" não aparece quando pedimos os dados (H4) | sheet de identificação | "Ao continuar, você ativa: Doce grátis · Panna cotta e ganha 1 selo." | **corrigido** |
| 18 | médio | produto | Fechar a identificação obrigava refazer o GPS | `CheckinFlow.tsx` | GPS reaproveitado por 5 min | **corrigido** |
| 19 | médio | produto | "Gerar outros" ao lado do telefone trocava também o nome; Enter não enviava | `IdentifySheet.tsx` | "Gerar outros dados fictícios" abaixo dos campos; `submit` | **corrigido** |
| 20 | médio | produto | Convite na Jornada sem instrução e sem dias por extenso | `JourneyView.tsx` | reaproveita o `InviteCard` | **corrigido** |
| 21 | médio | aderência | Vitrine dependia de 1 semente | `generator.ts` | teste com 20 sementes: IC > 0 em **17 de 20** (limiar 75%); declarar "17 de 20" em "Como funciona" (S3) | **corrigido** |
| 22 | médio | aderência | "Simulador por agente" se confunde com agente de IA | — | escrever "simulação baseada em agentes (sem IA)" em "Como funciona" e no slide | **corrigir depois — S3/S4** |
| 23 | médio | aderência | IA ausente do núcleo até a S2 | D110 | ativação com IA (foto → pacote) é o 1º item **não cortável** da S2 | **corrigir depois — S2** (prioridade) |
| 24 | médio | aderência | Muitos [C] autônomos: risco no "domínio da solução" | §14 | "cola" de 1 página com cada [C] e o motivo; ensaiar "mudar na hora" (`HOLDOUT_PCT`, teto) | **corrigir depois — S4** |
| 25 | baixo | segurança | CSRF: POST sem conferir origem; `text/plain` aceito | rotas | `Sec-Fetch-Site` same-origin/none + `application/json` | **corrigido** |
| 26 | baixo | segurança | Assinatura do cookie sem finalidade (S2 usa o mesmo segredo) | `crypto.ts` | assina `cliente:<id>` | **corrigido** |
| 27 | baixo | segurança | Identificação não conferia restaurante ativo | rota | confere `status = ativo` | **corrigido** |
| 28 | baixo | técnica | `simulation_runs.seed = 0` e parâmetros sobrescritos | `seed/index.ts`, `persist.ts` | semente e parâmetros gravados | **corrigido** |
| 29 | baixo | técnica | Código de 1ª visita emitido sem benefício configurado | `do-checkin.ts` | só emite código com benefício vigente | **corrigido** |
| 30 | baixo | produto | Interruptores com 28 px de altura de toque (E2E da IA) | medição no navegador | botão de 44 px com o trilho dentro | **corrigido** |
| 31 | baixo | produto | Código do convite com título repetido ("Seu convite · Cannoli") (E2E da IA) | `e2e-vitrine-recompensa.png` | título da oferta da versão ("Doce grátis · Cannoli") | **corrigido** |
| 32 | baixo | produto | Chips do card quebravam em 2 linhas (390 px) | `restaurante-390` | imagem de 84 px | **corrigido** |
| 33 | baixo | produto | Mesma foto para Panna cotta e Tiramisù | `detalhe-390` | legenda "Foto ilustrativa" | **corrigido** |
| 34 | baixo | produto | Sheet de regras sem botão de fechar | `regras-*` | botão "Entendi" | **corrigido** |
| 35 | baixo | produto | Identidade fictícia gerada no servidor e no navegador (possível divergência) | `IdentifySheet.tsx` | gerada só ao abrir, no navegador | **corrigido** |
| 36 | baixo | produto | Detalhe do benefício virou sheet; print 12 é tela escura inteira | `detalhe-390` × app/12 | — | **não corrigir agora**: sheet acessível e consistente; fidelidade fina fica para o polimento de 23/11 se sobrar tempo |
| 37 | baixo | produto | Foto do salão em preto e branco | `salao.jpg` | trocar por foto colorida com licença livre | **corrigir depois — S3** (polimento) |
| 38 | baixo | produto | "Créditos das fotos" abre um .md cru | aba Sobre | página "Como funciona" | **corrigir depois — S3** |
| 39 | baixo | técnica | N+1 no `getJourney`; contexto carregado 2× na página | `queries.ts` | `React.cache` / consulta única | **não corrigir agora**: poucos restaurantes por cliente; revisitar se a Jornada crescer |
| 40 | baixo | técnica | Acoplamentos (queries → do-checkin; seed → aplicação; página → seed) e legibilidade do `doCheckin` | — | — | **não corrigir agora**: seed é a composição da infraestrutura; refatorar sem ganho de produto na reta final |
| 41 | baixo | técnica | Chave de idempotência global × busca por cliente (reuso malicioso → 500); 2 beacons simultâneos contam 2 | — | — | **não corrigir**: exige chave forjada; leituras com limite e cookie de aparelho |
| — | — | produto | "Recado do Cantina…" com gênero estranho; "Você terá que fazer check-in depois" sem sentido | — | — | **não procede**: textos iguais aos prints 12 e 10 do app real (fidelidade) |
| — | — | técnica | Teste "grupo gravado uma vez sob corrida" ausente | — | — | **não procede**: o lock por cliente (`FOR UPDATE`) serializa; `WHERE arm IS NULL` garante; coberto pelo teste diferencial |

## 3. Matriz E2E (local, IA — 390/768/1280 px)
| Cenário | Persona | Tela | Esperado | Observado | Evidência | Veredito |
|---|---|---|---|---|---|---|
| Vitrine abre; nada de oferta/horário antes do check-in | avaliador | restaurante | abas, linha genérica, barra, noindex | ok | `restaurante-*`, E2E | ok |
| GPS perto (permissão + posição no restaurante) | cliente | check-in | sem aviso; distância "0 m" | ok | `e2e-gps-perto-identificacao` | ok |
| GPS longe 2 km / ~360 km | avaliador remoto | restaurante/check-in | aviso; "2,0 km"; >5 km escondido; "Fechar" cancela | ok | script E2E | ok |
| GPS negado → confirmar → identificação → 1ª visita | cliente | resultado | código + selo 1/6 + 2º card | ok | `resultado-*` | ok |
| Holdout | cliente | resultado/Jornada | sem 2º card, sem "convite" na resposta | ok | E2E + integração | ok |
| Volta fora da faixa | cliente | resultado | lembrete "continua valendo", 2/6 | ok | `e2e-vitrine-lembrete` | ok |
| Volta na faixa em outro dia | cliente | resultado | código do convite, "vale hoje" | ok (título repetido → corrigido #31) | `e2e-vitrine-volta-convite` | ok após correção |
| 6º selo | cliente | resultado | recompensa com código, 6/6 | ok | `e2e-vitrine-recompensa` | ok |
| Recarregar / já fez hoje | cliente | check-in | códigos do dia sem refazer GPS | antes: exigia GPS → corrigido #15 | E2E | ok após correção |
| 2 identidades no mesmo dia | 2 clientes | API | as 2 com 1ª visita | ok | E2E | ok |
| Testar como outro cliente | avaliador | resultado | volta ao restaurante e pede identificação | ok | E2E | ok |
| Falha de rede | cliente | check-in | "Não conseguimos…" + "Tentar de novo" com a mesma chave | ok | E2E | ok |
| Formato inválido / sem aceite | cliente | identificação | erros ligados ao campo | ok | E2E + axe | ok |
| Teclado e Esc | todos | sheets | Esc fecha, foco volta ao card | ok | script E2E | ok |
| Alvos de toque | todos | identificação | ≥ 44 px | interruptores 28 px → corrigido #30 | medição | ok após correção |
| Jornada vazia (768) | avaliador | Jornada | texto do app | ok | `e2e-jornada-vazia-768` | ok |
| Barra com sheet aberto | todos | sheets | aviso visível | antes escondida → corrigido #6 | `identificacao-390` | ok após correção |
| Check-in com a loja fechada | avaliador de madrugada | check-in | aceito (D28) | ok (testado à 0h40 SP) | capturas | ok |

## 4. Matriz E2E (produção — `cf07d32`)
| Cenário | Esperado | Observado | Evidência | Veredito |
|---|---|---|---|---|
| Deploy | SHA do merge no health, migração 0001 e seed | push 03:55:15 → no ar 03:59:15 (~4 min); seed `ok` ~10 s depois (health 503 enquanto semeava) | `/api/health` | ok |
| Health | `{ok, db up, seed ok, sha}` | `{"ok":true,"db":"up","sha":"cf07d32…","seed":"ok"}` | curl | ok |
| E2E fumaça + cliente + componentes contra produção | tudo verde | **34 passaram, 1 pulado** (beacon, de propósito em produção) | Playwright com `BASE_URL` e `EXPECTED_SHA` | ok |
| Vitrine | 200, `noindex`, HSTS, sem erros de console | 200 em 1,2 s (1ª carga), `noindex, nofollow`, HSTS, 0 erros | `capturas/producao/vitrine-390.png` | ok |
| Check-in, holdout, 2 identidades, rede, recarregar, barra nos sheets | como no local | ok (no restaurante E2E oculto — D109) | E2E | ok |
| Segredos de produção (D105) | identificação funciona (HMAC + cookie assinado) | ok (E2E de identificação verde; seed exige os 2) | E2E | ok |
| Memória da VPS antes do merge | folga para o build (~0,83 GB) | 2,5 GB livres | Easypanel (leitura) | ok |

## 5. Console, rede, tempos e acessibilidade
- Console e rede: nenhum erro nas rotas do cliente (o 404 da foto do salão sumiu quando as fotos entraram).
- axe: sem violações em restaurante, detalhe, regras, cartela, sheet do GPS, identificação, resultado e Jornada. Achado e corrigido no caminho: animação de entrada do convite na Jornada (opacidade) gerava falso contraste.
- Seed da vitrine (60 dias, ~1.700 clientes, ~2.900 check-ins): ~2,3 s local. Build: maior processo 676 MB, soma 826 MB.
- Testes: 171 unitários, 25 de integração, 35 E2E locais (todos verdes depois das correções).

## 6. Correções aplicadas
| Achados | Commit | Verificação |
|---|---|---|
| 1, 2, 4, 5, 10–14, 25–29 | `a8f0794` | unit + integração + E2E |
| 3 (UI do 409), 6–8, 15–21, 30–35 | `b001d5b` | E2E local 35/35, capturas refeitas |

## 7. Decisões novas registradas
- D114 [C]: telefone já cadastrado só entra com o mesmo nome (prova mínima; em produção, OTP).
- D115 [C]: limites em memória por IP e por restaurante até a S2; restaurante E2E oculto fora dos limites.
- D116 [C]: seed com pool próprio, transações separadas e espera crescente; health sem motivo do erro.
