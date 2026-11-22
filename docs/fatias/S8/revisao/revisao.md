# Revisão da fatia S8 — Copiloto do salão

Data: 22/11/2026 (madrugada) · Base: `main` (sincronizada no merge `8bbd672`) · Revisado: `556128b` · Merge na `main`: `df36504` (CI 114 verde, inclusive a fumaça contra produção) · Produção: `df36504`, depois a correção do foco (§4)

## 1. Resumo e veredito
Pronta para merge. 4 revisores independentes (aderência, técnica, produto/UX, segurança/IA) + E2E profunda feita pela IA, local, com IA roteirizada **e** com IA real (chave demo), e passadas de toda a suíte com e sem a flag `copiloto`. Nenhum crítico ficou aberto; todos os altos foram corrigidos e reverificados. Dívidas abertas em §2 ("corrigir depois").

## 2. Achados consolidados
| # | Gravidade | Frente | Achado | Evidência | Correção | Decisão (IA, D101) |
|---|---|---|---|---|---|---|
| 1 | crítico | produto | No modo apresentação (1024 px) o painel empurrava o conteúdo para ~368 px | `Presenter.tsx`, `Copilot.tsx` | Painel só empurra a partir de 1280 px; abaixo sobrepõe | corrigido |
| 2 | alto | aderência + E2E | Chip da demo sem prato → a IA real perguntava em vez de propor (sem cartão) | `real-02/04b`; `layout.tsx` | Chip montado pelo código com prato válido e fora de uso ("…por Gelato artesanal"); conferido com IA real (cartão em 4,4 s) e na validação da T4 (3/3) | corrigido |
| 3 | alto | aderência | "Como funciona" dizia "nenhum dado pessoal entra em prompt"; aceite do cliente não citava o assistente | `como-funciona/page.tsx`, `textos.ts` | Textos reescritos (nome curto sim, contato nunca; copiloto e MCP) | corrigido |
| 4 | alto | aderência + produto + técnica | Métricas do copiloto prometidas não existiam | `quality.ts` | `getCopilotMetrics` + cartão em Bastidores › Qualidade da IA + rótulos `copiloto`/`salao_frase` | corrigido (recusas do código e abandono do passo 2 ficam para o piloto — declarado na tela) |
| 5 | alto | segurança + técnica | Conversa do navegador sem escopo de dono/loja (nomes de clientes de A visíveis para B na mesma aba) | `Copilot.tsx:27` | Chave `copiloto:conversa:<dono>:<loja>`, outras apagadas ao carregar e no "Sair" | corrigido |
| 6 | alto | técnica | Copiloto não passava pelos limites do Zod (margem 150%, resumo 02:00) | `catalog.ts:192` só no MCP | `proposalPayloadSchema` (com `plano`) em `createProposals` para as 2 portas; minuto do resumo em meia hora | corrigido |
| 7 | alto | técnica + segurança | `aplicando` tratado como `aplicada`; reserva presa nunca limpa | `proposals.ts:237` | Estado `em_andamento` (409); presa > 30 min + 2 min vira `falhou`; `finish` em `finally`; teste de corrida ajustado | corrigido |
| 8 | alto | produto | "Campo destacado" da demo não existia | `fake-04` | Faixa "✓ Atualizado pelo assistente: …" em Configurações depois de Aplicar | corrigido |
| 9 | alto | produto | Cartões restaurados voltavam a "Aplicar" | `ProposalCard` | Estado por cartão guardado na conversa; vencido após 30 min | corrigido |
| 10 | alto | produto | Texto "Preparei a proposta" com cartão recusado/ausente; proposta incompleta sumia | `fake-05`, `copilot-turn.ts:75` | Código troca a frase; incompleta vira cartão "faltou informação" | corrigido |
| 11 | alto (E2E) | produto | Botão flutuante cobria campos do formulário (axe: contraste do "Remover") com a flag ligada | passada `chromium` com `copiloto=on` | Botão na barra lateral (computador) e no cabeçalho fixo (celular) | corrigido |
| 12 | médio | segurança | Chave demo sem nenhum limite (inclui quem entra pelo link) | `route.ts:34` | Isenção só de E2E e apresentador | corrigido |
| 13 | médio | segurança | Nome de cliente de 1 palavra com cara de contato ia ao prompt/MCP | `name.ts` | `safeName` → "Cliente" | corrigido |
| 14 | médio | técnica | Desconto sem % virava 10% inventado pelo código | `copilot.ts:201` | `pct_faltando` | corrigido |
| 15 | médio | técnica | Proposta incompleta reprovava o turno inteiro | `copilotGuard` | Guard só na resposta/sugestões | corrigido |
| 16 | médio | segurança | `fakeAi:false` não conferido em produção pela esteira | `ci.yml:154` | Asserção na `fumaca.spec.ts` (roda contra produção) | corrigido |
| 17 | médio | aderência | T4 ajustada nos mesmos casos que a avaliam | `relatorio-t4.md` | Validação fora da amostra: 6 casos novos × 3 (gemini 17/18, luna 14/18; chip da demo 3/3); relatório sem parágrafo velho | corrigido |
| 18 | médio | produto | Frase do salão prometia "em branco" e mantinha valores; substituía horários sem avisar | `real-09` | Texto honesto + aviso de substituição | corrigido |
| 19 | médio | produto | Chips ambíguos, modal do celular aberto após aplicar, área fixa alta, aviso falso de edição não salva, custo antes ausente | capturas | Chips "…" preenchem; celular fecha; chips em 1 linha; salvar zera o aviso; linha "Custo máximo por semana" | corrigido |
| 20 | médio | aderência | Teto US$ 0,20 pode esgotar | `ai-calls.ts` | Avaliadores entram pelo link (chave demo, sem esse teto); teto único somando copiloto + frase | parcial: teto mantido |
| 21 | médio-alto | aderência | Ícone do iFood na aba (D272) | `app/favicon.ico` | — | não corrigir: pedido explícito do candidato, risco registrado na D272 |
| 22 | médio | técnica | Dependência circular `ia`↔`agente`; JSON Schema do MCP escrito à mão | `copilot.ts:11`, `catalog.ts` | Ciclo não existe no nível de arquivo (padrão do projeto); regra `no-circular`; schema do MCP gerado do Zod, 8 ações descritas | corrigido (D275, `4505bf3`) |
| 23 | médio | técnica | ~20 consultas por turno (`loadContext` 3×, todos os clientes) | `context.ts` | Um só `loadContext`; retrato reaproveitado: 29 → 19 consultas (teste com orçamento ≤ 20) | corrigido (D275, `ef57f1b`) |
| 24 | baixo | segurança | Guard do chat sem dia/turno | `guardrails` | — | não corrigir: "tarde/noite" são palavras comuns; horário vai por referência |
| 25 | baixo | técnica | `agent_proposals` sem limpeza; ação `restaurante` regrava campos lidos agora | — | Faxina no tique do agendador (expira/falha, sem apagar); `updateRestaurantFinance` só ticket/margem; teste do `privateTrace` | corrigido (D275, `e3b8860`, `330ef77`) |
| 26 | baixo | E2E | 1ª cópia do exemplo lenta sob carga (apresentação, garçom) | logs | Esperas de 120 s, como a `navegacao.spec` | corrigido (teste) |

