# Planejamento da fatia S1 — Domínio e fluxo do cliente

Status: ✅ aprovado em 20/11/2026 pelo candidato (após 2 revisores independentes — seção 11).

> **Contexto.** A S0 está no ar (`9cd22c1`): fundação, IA e design system base. A S1 constrói o **coração do produto v2**: as regras puras (faixas, ofertas, cartela, códigos, sorteio com convite fantasma, teto, `decideCheckin`, estatística), o esquema v2, os casos de uso do cliente, o simulador por agente com a vitrine de 60 dias e as **telas do cliente** (QR → página → check-in → identificação → "agora" + código + 2º card → Jornada). A S2 (Portal, ativação, kit, validação) e a S3 (painel e plano da semana) consomem tudo isso. Fontes: especificação v2 §3.3, 3.5, 3.8, 4.2, 4.6, 4.7; plano de implementação (S1); D201–D224; dívidas da revisão da S0.

## 1. Objetivo e entrega testável
Ao fim da S1, em produção:
- `/r/cantina-nonna-lucia` (vitrine) abre a página do restaurante igual ao app (prints 04, 05, 08, 12) e o check-in completo (prints 09, 10, 11, 14). O cliente sai com o "agora", o código "Informe este código ao garçom", o selo 1/6 e, se for convidável com teto livre, o **2º card do convite**.
- A volta dentro da faixa, em outro dia, gera o **código do convite**; fora da faixa, mostra o lembrete. Isso é provado em integração com relógio ajustável; o E2E da volta fica para a S3, com "antecipar convite".
- A Jornada mostra os restaurantes, as visitas, os selos e os convites ativos.
- A vitrine é semeada no boot com 60 dias simulados pelas **mesmas funções puras**. Um teste garante que o IC 95% do incremento fica acima de zero e contém o efeito programado.
- Um restaurante E2E oculto recebe os testes de produção.
- Prova: Vitest (unidade + integração contra Postgres), Playwright local e contra produção (390 px, GPS negado, axe), CI verde, health com o SHA.

## 2. Requisitos e rastreabilidade
| Requisito | Fonte | Como será provado |
|---|---|---|
| Faixa = dias + início/fim, com id, dentro do funcionamento | 3.3, D218 | `slots.test`: faixa fora do horário rejeitada; 23/11 17h10 SP |
| Teto por faixa e semana ISO em SP, reserva atômica | 3.3, D223 | `weekKeySP` na virada dom→seg; integração com 2 check-ins simultâneos e 1 vaga → 1 real |
| Ofertas polimórficas com teto de 50%, item do cardápio e custo = preço × (1 − margem) | 3.3, D26, D223 | `offers.test` por tipo |
| Cartela: 6 selos, 1/dia, 90 dias, recompensa com código | 3.3, D26 | `stamp-card.test` |
| 3 tipos de código: 6 caracteres sem ambíguos, únicos por restaurante, valem o dia, uso único | 3.3, D218 | `codes.test`; integração de colisão |
| Sorteio 90/10 só entre elegíveis, gravado uma vez; fantasma sem consumir teto; 1 ativo | 3.3, D216 | `experiment.test` (1000 clientes → 7–13%); integração `arm` gravado 1 vez |
| Convite congela faixa e validade; código só na volta, na faixa, em outro dia | 3.3, D218 | `decide-checkin.test` |
| `decideCheckin` é a fonte única (produto e simulador) | 3.8, D223 | o simulador importa a mesma função; teste de equivalência |
| Incremento Welch, 4 estados, margem por Δcusto, migração, coortes | 2, D217 | `incremental.test` com valores calculados à mão |
| Simulador recupera o efeito; vitrine com IC > 0 | 3.8, D217, **D104** | `simulator.test` com 7 datas de início |
| Identificação: HMAC + 4 dígitos, campos pré-preenchidos fictícios, `autocomplete="off"`, opt-in ligado, aceite | 3.5, 4.6, D30, D31, **D106** | unidade + E2E |
| Leituras por beacon, dedupe de 30 min, robôs ignorados | 3.4, D49 | `scan-dedupe.test`; integração |
| GPS não bloqueante; só o status vai ao servidor | 3.5, D25 | `geo.test`; E2E com GPS negado |
| Holdout sem 2º card e sem menção a convite | 3.5, D223 | E2E (repetição até cair holdout — **D109**) |
| Nenhuma oferta nem horário antes do check-in | 3.5, D223 | E2E: a página só mostra a linha genérica |
| Dívidas da S0: índice `owner_id`; rolagem do sheet no iOS e `viewport-fit=cover` | revisão S0 | migração `0001`; E2E WebKit (iPhone) |

