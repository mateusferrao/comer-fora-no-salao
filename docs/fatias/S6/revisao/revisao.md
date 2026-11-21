# Revisão das fatias S4–S6 — produto real, valor ao dono, IA que opera e sistema configurável

Data: 21/11/2026 · Base: `c867a5e` (main depois da S3) · Revisado: `30fad83` (antes do registro) · Produção: ver §4

## 1. Resumo e veredito
Revisão única de S4, S5 e S6 (merge único — D167): 4 revisores independentes (aderência, técnica, produto/UX, segurança/IA) e E2E profunda feita por mim no navegador (390/768/1280 px, 4 personas, axe, console e rede).

- 1 achado crítico (de processo: recursos atrás de flags desligadas prometidos no roteiro) e 6 altos. Todos tratados: 5 corrigidos no código, 1 tratado no deploy (flags ligadas em produção depois da E2E) e no roteiro (passa a ler as flags).
- **Pronta para merge**: unidade 397 ✓, integração 150 ✓, E2E 88 ✓ (2 pulados de propósito), `tsc` e fronteiras limpos, lint só com os 6 avisos antigos, build ✓.

## 2. Achados consolidados
| # | Gravidade | Frente | Achado | Evidência | Correção | Decisão |
|---|---|---|---|---|---|---|
| 1 | crítico | aderência | Roteiro e "Como funciona" prometem recursos que nascem desligados (`/parceiro/aprovar`, `/garcom` dão 404) | `flags.ts`, `Roteiro.tsx` | Roteiro lê as flags; passo 5 começa por "gere o plano"; flags da S5/S6 ligadas em produção depois da E2E | corrigir agora |
| 2 | alto | segurança | "Ver como cliente reativado" podia pôr o dono na sessão de um cliente **real** | `evaluator-tools.ts:38`; no banco, 185 reativações fora da cópia | Só cliente simulado da cópia do exemplo + teste | corrigir agora |
| 3 | alto | técnica | Aprovação na quarta pulava a semana seguinte do plano automático | `tick.ts` (6 dias a partir de agora) | Âncora em T (D227) + 2 testes | corrigir agora |
| 4 | alto | técnica | 90 s de `gerando` < pior caso da cadeia; geração vencida sobrescrevia/perdia | `generating.ts`, `generate-plan.ts` | 150 s + publicar só se ainda `gerando` (D228) | corrigir agora |
| 5 | alto | produto | Central de preferências mostrava o estado antigo ao reabrir e depois de "Parar todos" | `NotificationPrefs`, `Unsubscribe.tsx` | `router.refresh()` + estado derivado da prop | corrigir agora |
| 6 | alto | produto | Passos do agente com apelidos internos ("faixa A", "(A1)") | `plan-agent.ts:108` | Nome da faixa e da oferta | corrigir agora |
| 7 | alto | aderência | Nome de restaurante livre vai em e-mails do nosso domínio ("iFood Suporte") | `customer-login.ts:40` | Recusa "iFood" no nome (D230); e-mail diz "Comer Fora no Salão" | corrigir agora |
| 8 | alto | aderência | Roteiro da demo desatualizado; agente "empata nas regras" | espec. §5, relatório T3 | S7 (apresentação) | corrigir depois (S7) |
| 9 | alto | aderência | E-mail real do cliente sem prazo (letra de "dados de ninguém") | D154/D171/D193 | Riscos aceitos pelo candidato; slide "Riscos" na S7 | não corrigir (decisão do candidato) |
| 10 | médio | técnica | Busca de lembretes `limit 500` sem ordem nem janela | `reminders.ts:115` | Últimos 9 dias, ordenada (D228) | corrigir agora |
| 11 | médio | técnica | Tique sequencial: gerações atrasam lembretes e resumos | `tick.ts:79` | Lembretes antes, 2 gerações por tique | corrigir agora |
| 12 | médio | técnica | SIGTERM esperava o tique inteiro (> 5 s) | `scheduler.ts`, `instrumentation.ts` | Teto de 2 s, parada entre restaurantes | corrigir agora |
| 13 | médio | segurança | Custo do agente sumia quando a tentativa falhava | `openrouter-gateway.ts:116` | Custo por passo (`onStepEnd`) vai no erro e em `attempts` | corrigir agora |
| 14 | médio | segurança | Login do cliente com a flag de emergência sem limite | `api/r/[slug]/entrar` | Limite por IP | corrigir agora |
| 15 | médio | segurança | Rollback por revert quebra o check-in depois da 0006 | `0006…sql:58` | Migrações só de ida, registrado (D231) | não corrigir (declarado) |
| 16 | médio | produto | Dica do plano automático com a hora do resumo; textos com flag desligada incoerentes | `NotifySettingsTab.tsx:95` | Hora − 30 min; resumo também desligado sem agendador; dica com a prévia | corrigir agora |
| 17 | médio | produto | Faltava "convites só no app desde dd/mm" | §4.1 do plano | Em Avisos e na Visão geral, com teste | corrigir agora |
| 18 | médio | produto | Configurações com 2 formas de salvar | `ConfigManager.tsx` | — | corrigir depois (D231) |
| 19 | médio | produto | QR do garçom aparece 1 vez e não imprime | `WaiterLinkCard.tsx:47` | "Imprimir QR para a equipe" e "Enviar pelo WhatsApp" | corrigir agora |
| 20 | médio | produto | "Passou nas regras" aparecia no modo sem IA; regras D226 e "evitar" sem rótulo | `ExplainOffer.tsx:111`, `labels.ts` | Só no modo IA; rótulos novos | corrigir agora |
| 21 | médio | E2E | Configurações › Cardápio com 203 px de rolagem horizontal a 390 px | captura `09-config-cardapio-390.png` | `sr-only` vazava do contêiner rolável: `relative` em todos os `overflow-x-auto` | corrigir agora |
| 22 | baixo | segurança | Link de preferências também LIGAVA (consentimento por terceiro) | `preferences.ts:39` | Só desliga (D229) | corrigir agora |
| 23 | baixo | segurança | Homóglifos de largura total passavam na limpeza | `ai-profile.ts:17` | NFKC na checagem; `scrub` com largura total | corrigir agora |
| 24 | baixo | segurança | Varredura de SQL não via chamadas em várias linhas nem `.execute(var)` | `no-raw-sql.test.ts` | Varre o arquivo inteiro; prova com arquivo-isca | corrigir agora |
| 25 | baixo | seg./técnica | Cookie do garçom não renovava; balde de limite dividido com o resumo; agenda e "apagar" sem limite | `waiter-session.ts`, `guards.ts` | Renova a cada uso; baldes próprios | corrigir agora |
| 26 | baixo | segurança | `opt_email` nasce `true` | `schema/salao.ts:285` | — | não corrigir (D231) |
| 27 | baixo | técnica | Página de aprovação dizia "pediu ajustes" com o revisor ainda revisando; aviso D174 no plano errado | `digest.ts:225`, rota | Estado `revisando`; aviso no plano do token | corrigir agora |
| 28 | baixo | técnica | Índice `digest_tokens(plan_id)`; contagens infladas no `TickResult` | `schema`, `tick.ts` | Contagem de planos corrigida; índice não | corrigir em parte (D231) |
| 29 | baixo | produto | Aprovação sem a semana; "Ajustar no Portal" depois de aprovado; e-mail "Semana de…" ambíguo; lembrete com 2 dois-pontos; "grupo de controle" no porta-conta; "Fatos" sem dizer que é sugestão; contador no "O que evitar"; "Parar todos" vermelho | várias | Todos ajustados (lembrete: "{R} · hoje vale seu convite", sem "na {R}" por causa do gênero) | corrigir agora |
| 30 | baixo | produto | Cardápio manual começa vazio | `Step3Revisao.tsx` | — | não corrigir (D231) |
| 31 | baixo | E2E | "Agente (MCP)" em h3 logo após o h1 (axe `heading-order`) | `AgentSection.tsx:25` | h2 | corrigir agora |
| 32 | baixo | E2E | Link inválido de "parar o resumo" mostrava o botão | `/parceiro/resumo/parar?t=x` | Mensagem direta, sem botão | corrigir agora |