Não procedem: nenhum.

## 3. Matriz E2E (local)
| Cenário | Persona | Tela | Esperado | Observado | Evidência | Veredito |
|---|---|---|---|---|---|---|
| Chip → cartão → Aplicar → aba | dono (cópia da Cantina) | 1280 | cartão com custo do código; aplica; URL `?aba=convites&v=` | ok (roteirizada e IA real 4,4 s) | `fake-02/04`, `real2`, `final-1280-cartao` | ok |
| Edição não salva + Aplicar | dono | 1280 | confirmação do design system | ok | `fake-03` (antes da correção do seletor) | ok |
| Recusa (Tiramisù) | dono | 1280 | motivo do código | ok; IA real ainda sugeriu trocar a recompensa | `real-05` | ok |
| Clientes perto da recompensa | dono | 1280 | nomes curtos, sem contato | ok ("Diego M.." corrigido) | `real-05` | ok |
| Teto 12 | dono | 1280 | cartão com teto e custo | ok | `real-05` | ok |
| Celular | dono | 390 | tela cheia; fecha; axe ok | ok | `real-07`, `final-390-*` | ok |
| 768 | dono | 768 | axe ok | ok | `fake-06` | ok |
| Ativação: frase do salão | dono novo | 1280 | preenche sem gravar; número fora do texto não entra | ok (IA real 2,9 s) | `real-08/09` | ok |
| Ativação: dúvida | dono novo | 1280 | só dúvida, sem dados | ok (resposta imprecisa sobre margem → guia corrigido) | `real-10` | ok |
| Sem IA | dono | 1280 | resposta fixa + atalhos | ok (integração) | `copilot-turn.test.ts` | ok |
| MCP de ponta a ponta | agente externo | HTTP | 10 ferramentas; clientes sem contato; propor → aplicar → já estava; 70% recusado; sem token 401 | ok | `mcp-e2e.js` (log da sessão) | ok |
| Suíte inteira, flags desligadas e ligadas | todas | — | verde | 100 ok; 2 instáveis de carga (cópia do exemplo) corrigidos nos testes | logs | ok |
| Suíte base com `copiloto=on` | todas | — | nada quebra | 1 achado (botão cobria formulário) → corrigido; demais falhas = limites de login/Bastidores esgotados pelas rodadas | logs | ok |