## 3. Decisões desta fatia
| ID | Decisão | Alternativas | Trade-off | Motivo | Quem |
|---|---|---|---|---|---|
| D104 | Vitrine com **~200 clientes novos identificados/semana** (efeito +0,20/14 d e 25% de migração mantidos); o teto da vitrine não limita o sorteio | 70/semana com semente escolhida; efeito maior (+0,35) | restaurante mais movimentado × IC robusto | Monte Carlo: com 70/semana, IC > 0 em só 49–72% das sementes; com ~200/semana, 89–99% | U |
| D105 | `PHONE_HASH_SECRET` e `SESSION_SECRET` gerados e gravados pela IA no `case-salao-app` pelo conector do Easypanel, sem ecoar o valor no chat | o candidato cola | o valor fica no transcript da sessão × rapidez | escolha do candidato | U |
| D106 | Telefone: **qualquer número no formato `(DD) 9XXXX-XXXX`**, sem checar se é real; pré-preenchido com fictício (DDD 00), "gerar outros", aviso e `autocomplete="off"` mantidos. A ausência de validação é proposital e vai documentada em "Como funciona" e no README | travar DDD 00 no servidor | comportamento de app real × possibilidade de digitar número real (vira só HMAC + 4 dígitos) | escolha do candidato | U |
| D107 | Fotos de **banco livre por categoria** (1 salão + ~5 categorias), hospedadas no site e creditadas em "Como funciona" | só a foto do salão; sem fotos | licença a conferir × fidelidade aos prints 04 e 12 | escolha do candidato | U |
| D108 | Vitrine = **cantina italiana** fictícia; faixas Ter–Qui 15h–18h (muito vazio, sobremesa) e Seg–Qua 21h–23h (um pouco, porção) | bar brasileiro; hamburgueria | — | casa item × turno de forma visível | U |
| D109 | **Restaurante E2E oculto** (`teste`, teto alto, sem simulação) para o E2E em produção; holdout provado criando clientes novos até cair um (sem porta dos fundos no servidor) | E2E na vitrine | ~1 min a mais no E2E de produção e dados de teste acumulados × vitrine intacta e teste determinístico | o teto da vitrine esgotaria e o 2º card sumiria | U |
| D110 | **Sem corte na S1**: fecha com as 11 tarefas, mesmo invadindo a tarde de 21/11 | corte "fluxo primeiro" | aperta S2/S3 × S3 recebe tudo pronto | escolha do candidato | U |
| D111 | Itens [C] desta fatia (seções 11 e 12) | — | — | decisões técnicas sem efeito de produto | IA [C] |
| D112 | Demo: se o cliente cair no holdout, a demo assume e explica ("grupo de controle — é assim que medimos") e usa "Testar como outro cliente"; o cliente continua na demo (fecha o ciclo), o foco segue no dono | atalho que garante convidável; tirar o cliente da demo | ~20 s a mais em 10% das vezes × honestidade estatística mostrada ao vivo | o holdout vira argumento | U |
| D113 | Link "Testar como outro cliente (fictício)" no resultado e na Jornada, já na S1 (troca só o cookie do cliente; a S3 reaproveita a rota) | só na S3 (Bastidores) | ~30 min × avaliador sozinho consegue ver o convite | risco de holdout e o E2E de 2 identidades | U |

## 4. Produto e fluxos

### 4.1 Persona e caminho
O cliente sentado no salão lê o QR (`/r/<slug>?p=<token>`) → página do restaurante → **Check-in** → tela da cartela → "Fazer check-in" → GPS → (sheet se longe/negado) → identificação (só na 1ª vez no aparelho) → resultado → Jornada.

### 4.2 Regras (código, com testes)
- **Turnos [C]:** madrugada 00–06, manhã 06–11, almoço 11–15, tarde 15–18, noite 18–24. Ficam guardados no check-in para os insights da S3.
- **Faixa:** `days` (0 = dom … 6 = sáb), `startMin`/`endMin` (minutos; `endMin` ≤ 1440, `start` < `end`, sem cruzar a meia-noite [C]), intensidade `muito|um_pouco`, mesas a mais desejadas. Precisa caber num bloco do horário de funcionamento em todos os dias dela. Prioridade: `muito` antes de `um_pouco`; empate pela ordem de criação.
- **Ofertas** (tipos reais: `leve2pague1`, `desconto`, `doce_gratis`, `entrada_gratis`, `cortesia`; papel `agora|convite|recompensa`). Categorias do cardápio [C]: `entrada | prato | porcao | sobremesa | bebida`.
  - `doce_gratis` → só `sobremesa`; `entrada_gratis` → `entrada|porcao`; `cortesia` → `bebida|sobremesa`; `leve2pague1` e `desconto` → qualquer item.
  - Desconto: 1–50% (teto de 50%).
  - Custo unitário (centavos): item grátis/cortesia/leve 2 = preço × (1 − margem); desconto = preço × pct (receita perdida) [C]. Sem margem, usa o preço e o rótulo vira "custo máximo".
  - Consumo mínimo opcional; alerta se passar de 2× o preço médio do cardápio.
  - `describe` gera título ("Doce grátis"), subtítulo ("Pra novos clientes" / "No seu convite" / "Na cartela") e nome do item. A IA nunca escreve esses textos.
- **Cartela:** começa no 1º check-in; 1 selo por dia; vence quando o dia em SP passa de `início + 90 dias`; no 6º selo, nasce o código da recompensa e a cartela fecha; o próximo check-in abre uma nova [C].
- **Códigos:** 6 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, únicos por restaurante (nova tentativa em colisão, até 5), válidos até 23:59:59 SP do dia em que nascem, uso único. A entrada é normalizada (maiúsculas, sem espaços nem hífen). `checkCode` → `OK | INVALIDO | JA_USADO | EXPIRADO | OUTRO_RESTAURANTE` (a tela de validação é da S2).
  - 1ª visita: 1 emissão por cliente por restaurante, sem reemissão.
  - Convite: só no check-in de volta **dentro da faixa congelada e num dia diferente da emissão**, com convite real ativo; no máximo 1 código de convite por dia. O convite continua `ativo` até um código dele ser validado (→ `usado`) ou até expirar [C].
  - Recompensa: no 6º selo.
- **Sorteio e convite** (`decideInvite`, nesta ordem): `sem_plano` (sem regra de convite ativa) → `ja_tem_ativo` (convite `ativo` ou `suprimido` não vencido) → `teto_esgotado` (nenhuma faixa com vaga na semana ISO) → grupo: se `arm` é nulo, `assignArm` (hash 32 bits de `customerId:restaurantId` mod 100 < 10 → holdout), gravado uma única vez → `real` (consome vaga) ou `fantasma` (mesma faixa e datas, não consome). A faixa congelada é a de maior prioridade com vaga; a validade termina às 23:59:59 SP de `emissão + 30 dias`.
- **`decideCheckin`** (puro, fonte única para produto e simulador). Entrada: instante, restaurante (funcionamento, faixas, regra vigente, cartela), estado do cliente (já fez check-in hoje, código de 1ª visita emitido, cartela, convite ativo, grupo) e vagas por faixa. Saída: `outcome` + selos + códigos a emitir + convite a emitir + lembrete. Os resultados:
  1. `ja_fez_checkin_hoje`: nada muda.
  2. `primeira_visita`: código da 1ª visita + selo + (2º card se `real`).
  3. `volta_com_convite`: selo + código do convite (vale hoje).
  4. `volta_lembrete`: selo + lembrete ("vale Ter, Qua, Qui · 15h–18h · até dd/mm").
  5. `volta`: selo (com o aviso "Seu benefício de 1ª visita já foi usado" quando for o caso); pode trazer um novo convite se não houver ativo.
  - O 6º selo soma o código da recompensa a qualquer dos resultados.
  - Holdout com fantasma ou teto esgotado: igual ao caso normal, **sem 2º card e sem lembrete**.
  - Check-in fora do horário de funcionamento é aceito (aberto/fechado é só informativo — D28).