Não procede: nenhum. Os achados de demo e apresentação (aderência 4–7) vão para a S7.

## 3. Matriz E2E (local, servidor de produção `next start` standalone, flags da S5/S6 ligadas, `agendador` desligado)
| Cenário | Persona | Tela | Esperado | Observado | Evidência | Veredito |
|---|---|---|---|---|---|---|
| Link do avaliador → Portal | avaliador 390 | acesso, início | conta com exemplo pronto | ok | `01`, `02` | ✓ |
| Prévia do resumo | avaliador 390 | Plano › Ver o e-mail desta semana | assunto, resultado da semana passada, plano por faixa, 3 links | ok | `04` | ✓ |
| Aprovar pelo e-mail, sem sessão | dono no celular | `/parceiro/aprovar/<rv_>` | GET mostra; POST aprova; reabrir = "já foi usado" | ok, com "Gerado em dd/mm" | `05`–`07` | ✓ |
| Parar o resumo | dono | `/parceiro/resumo/parar` | confirmação; link inválido explica | ok | `08` | ✓ |
| Configurações (Avisos, IA, Cardápio, Restaurante) | avaliador 390, dono 768/1280 | 4 abas | sem rolagem lateral; axe limpo | ok depois da correção 21/31 | `09-*`, `21-*` | ✓ |
| Link do garçom | dono 1280 → garçom 390 | Validar › Link do garçom; `/garcom` | criar, abrir sem login, código errado = "não encontrado" | ok | `10`, `22`–`24` | ✓ |
| Porta-conta | avaliador 390 | Kit | adicionar, texto da 1ª visita | ok | `11`, `12` | ✓ |
| Cliente: página, check-in, Jornada, preferências | cliente 390 | `/r/<slug>`, `/app/jornada` | central com mestre e tipos | ok | `14`–`18` | ✓ |
| Tokens inválidos | anônimo 390 | aprovar, garçom, parar, descadastrar | 404 ou mensagem clara | ok | log | ✓ |

