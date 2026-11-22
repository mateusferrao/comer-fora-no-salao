# Planejamento — índice

O planejamento inicial fechou em 19/11/2026 e foi replanejado em 20/11 (v2, diferenciação) e em 21/11 (produto real, valor ao dono e IA que opera). Desde então, cada fatia é planejada com a skill `planejar-fatia` na vez dela e revisada com `revisar-fatia` antes do merge. A especificação continua sendo a fonte única; as decisões novas entram em `decisoes-e-tradeoffs.md`.

| Documento | O que tem |
|---|---|
| [especificacao.md](especificacao.md) | **Fonte única para a construção:** produto (P1–P8), técnica (T1–T9), demo, entregáveis (E1–E4), prioridade e cronograma (§7, com S0–S9), riscos, roadmap, verificação |
| [00-contexto-problema-recorte.md](00-contexto-problema-recorte.md) | Contexto, leitura literal do enunciado, recorte, alternativas descartadas, pesquisa pública, apêndices |
| [plano-implementacao.md](plano-implementacao.md) | Plano por fatias: S0–S3 em tarefas, S7 (entregáveis) e o replanejamento de 21/11 (S4–S8) |
| [decisoes-e-tradeoffs.md](decisoes-e-tradeoffs.md) | **Todas as decisões** com alternativas, trade-offs, motivo e quem decidiu |
| [revisoes.md](revisoes.md) | 5 revisões independentes do planejamento inicial e o que foi aceito ou recusado |
| [log-conversa-ia.md](log-conversa-ia.md) | Log de como o projeto foi conduzido com a IA (base do slide de prompts) |
| [notas-ia.md](notas-ia.md) | Uso de modelos fora do app (mini-avaliações T1, T3, T3 do agente, T4, revisor), com custo |
| [notas-infra.md](notas-infra.md) | Onde roda, deploy pelo CI e rollback |

Legenda: **[B]** briefing · **[P]** pesquisa pública · **[O]** observado nos prints · **[H]** hipótese · **[C]** decisão do assistente de IA, aberta a correção.

## Status das fatias

| Fatia | O quê | Planejamento | Revisão |
|---|---|---|---|
| S0 | Fundação (Next.js, banco, IA, design system, CI e deploy) | [aprovado em 19/11](../fatias/S0/planejamento.md) | [revisão](../fatias/S0/revisao/revisao.md) ✅ |
| S1 | Domínio e fluxo do cliente (check-in, sorteio, teto, simulação de 60 dias) | [aprovado em 20/11](../fatias/S1/planejamento.md) | [revisão](../fatias/S1/revisao/revisao.md) ✅ |
| S2 | Portal, ativação proposta com IA, kit, validação e configurações | [aprovado em 20/11](../fatias/S2/planejamento.md) | [revisão](../fatias/S2/revisao/revisao.md) ✅ |
| S3 | Painel, plano da semana, apresentação e Bastidores | [aprovado em 20/11](../fatias/S3/planejamento.md) | [revisão](../fatias/S3/revisao/revisao.md) ✅ |
| S4 | Produto real e identidade | [aprovado em 21/11](../fatias/S4/planejamento.md) | revisão única S4–S6 ✅ (abaixo) |
| S5 | Valor e conversão | [aprovado em 21/11](../fatias/S5/planejamento.md) | revisão única S4–S6 ✅ (abaixo) |
| S6 | IA que opera e sistema configurável | [aprovado em 21/11](../fatias/S6/planejamento.md) | [revisão S4–S6](../fatias/S6/revisao/revisao.md) ✅ (merge `959f679`) |
| S8 | Assistente do salão (copiloto) e MCP sobre o mesmo catálogo | [aprovado em 21/11](../fatias/S8/planejamento.md) | [revisão](../fatias/S8/revisao/revisao.md) ✅ (merge `df36504`) |
| S9 | Polimento pré-entrega: revisão completa e revisão de copy | [aprovado em 22/11](../fatias/S9/planejamento.md) | [revisão](../fatias/S9/revisao/revisao.md) ✅ |
| S7 | Entregáveis do case: slide, apresentação, vídeo, documentação, repositório público, envio | [aprovado em 22/11](../fatias/S7/planejamento.md) | em andamento |

A S7 era a "S4 — Entregáveis" do plano inicial; foi renumerada no replanejamento de 21/11 (D151) e roda por último, depois da S8 e da S9.