### 4.3 Estatística (puro; consumida pela S3)
- Unidade = cliente sorteado; data do sorteio = 1º convite (real ou fantasma). Janela W = os 14 dias **após** o dia do sorteio (o dia do sorteio não conta); só entram janelas fechadas.
- `welch(t, h)` → `{state, nT, nH, diff?, se?, lo?, hi?}`: `amostra_insuficiente` se nT ou nH < 30; `inconclusivo` se se = 0 ou o IC contém 0; senão `positivo|negativo`.
- `marginIncrement` = `diff · nC · ticket · margem% − Δcusto`, com `Δcusto = custoConv − custoHold · nC/nH`; IC linear a partir do IC de `diff`; sem ticket ou margem → `null` (o painel mostra só visitas).
- `migration` = `welch` sobre as visitas fora das faixas vazias.
- `cohorts(invites, now, windowDays)` → por semana ISO de emissão: emitidos, usados, % e `em_aberto` se a janela não fechou.

### 4.4 Simulação (D104, D217)
- **Gerador por agente**, com semente (mulberry32), relógio falso, ordem cronológica e estado em memória. Ele chama `decideCheckin` + `applyDecision` (puro) e devolve as linhas em lote com `simulation_run_id`.
- **Parâmetros da vitrine** (declarados em "Como funciona" na S3): 60 dias; ~200 clientes novos identificados por semana (variação por dia da semana); chegada por turno (almoço 40%, noite 45%, tarde 8%, manhã 5%, madrugada 2%); taxa-base de volta ~0,3 visita/14 d (gama por cliente); **efeito líquido +0,20 visita/14 d** para convidados × holdout = +0,267 na faixa vazia − 0,067 no pico (25% de migração) [C]; opt-in 90%; validação de códigos p = 0,85, com 0,70 no sábado à noite (alimenta o alerta H3 da S3); leituras do QR com conversão leitura → check-in de ~40%, divididas entre 2 peças × 2 versões.
- **Planos:** a regra v1 vale desde a ativação (dia −60). O plano "anterior" foi aprovado no dia −7 (regra v2 + reativação simulada para "1 visita e sumiu" e "perto da recompensa" com opt-in, real/fantasma pela regra). O plano "atual" fica `proposto`, para a demo aprovar. Os JSON dos 2 planos são fixos, com referências (`{fato:…}`, `{prato:…}`, `{horario:…}`, `{oferta}`) resolvidas contra o **snapshot de fatos guardado no próprio plano**.
- **Seed no boot** (depois das migrações): cria a vitrine se não existir ou se a versão do seed mudou (recria a vitrine inteira, inclusive check-ins reais nela [C]); cria o restaurante E2E se não existir. O health responde 503 até o seed terminar [C]. Datas relativas a `now()`; "resetar demo" (S3) recria.
- `clearRun(runId)` apaga exatamente a rodada (cascade por `simulation_run_id`).

### 4.5 Conteúdo da vitrine e do E2E (D108, D109)
- **Cantina Nonna Lúcia** [C nome] (`cantina-nonna-lucia`, culinária Italiana, `$$$`):
  - endereço fictício "Rua das Laranjeiras Fictícias, 120 – Vila Exemplo, São Paulo – SP";
  - aberto todos os dias 11h–23h30;
  - 40 mesas; ~1.400 clientes de salão por semana; ticket R$ 85; margem 65%;
  - ~20 itens fictícios em 5 categorias;
  - "agora" = Doce grátis (Panna cotta); cartela = Tiramisù;
  - convite v1: faixa A Ter–Qui 15h–18h (muito, 55 mesas → teto 220/semana), oferta Doce grátis (Cannoli); faixa B Seg–Qua 21h–23h (um pouco, 35 mesas → teto 140/semana), oferta Entrada grátis (Bruschetta) — números ajustados na revisão (T-I5);
  - plano anterior: manter A, trocar B; plano atual (proposto): B → porção (Fritto misto);
  - 2 peças (display de mesa, cartaz) × 2 versões, com recado do restaurante.
- **Restaurante E2E** (`e2e-salao-teste`, `teste`, oculto): aberto 00h–24h todos os dias, 1 faixa (todos os dias 00h–24h), teto 1.000.000, regra de convite ativa, sem simulação.

## 5. Telas, estados e textos (casca do App, coluna de 420 px; barra de protótipo em todas)
- **Página do restaurante** `/r/[slug]` (prints 04, 05, 08):
  - foto do salão, voltar (para "/"), nome; linha "{distância •} Italiana • $$$" (distância só se a permissão de GPS **já** foi concedida — nunca pede na abertura); "Aberto agora • fecha às 23:30" / "Fechado • abre às 11:00" (informativo).
  - Abas **Benefícios | Sobre**.
  - Benefícios: "Benefícios pra você" com cards ticket roláveis: "agora" (foto da categoria, título, subtítulo, chips "Todos os dias" e "Dia e Noite") e "Junte Selos e Ganhe" ("Pra clientes frequentes"); a linha **"Faça check-in e você pode ganhar um convite para voltar"**; "Sobre o restaurante" (descrição).
  - Sobre: descrição e endereço fictício (sem mapa [C]).
  - Rodapé fixo com **[Check-in]** em largura total (D214).
  - O toque num card abre o **detalhe** (print 12): "Faça o check-in para ativar o benefício e aproveitar", card ticket com foto, título, chips, "Recado do {restaurante}", [Check-in] e "Ver detalhes e regras".
  - Estados: slug inexistente → 404 em português; `p` inválido → a página abre e a leitura não é registrada.
- **Check-in** `/r/[slug]/checkin` (prints 09, 10, 11):
  - fundo escuro com a foto desfocada, logo padrão do iFood + "Comer Fora", botão fechar;
  - "Faça o check-in e junte selos para ganhar!"; card com o nome, a distância, 6 círculos (1–5 + presente) e "Recompensas" (item, "6 selos - {item}", chips "Próxima recompensa" e "Faltam N selos");
  - "Fazer check-in" (botão branco) e "Ver detalhes e regras" (sheet do print 10, com as regras da cartela e as do benefício de 1ª visita).
  - Ao tocar: `Button` em carregando → GPS (8 s). Se não estiver perto, abre o sheet com o texto exato da spec. "Confirmar localização" segue com o status `confirmado_manual`; "Fechar" cancela e volta ao card [C].