Logs: `e2e-profunda-1.log` (antes das correções) e `e2e-profunda-2.log` (depois: 34 telas com axe sem violação, nenhuma rolagem horizontal, nenhum erro de console nem 4xx/5xx inesperado).

## 4. Matriz E2E (produção)
Preenchida depois do merge e do deploy (§8).

## 5. Console, rede, tempos e acessibilidade
- Antes: rolagem horizontal de 203 px em Configurações › Cardápio a 390 px; `heading-order` em Cardápio e Restaurante. Depois: nenhum.
- Console e rede: sem erros nas 2 rodadas (uma rodada intermediária contra um servidor antigo na mesma porta deu 500 em estáticos; descartada, servidor reiniciado).
- E2E automatizada: 88 ✓ em 1,6 min.

## 6. Correções aplicadas
| Achados | Commit | Verificação |
|---|---|---|
| 2 | `e18f9d0` | `avaliador.test.ts` (novo caso) |
| 3, 4, 10, 11, 12 | `2b7d7e1` | `scheduler.test.ts` (2 casos novos), 11/11 |
| 13, 14, 22–25 | `0fcb7de` | `openrouter-gateway.test.ts`, `preferences.test.ts`, `ai-profile.test.ts`, `no-raw-sql.test.ts` (+ isca) |
| 1, 6, 16 | `6ca62cd` | `plan-agent.test.ts` |
| 5, 7, 17, 19–21, 27, 29, 31, 32 | `c1cced0`, `30fad83` | `brand.test.ts`, `ai-profile.test.ts` (integração), E2E completa e profunda |

## 7. Decisões novas registradas
D227–D231 em `decisoes-e-tradeoffs.md` (seção "Revisão S4–S6 — decisões").

## 8. Produção
(merge, deploy e E2E em produção — anexado depois)
