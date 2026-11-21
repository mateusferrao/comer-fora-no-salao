# T3 do agente — plano da semana como agente × chamada única (D159, D191)

Rodada de 2026-11-21 · prompt do agente `plano-agente-v3` · pausa de 3 s entre chamadas e nova tentativa no limite de taxa (429 não conta como falha do modelo) · modelo google/gemini-3.8-flash (vencedor da T3) · 5 fixtures fictícias × 2 repetições · sem reserva (falha conta como falha) · juiz cego fixo `moonshotai/kimi-k3.1-pro` em pares (ordem sorteada) · custo total US$ 0.2136.

| Modo | Passou nas regras | p50 | Custo/chamada | Passos (média) |
|---|---|---|---|---|
| Agente (ferramentas) | 10/10 (100%) | 13,8 s | US$ 0.0142 | 9.3 |
| Chamada única | 10/10 (100%) | 3,6 s | US$ 0.0022 | — |

Checagens determinísticas no convite renderizado (pelo código, nos planos que passaram — D226):

| Modo | Convites | Com dia e horário | Artigo antes do dia ("no terça") | Oferta repetida ("grátis por nossa conta") |
|---|---|---|---|---|
| Agente | 14 | 100% | 0% | 0% |
| Chamada única | 14 | 100% | 0% | 0% |

Juiz (pares agente × única): agente 6 · empate 1 · única 3 → não pior.

Regra fixada antes da rodada (D159): liga `plano_agente` com regras ok ≥ 90%, p50 ≤ 20 s e juiz não pior (vitórias + empates ≥ derrotas).

**Pela regra da D159: ligaria `plano_agente`.** Decisão do candidato (D225): ligado, com a chamada única de reserva — confiabilidade nas regras vence. Rodadas anteriores: `eval/relatorio-t3-agente-rodada1.md` (`plano-agente-v1`) e `eval/relatorio-t3-agente-rodada2.md` (`plano-agente-v2`); a rodada com 429 foi descartada. Nesta rodada (v3), o convite precisa citar dia e horário da faixa (regra do código — D226).


Exemplo de passos do agente: Viu as ofertas possíveis da faixa A → Viu as ofertas possíveis da faixa B → Consultou os números do restaurante → Calculou o custo máximo da semana (A1) → Calculou o custo máximo da semana (B2) → Conferiu o texto do convite nas regras → Conferiu a justificativa nas regras → Conferiu o texto do convite nas regras → Conferiu a justificativa nas regras → Conferiu o texto do convite nas regras

## Limitações
- Amostra pequena (5 fixtures × 2); o juiz avalia o texto, não o resultado no salão.
- As fixtures e os fatos são fictícios; o agente tem as mesmas regras e o mesmo schema da chamada única.