- **Identificação** (sheet em tela cheia no celular, só se o aparelho não tem cliente):
  - título "Identifique-se para ativar seus benefícios";
  - `Field` Nome e Telefone `(00) 9XXXX-XXXX`, pré-preenchidos, com "Gerar outros", `autocomplete="off"` e o aviso **"Use só dados fictícios — isto é um protótipo"**;
  - "Comunicações de promoções" com switches WhatsApp · Notificação no app · Push ligados (print 14);
  - checkbox obrigatório "Aceito usar estes dados neste protótipo"; botão "Continuar".
  - Erros: formato inválido ("Use o formato (00) 90000-0000"), aceite ausente.
- **Resultado** (mesma rota, `aria-live`):
  - "Check-in feito!", cartela n/6;
  - card do "agora" com o código grande, **"Informe este código ao garçom"** e "Vale hoje, até 23:59";
  - em seguida, o **2º card**: "Seu convite: volte Ter, Qua, Qui · 15h–18h e ganhe {item} · até dd/mm" (aparece depois, com `motion-safe`);
  - variantes: código do convite ("Seu convite vale hoje"), lembrete, "Você já fez check-in hoje. Volte outro dia para ganhar mais um selo.", "Seu benefício de 1ª visita já foi usado", recompensa 6/6 com código;
  - botões "Ver minha jornada" e "Voltar ao restaurante".
- **Jornada** `/app/jornada` (print 13): "Olá, {primeiro nome}" (ou "Visitante"); contadores Visitas (real), Reservas e Avaliações (0, estáticos); "Seus restaurantes" com visitas, selos n/6 e o convite ativo (chips com dias e horário + "até dd/mm"); vazio "Ao fazer check-in, suas visitas serão registradas aqui".
- **"/"** ganha o botão secundário "Sou cliente: ver restaurante" → vitrine (a entrada completa fica para a S3).
- **Componentes novos:** `TicketCard` (recorte lateral), `StampCard`, `CodeDisplay` (`aria-label` letra a letra), `InviteCard`, `Field` (rótulo + erro; antecipado da S2), `Switch`.
- **Acessibilidade:** alvos ≥ 44 px, foco visível, rótulos completos dos dias (`aria-label` "terça, quarta e quinta"), contraste AA, axe sem violações, foco no título do resultado.
- **Fotos (D107):** `public/fotos/` com salão + entrada, prato, porção, sobremesa, bebida (licença Unsplash/Pexels conferida, autor anotado em `public/fotos/CREDITOS.md`), `next/image` sem otimização remota.

## 6. Técnica

### 6.1 Arquivos (padrão: domínio puro → aplicação → rotas/telas)
- `src/shared/`: `hash32.ts` (hash determinístico puro), `rng.ts` (mulberry32), `hmac.ts` (HMAC-SHA256 do telefone), `session.ts` (cookie assinado `cf_cliente` + `cf_aparelho`), `secrets.ts` (lê do ambiente; em produção falha se faltar; em dev/teste usa um valor fixo de desenvolvimento), `week.ts` (`weekKeySP` ISO em SP).
- `src/modules/beneficios/domain/`: `slots.ts`, `offers.ts` (+ `offerRegistry`), `stamp-card.ts`, `codes.ts`, `menu.ts` (categorias, preço médio).
- `src/modules/salao/domain/`: `experiment.ts` (`assignArm`, `decideInvite`), `decide-checkin.ts` (`decideCheckin`, `applyDecision`), `geo.ts` (haversine, `gpsStatus`), `scan-dedupe.ts`, `fictitious-identity.ts`, `phone.ts` (formato).
- `src/modules/salao/application/`: `identify-customer.ts`, `register-scan.ts`, `do-checkin.ts`, `get-restaurant-page.ts`, `get-journey.ts`; `repo.ts` (Drizzle, isolamento por restaurante).
- `src/modules/analytics/domain/`: `incremental.ts` (`welch`, `marginIncrement`, `migration`), `samples.ts` (janelas), `cohorts.ts`.
- `src/modules/simulacao/domain/generator.ts`; `src/modules/simulacao/application/{simulate.ts,clear.ts}`; `src/db/seed/{vitrine.ts,e2e.ts,index.ts}` (+ `ensureSeeded` no `instrumentation.ts` e no health).
- `src/modules/planos/domain/plan-content.ts` (Zod do JSON do plano v1: fatos, candidatas, escolhas, textos, aprendemos).
- Rotas: `app/r/[slug]/page.tsx`, `app/r/[slug]/checkin/page.tsx`, `app/app/jornada/page.tsx`, `app/api/r/[slug]/leitura/route.ts` (beacon), `.../identificacao/route.ts`, `.../checkin/route.ts`. Todas com Zod; o restaurante vem do slug; o cliente vem do cookie.
- UI: `src/ui/components/{TicketCard,StampCard,CodeDisplay,InviteCard,Field,Switch}.tsx`; `app/layout.tsx` com `viewport-fit=cover` + `env(safe-area-inset-*)`.