## 4. Matriz E2E (produção)
Flags `copiloto`, `mcp_clientes` e `mcp_edicao` ligadas nos Bastidores depois do deploy (o candidato autorizou ler a senha pelo conector do Easypanel). Contas E2E (fora das métricas), IA real.
| Cenário | Esperado | Observado | Evidência | Veredito |
|---|---|---|---|---|
| `/api/health` | `ok`, SHA do merge, `fakeAi:false` | `df36504`, `fakeAi:false` | curl | ok |
| Flag desligada | rota do copiloto 404 | `{"erro":"desligado"} 404` antes de ligar | curl | ok |
| Chip da demo → cartão → Aplicar | cartão com custo antes → depois; aplica; aba + faixa | cartão em 3,9 s; Cannoli → Gelato; R$ 2.618 → R$ 1.904; `&v=` | simulação `prod` | ok |
| Recusa (Tiramisù) | motivo do código, texto honesto | "Não preparei a mudança: veja o motivo abaixo." + regra | simulação | ok |
| Clientes / teto / semana | respostas sem número cru; cartão do teto | 3,7–7,3 s | simulação | ok |
| Frase do salão (ativação) | preenche sem gravar | 3,8 s | simulação | ok |
| 768 / 390 | axe limpo | 390: `scrollable-region-focusable` no histórico → corrigido (`tabIndex=0`) | simulação | corrigido |
| MCP pela rota real | 10 ferramentas; clientes sem contato; propor → aplicar → já estava; 70% recusado; sem token 401 | tudo como esperado | `mcp-e2e.js` | ok |
| Console e rede | sem erros | `ERROS []` | simulação | ok |
| Ícone da aba | o novo `.ico` | md5 igual ao do repositório | curl | ok |

## 5. Console, rede, tempos e acessibilidade
- Console e rede: nenhum erro nas simulações (`ERROS []`).
- Tempos com IA real: turno 3,7–6,8 s; frase do salão 2,9 s; T4 p50 3,1–3,6 s (gemini).
- axe: limpo no painel vazio, com cartão, 768 e 390 px; contraste da seção da frase corrigido (fundo branco).
- Bug achado e corrigido: `useEffect(() => el.scrollIntoView())` derrubava a tela no Chromium recente (Promise tratada como limpeza).

## 6. Correções aplicadas
| Achados | Commit | Verificação |
|---|---|---|
| E2E com IA real (chip, ponto duplo, guia, atalhos, rótulo) | `995caf7` | unit + integração; IA real |
| 5–7, 12–16 (backend) | `04e18b0` | unit 457 + integração 34 arquivos |
| 1, 3, 4, 8–10, 18–19 (produto/aderência) | `a7bef41` | integração das métricas; E2E |
| 17 (T4 validação) | commit "eval(T4)…" | `eval/relatorio-t4-validacao.md` |
| 11, 16, 26 | `556128b` | E2E copiloto 6 ok; `dono.spec` com flag ligada ok |

## 7. Decisões novas registradas
- D275 [C] — dívidas técnicas pagas depois da entrega (itens 22, 23, 25) → `decisoes-e-tradeoffs.md`.
- D274 [C] — decisões da revisão da S8 (esta tabela) → `decisoes-e-tradeoffs.md`.