### 6.2 Interfaces produzidas (consumidas por S2/S3)
```ts
type Slot = { id: string; days: number[]; startMin: number; endMin: number; intensity: "muito" | "um_pouco"; extraTables: number };
isInSlot(slot: Slot, at: Date): boolean; turnOf(at: Date): Turn; weekKeySP(at: Date): string; // "2026-W48"
validateSlot(slot: Slot, opening: OpeningHours): SlotError[];
interface OfferStrategy<P> { kind: OfferKind; schema: ZodType<P>; validate(p: P, menu: MenuItem[], role: Role): OfferError[]; describe(p: P, menu: MenuItem[], role: Role): OfferText; unitCostCents(p: P, menu: MenuItem[], marginPct?: number): { cents: number; isMax: boolean } }
offerRegistry: Record<OfferKind, OfferStrategy<unknown>>;
applyCheckin(card: StampCardState | null, at: Date, cfg: { required: 6; validityDays: 90 }): { card; stamped: boolean; completed: boolean; renewed: boolean };
generateCode(rng: () => number): string; normalizeCode(s: string): string;
checkCode(found: CodeRow | null, ctx: { restaurantId: string; now: Date }): "OK" | "INVALIDO" | "JA_USADO" | "EXPIRADO" | "OUTRO_RESTAURANTE";
assignArm(customerId: string, restaurantId: string): "convidavel" | "holdout";
decideInvite(s: InviteState, at: Date): { kind: "real" | "fantasma"; slotId: string; expiresAt: Date; arm; armIsNew: boolean } | { kind: "teto_esgotado" | "ja_tem_ativo" | "sem_plano" };
decideCheckin(input: CheckinInput): CheckinDecision; applyDecision(state, decision): state;
welch(t: number[], h: number[]): Incremental; marginIncrement(...); migration(...); cohorts(...);
simulate(p: { seed: number; days: number; weeklyNew: number; effect: number; migrationShare: number; now: Date; restaurant: SimRestaurant }): SimRows;
identifyCustomer(...); registerScan(...); doCheckin({ slug, customerId, gpsStatus, variantToken?, idempotencyKey, clock }): CheckinResult;
```

### 6.3 Dados — migração `0001` (só aditiva, D103)
- `restaurants` + `ticket_cents`, `margin_pct`, `description`, `address`, `hero_image`, `recado` (anuláveis) + **índice em `owner_id`**. `idle_hours` deixa de ser usada.
- Tabelas novas:
  - `idle_slots` (dias `smallint[]`, `start_min`, `end_min`, intensidade, mesas, ativo);
  - `menus`, `menu_items` (categoria, nome, `price_cents`, posição);
  - `benefits` (papel, `slot_id`) e `benefit_versions` (tipo, `params` jsonb validado pela estratégia, versão, `weekly_cap` para convite, `plan_id`, `valid_from`, `superseded_at`);
  - `stamp_card_configs`, `stamp_cards` (estado da cartela por cliente [C], no lugar de `stamps`; os eventos são os check-ins);
  - `customers`, `customer_contacts` (`phone_hmac` único, `phone_last4`, nome) e `restaurant_customers` (PK composta, 1º check-in, flag do código de 1ª visita, opt-ins, `arm` com check, `arm_assigned_at`, variante de origem);
  - `kit_pieces` e `piece_variants` (mínimas: tipo, rótulo A/B, `qr_token` único, textos jsonb; a S2 acrescenta colunas);
  - `scans` (variante, `device_hash`, `day_sp`);
  - `checkins` (dia e turno em SP, GPS, versão do benefício, variante, `idempotency_key` único, `result` jsonb, **único (restaurante, cliente, `day_sp`)**);
  - `codes` (tipo, código, item, convite, `valid_day`, status `emitido|validado`, **único (restaurante, código)**);
  - `invites` (regra, `slot_id`, `slot_snapshot` jsonb congelado, `arm`, status `ativo|usado|expirado|suprimido`, emissão, `issued_day`, `expires_at`, origem `mesa|reativacao`, `plan_send_id`; **índice único parcial (restaurante, cliente) WHERE status IN ('ativo','suprimido')**);
  - `invite_quota` (PK restaurante + faixa + semana, `cap`, `used`, check `used ≤ cap`);
  - `weekly_plans` (semana, status, versão, `facts`, `candidates`, `choices`, `texts`, `learned`, `decision`, `approved_via`);
  - `plan_sends` + `plan_send_members`;
  - `simulation_runs` (restaurante, semente, parâmetros, versão, tipo).
- `simulation_run_id` em todas as tabelas de eventos, clientes da simulação e planos, com FK `ON DELETE CASCADE`.
- Datas em UTC + `day_sp`; índices por (restaurante, data).

### 6.4 Check-in em transação (`doCheckin`)
1. Idempotência: se a `idempotency_key` já existe, devolve o `result` guardado.
2. `INSERT restaurant_customers ON CONFLICT DO NOTHING` + `SELECT … FOR UPDATE` (serializa o mesmo cliente).
3. Expira convites vencidos do cliente (`UPDATE … SET status='expirado' WHERE expires_at < now`).
4. Carrega o estado → `decideCheckin`.
5. Convite real: `INSERT invite_quota … ON CONFLICT DO NOTHING` e `UPDATE … SET used = used + 1 WHERE used < cap RETURNING`. Sem linha → recalcula como `teto_esgotado`. Grupo: `UPDATE … SET arm = $1 WHERE arm IS NULL`.
6. Insere o check-in (conflito no dia → `ja_fez_checkin_hoje`), os códigos (nova tentativa em colisão), o convite e a cartela. Guarda o `result`.

O teste de integração dispara 2 check-ins simultâneos com 1 vaga e espera 1 real e 1 sem convite.

### 6.5 Segurança e privacidade
- Telefone: só HMAC-SHA256 (`PHONE_HASH_SECRET`) + 4 últimos dígitos; nome fictício em `customer_contacts` (apagar = 1 linha); nada de PII em log nem em rastro.
- Cookie do cliente assinado com HMAC (`SESSION_SECRET`): httpOnly, Secure em produção, SameSite=Lax, 180 dias, separado do cookie do dono (S2).
- Coordenada do cliente nunca sai do navegador: só o status (`perto|longe|negado|sem_suporte|tempo_esgotado|confirmado_manual`).
- Zod em todas as rotas; nenhum HTML cru; `noindex` já global.
- **Limites de uso das rotas públicas ficam na S2 (2.2) [C]**. Até lá, protegem: 1 check-in/dia por cliente, idempotência e o teto de convites.
- D106: telefone sem checagem de "real", documentado.

### 6.6 Operação
- D105: gerar e gravar os 2 segredos no `case-salao-app` antes do merge (sem ecoar).
- Remedir a memória do build (webpack) antes do merge (notas-infra).
- E2E de produção ganha `cliente.spec.ts` contra o restaurante E2E e a vitrine (só leitura).

## 7. Testes
- **Unitários:**
  - `slots`, `week`: virada de semana ISO de domingo 23:59 → segunda 00:00 SP; 23/11/2026 17h10 SP = segunda, turno tarde, fora da faixa A, `weekKeySP` = "2026-W48".
  - `offers`: desconto 51% → erro; `doce_gratis` com prato → erro; custo com margem 65% de R$ 18,00 = 630 centavos; sem margem = 1.800 + `isMax`.
  - `stamp-card`: 2 check-ins no mesmo dia → 1 selo; 6º selo → completa; dia 91 → renova.
  - `codes`: alfabeto, 10.000 códigos sem caractere ambíguo, normalização, os 5 resultados de `checkCode`.
  - `experiment`: 1.000 clientes → 7–13% holdout, estável entre execuções; fantasma não consome; 1 ativo.
  - `decide-checkin`: os 5 resultados, mais recompensa, holdout e teto esgotado; volta na faixa no mesmo dia → sem código; dia seguinte na faixa → código do convite; validade 30 d até 23:59:59 SP.
  - `incremental`: amostras pequenas com diff, se e IC calculados à mão; n = 29 → insuficiente; IC contendo 0 → inconclusivo; Δcusto cancela o "agora".
  - `geo`: 300 m → perto; 301 m → longe.
  - `scan-dedupe`: 29 min = 1; 31 min = 2; robôs (WhatsApp, facebookexternalhit, Slackbot, TelegramBot, Twitterbot, LinkedInBot, Discordbot, Googlebot, bingbot) ignorados.
  - `simulator`: mesma semente → mesmas linhas; equivalência com `decideCheckin`; **IC da vitrine > 0 e contém 0,20 em 7 datas de início consecutivas**; migração negativa no pico.
- **Integração (Postgres):** check-in completo; idempotência (mesma chave → mesmo resultado); corrida do teto (2 simultâneos, 1 vaga); `arm` gravado uma vez sob corrida; índice parcial barra o 2º convite ativo; colisão de código; seed idempotente e versão nova recriando a vitrine; `clearRun` remove só a rodada; HMAC nunca guarda o telefone puro.
- **E2E (Playwright, 390 px, GPS negado, axe), local e produção:**
  1. Vitrine abre com abas, linha genérica do convite, sem oferta nem horário visível, barra e `noindex`.
  2. Restaurante E2E: check-in → sheet do GPS → "Confirmar localização" → identificação pré-preenchida → resultado com código, selo 1/6 e 2º card (ou repete com cliente novo se cair holdout).
  3. Mesmo aparelho de novo → "Você já fez check-in hoje".
  4. Holdout: clientes novos até um resultado sem 2º card (máx. 60 tentativas); a Jornada dele não mostra convite.
  5. Jornada com o convite ativo.
  6. WebKit/iPhone: sheet sem rolagem do fundo; `safe-area`.
  7. Leitura por beacon registrada uma vez com `?p=`.

## 8. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| S1 grande (D110, sem corte) | Ordem da seção 11 (P-I6): fluxo integral primeiro, simulador e estatística da S3 depois; commits pequenos; telas reaproveitam a base da S0 |
| Seed lento ou falhando no boot da VPS | Inserts em lote de 1.000; health em 503 até o seed terminar; teste de tempo local (< 10 s) |
| IC da vitrine depende da data de início | Teste em 7 datas; se falhar, sobe `weeklyNew` (registrado) |
| JSON dos planos fixos divergir do que a S3 gera | Zod `plan-content` v1 na S1; a S3 versiona; fatos como snapshot no plano |
| Corrida no teto, no grupo e no 1-ativo | `FOR UPDATE` + `UPDATE … WHERE` + índice parcial + testes de integração |
| Rotas públicas sem limite até a S2 | 1/dia por cliente, idempotência, teto; limites na S2 |
| Telefone real digitado (D106) | Só HMAC + 4 dígitos; aviso; documentado como proposital |
| Licença das fotos | Só Unsplash/Pexels, crédito registrado; sem pessoas identificáveis |
| Memória do build cresce | Remedir antes do merge |

## 9. Fora de escopo desta fatia
Portal, login do dono, ativação e kit (S2); tela "Validar código" (S2); limites de uso (S2); painel, insights, plano da semana na tela, "resetar demo", "novo cliente fictício", "antecipar convite" e "Como funciona" (S3); Avaliar; reservas.

## 10. Perguntas respondidas pelo candidato
1. Vitrine × IC → ~200 novos/semana (D104).
2. Segredos → a IA grava pelo conector (D105).
3. Telefone → qualquer número no formato, sem validação, documentado (D106).
4. Fotos → banco livre por categoria (D107).
5. Vitrine → cantina italiana (D108).
6. E2E em produção → restaurante E2E oculto (D109).
7. Corte → sem corte (D110).

8. Demo: se o cliente cair no holdout, a demo assume ("caiu no grupo de controle — é assim que medimos") e usa "Testar como outro cliente" (D112).
9. Link "Testar como outro cliente (fictício)" antecipado para a S1 (D113).

## 11. Revisão independente do plano (2 revisores, 20/11) — **prevalece sobre as seções acima onde divergir**
Conferi cada achado no código, na spec e nos prints antes de aceitar (ex.: drizzle-kit 0.31.11 grava o `where` do índice parcial sem parâmetros; `ci.yml` do job e2e só define `DATABASE_URL`; `health.ts` com ping de 2 s; `client.ts` com `statement_timeout` 15 s; Playwright só chromium).

### Técnico
| # | Sev. | Achado | Destino |
|---|---|---|---|
| T-B1 | bloq. | Idempotência conferida antes do lock: clique duplo devolve "já fez check-in" sem o código | **[C] aceito:** a chave é conferida de novo depois do `FOR UPDATE`, amarrada a (chave, cliente, restaurante); teste de integração com 2 chamadas simultâneas e a mesma chave → resultados idênticos |
| T-B2 | bloq. | "IC > 0 em 7 datas" ≈ 50% de chance; o efeito "enquanto há convite ativo" não garante +0,20 | **[C] aceito:** o simulador roda por dias inteiros de SP (hoje−60 … ontem), com RNG por `(semente, dia)` → o resultado depende só do dia da semana. O efeito é calibrado como diferença ITT esperada em W, com contrafactual (mesmos números aleatórios com e sem tratamento); o teste confere o IC contra o efeito **realizado** e IC > 0 nas 7 datas; a semente escolhida fica registrada |
| T-I1 | imp. | E2E do CI roda como produção sem os segredos | **[C]:** segredos fictícios no `ci.yml`; leitura preguiçosa (na requisição), nunca no import |
| T-I2 | imp. | `register()` bloqueia o servidor; health de 2 s mostraria `db:down`; seed com falha deixaria 503 para sempre | **[C]:** seed sem `await` no `register`; health ganha `seed: rodando|ok|falhou` (503 só em `rodando` nos primeiros 60 s; `falhou` → 503 com motivo); `pg_advisory_xact_lock`; teste de integração com o seed real |
| T-I3 | imp. | Cascata sem índice em FK + `statement_timeout` 15 s na recriação | **[C]:** índice em toda FK (`customer_id`, `simulation_run_id`, `restaurant_id`); `SET LOCAL statement_timeout = '120s'` na transação do seed; medir |
| T-I4 | imp. | `invite_quota.used` não acompanha `clearRun`; colisão real × simulado | **[C]:** `used` recalculado por `count(*)` dos convites reais da (restaurante, faixa, semana) sob lock da linha de quota, em `issueInvite` e em `clearRun` |
| T-I5 / P-I1 | imp. | Teto da vitrine (200/sem) pode esgotar e esconder o 2º card | **[C]:** faixa A 55 mesas → teto 220/sem; faixa B 35 → 140/sem; teste do seed: na semana corrente sobra ≥ 40% de teto em qualquer dia; incluir o teto no Monte Carlo |
| T-I6 | imp. | Regras de persistência duplicadas entre `applyDecision` (memória) e `doCheckin` (SQL) | **[C]:** `issueInvite(tx, …)`, `expireInvites(tx, …, clock)` e `issueCode(tx, …)` reutilizáveis (reativação e "antecipar" na S3); teste diferencial: uma rodada pequena do simulador passada por `doCheckin` gera as mesmas decisões |
| T-I7 | imp. | Contratos incompletos | **[C]:** `OpeningHours = Array<{days:number[]; startMin; endMin}>` tipado e validado por Zod; amostra da estatística `{customerId, arm, drawDay, visitsW, visitsIdleW, visitsPeakW, costCentsW}` (custo = códigos de convite **validados** em W); dono demo da vitrine com id fixo, preservado na recriação; `lookupCode` busca no restaurante da sessão primeiro (precedência `JA_USADO` > `EXPIRADO`); nova versão da regra atualiza `cap` da semana corrente |
| T-I8 | imp. | "Limpeza de carona" de testes > 7 dias apagaria o restaurante E2E | **[C]:** coluna aditiva `protected boolean default false` (E2E e vitrine), excluída de qualquer limpeza |
| T-I9 | imp. | WebKit no Linux não prova o iOS; `BottomSheet` sem safe-area; cookie `Secure` em http local | **[C]:** prova o que é testável (meta `viewport-fit=cover`, `env(safe-area-inset-bottom)` no sheet e no rodapé, `overscroll-behavior`/bloqueio de rolagem por CSS); `Secure` pelo protocolo; conferência num iPhone real é bem-vinda, mas não bloqueia (vira item da revisão) |
| T-I10 | imp. | drizzle-kit grava `where` parametrizado como `$1` | **[C]:** predicado literal `` sql`status in ('ativo','suprimido')` `` e revisão do `0001.sql` gerado |
| T-m | menor | reserva falha → tentar a próxima faixa; teste da corrida com 2 convidáveis; `generateCode` com `crypto.randomInt` (mulberry32 só na simulação); `weekKeySP` na virada 2026-W53; `cf_aparelho` nasce na rota do beacon/ação; `session.ts` com `server-only` fora do alcance do domínio; leituras filtram `expires_at > now`; turno "noite" (fixo); spec §3.8 e tarefa 1.10 atualizadas para D104; `cliente.spec.ts` no job `deploy`; laço do holdout cria clientes pela API e renderiza só o último; specs que dividem aparelho em serial; beacon conferido só local | **[C] aceitos** |
| T-ordem | — | Ordem para proteger a entrega | **[C] aceito** (ver abaixo) |

### Produto
| # | Sev. | Achado | Destino |
|---|---|---|---|
| P-B1 | bloq. | Código some ao recarregar e não há reemissão | **[C]:** "já fez check-in hoje" mostra de novo os códigos do dia ainda não validados e o 2º card; Jornada ganha "Códigos de hoje"; E2E: check-in → recarregar → código visível |
| P-I1 | imp. | Holdout/teto na vitrine para o avaliador; falta E2E de 2 identidades | teto: ver T-I5; E2E de 2 identidades no mesmo dia incluído; link "Testar como outro cliente" → **candidato: D113** |
| P-I2 | imp. | Erros de rede/sessão | **[C]:** "Não conseguimos fazer seu check-in. [Tentar de novo]" com a mesma chave; cookie de cliente inexistente → identificação (nunca 500); cookie bloqueado → aviso "Ative os cookies para fazer check-in"; E2E com rede cortada |
| P-I3 | imp. | Textos do 2º card e variantes | **[C]:** "Seu convite: volte {dias} · {horário} e ganhe {describe}" (ex.: "um Cannoli grátis", "20% de desconto em Fritto misto") + "Quando voltar, faça check-in nesse horário para receber o código." + "até dd/mm"; "Vale só hoje"; "O benefício de 1ª visita vale só no primeiro check-in" |
| P-I4 | imp. | Nome em claro pode aparecer no Portal público (S3) | **[C]:** rótulos "Nome (fictício)" / "Telefone (fictício)"; legenda "Nada é enviado neste protótipo" nos interruptores; **nota para a S3**: na vitrine, a lista de Clientes mostra primeiro nome + inicial; risco residual registrado junto da D106 |
| P-I5 | imp. | GPS na demo | **[C]:** `timeout` da API (8 s, sem contar o prompt), `enableHighAccuracy: false`, `maximumAge` 10 min; distância escondida acima de 5 km; texto completo do print 11; "Verificando sua localização…" anunciado; checklist da demo: permissão de GPS negada |
| P-I6 / T-ordem | imp. | Fluxo integral (prioridade 1) estava por último | **[C] ordem nova:** 1) domínio do check-in (TDD) → 2) esquema + `doCheckin` + testes de corrida → 3) seed mínimo (vitrine e E2E sem histórico) → 4) telas + E2E local → 5) simulador + 60 dias + calibração → 6) estatística da S3 e Zod do plano → 7) E2E de produção e merge |
| P-I7 | imp. | Vazamentos do holdout | **[C]:** a resposta da API é montada por lista de campos permitidos; teste: a resposta do holdout não contém "holdout", "fantasma", "suprimido" nem "convite" (além da linha genérica); E2E confere a ausência de Cannoli, Bruschetta, "15h–18h", "21h–23h" antes do check-in; recado e descrição da vitrine cobertos pelo mesmo teste |
| P-M1 | menor | Fidelidade aos prints | **[C]:** "Loja fechada • Abre {dia abreviado} às HH:MM" (print 04) e "Aberto agora • Fecha às 23:30" [C]; aba Sobre = "Localização" + endereço (sem mapa) e descrição só em Benefícios; chips no card da cartela; textos do sheet de regras do print 10 + regras do benefício de 1ª visita; "Explorar restaurantes ›" na Jornada → vitrine; o item do "agora" aparece no subtítulo do card e no recado |
| P-M2 | menor | Acessibilidade | **[C]:** véu escuro na foto desfocada (AA), anel de foco claro no fundo escuro, `scrollIntoView` do botão com o teclado do iOS, `role="switch"`, o 2º card dentro do `aria-live` |
| P-M3 | menor | [C] que seriam do candidato | custo do desconto = receita perdida, parâmetros finos do simulador, recriar vitrine e nome "Cantina Nonna Lúcia" **ficam [C] e destacados no relatório final** (corrigíveis); nenhum muda o fluxo |
| P-M4 | menor | `?p=` não acompanha o fluxo | **[C]:** token da peça em cookie `cf_peca` (2 h) gravado no beacon; o check-in usa a variante |
| P-M5 | menor | Faixa B 21–23 × "porção no happy hour" | mantido (D108, escolha do candidato); o exemplo do plano casa porção com a noite |
| P-M6 | menor | Subtítulo do print 14 | **[C]:** "Mantenha ativado para receber ofertas e benefícios exclusivos do Comer Fora" |

## 12. Ao aprovar (fora do modo de planejamento)
1. Copiar este documento para `docs/fatias/S1/planejamento.md` (status: aprovado).
2. Registrar D104–D113 em `decisoes-e-tradeoffs.md`, atualizar a spec §3.8 e a tarefa 1.10 do plano (D104: ~200/semana), e acrescentar ao log `log-conversa-ia.md`.
3. Commit e push na `main` (documentos vão na hora) e no branch da sessão.
4. D105: gerar e gravar `PHONE_HASH_SECRET` e `SESSION_SECRET` no `case-salao-app` sem ecoar os valores.
5. `implementar-fatia S1` em modo autônomo (D101) até o E2E em produção e o relatório final.

## 13. Itens [C] (D111)
Tabela de turnos; categorias do cardápio; custo do desconto = receita perdida; cartela nova depois da 6ª; convite ativo até validar ou vencer; 1 código de convite por dia; hash 32 bits para o grupo; janela = 14 dias após o dia do sorteio; parâmetros finos do simulador (perfis de turno, taxa-base, p de validação); recriar a vitrine quando a versão do seed muda; health em 503 até o seed; nome "Cantina Nonna Lúcia" e cardápio fictício; "Fechar" no sheet do GPS cancela; sem mapa na aba Sobre; `stamp_cards` no lugar de `stamps`; limites na S2; `Field` antecipado; "/" com o botão do cliente; tabelas mínimas de kit na S1.

## 14. Mudanças durante a implementação (D111, [C])
Decididas pela IA durante a implementação (D101), pela especificação e pelas decisões vigentes:
1. **Tetos da vitrine** medidos no simulador: com os convites de volta (novo convite depois de usar ou vencer), a demanda real chega a ~240 convites/semana e enchia a faixa A (220). Ficou **A = 85 mesas → 340/semana** e **B = 40 mesas → 160/semana**, com teste de folga ≥ 40% na semana em curso em qualquer dia de início.
2. **Fotos (D107)** do **Wikimedia Commons** (CC0 e CC BY), não do Unsplash/Pexels: a busca do Unsplash não tem API pública sem chave (a chamada interna foi bloqueada) e o Commons tem API pública com a licença em cada arquivo. 5 categorias com foto; **bebida sem foto livre adequada** → bloco ilustrado. Créditos em `public/fotos/CREDITOS.md`, com link na aba Sobre até a página "Como funciona" (S3).
3. **Cartela** guardada em colunas de `restaurant_customers` (`card_*`) em vez de uma tabela `stamp_cards`; **sem `stamp_card_configs`** (6 selos e 90 dias são constantes; a recompensa é o benefício de papel `recompensa`).
4. **Token da peça** (`?p=`) passa pela URL até o check-in, em vez do cookie `cf_peca` (cookie em resposta de beacon não é garantido em todos os navegadores). `cf_aparelho` nasce no `proxy.ts` (Next 16) para `/r/*` e `/app/*`.
5. **Chegadas na simulação** restritas ao horário da vitrine (11h–23h30): almoço 45%, tarde 8%, noite 47%.
6. **Planos fixos:** plano anterior troca B (Bruschetta → Arancini, veredito "trocar"); plano atual (proposto) mantém A e propõe B → Fritto misto (veredito "trocar" para Arancini). Fatos dos planos = snapshot calculado da própria simulação.
7. **Semente da vitrine = 20261123**; o IC > 0 e contém +0,20 nas 7 datas de início. A proteção contra migração é conferida pela **média** das 7 datas (−0,067 é pequeno demais para o IC de uma data isolada).
8. **Health** ganha `seed: rodando|ok|falhou` (503 até o seed terminar; nova tentativa a cada consulta se falhou).
9. Restaurante E2E com 1 faixa o dia todo (00h–24h) e teto 1.000.000; texto do convite "Todos os dias · 0h–24h" só aparece nele.
10. Texto do 2º card: "Volte {dias} · {horário} e ganhe {oferta}" (com "e aproveite:" para "Leve 2, pague 1"), "Válido até dd/mm" e "Quando voltar, faça check-in nesse horário para receber o código."
