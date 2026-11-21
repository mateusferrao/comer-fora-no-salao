# T3 do agente — plano da semana como agente × chamada única (D159, D191)

Rodada de 2026-11-21 · pausa de 3 s entre chamadas e nova tentativa no limite de taxa (429 não conta como falha do modelo; a 1ª rodada do dia perdeu 12 de 20 execuções por 429 e foi descartada) · modelo google/gemini-3.8-flash (vencedor da T3) · 5 fixtures fictícias × 2 repetições · sem reserva (falha conta como falha) · juiz cego fixo `moonshotai/kimi-k3.1-pro` em pares (ordem sorteada) · custo total US$ 0.1698.

| Modo | Passou nas regras | p50 | Custo/chamada | Passos (média) |
|---|---|---|---|---|
| Agente (ferramentas) | 10/10 (100%) | 12,4 s | US$ 0.0111 | 8.9 |
| Chamada única | 5/10 (50%) | 2,6 s | US$ 0.0021 | — |

Juiz (pares agente × única): agente 2 · empate 0 · única 3 → pior.

Regra fixada antes da rodada (D159): liga `plano_agente` com regras ok ≥ 90%, p50 ≤ 20 s e juiz não pior (vitórias + empates ≥ derrotas).

**Decisão: manter `plano_agente` desligada.**

Falhas:
- unica boteco #2: invalid: textoConvite:referencia:fato:faixa_A_turno (não permitida aqui)
- unica burger #2: invalid: textoConvite:tamanho:167>160
- unica vitrine #1: invalid: textoConvite:referencia:fato:faixa_A_turno (não permitida aqui); textoConvite:referencia:fato:faixa_B_turno (não permitida aqui)
- unica vitrine #2: invalid: textoConvite:referencia:fato:faixa_A_turno (não permitida aqui); textoConvite:referencia:fato:faixa_B_turno (não permitida aqui)
- unica borda #2: invalid: textoConvite:tamanho:174>160

Exemplo de passos do agente: Viu as ofertas possíveis da faixa A → Viu as ofertas possíveis da faixa B → Consultou os números do restaurante → Calculou o custo máximo da semana (A1) → Calculou o custo máximo da semana (B2) → Conferiu o texto do convite nas regras → Conferiu a justificativa nas regras → Conferiu o texto do convite nas regras → Conferiu o texto do convite nas regras → Conferiu a justificativa nas regras

## Limitações
- Amostra pequena (5 fixtures × 2); o juiz avalia o texto, não o resultado no salão.
- As fixtures e os fatos são fictícios; o agente tem as mesmas regras e o mesmo schema da chamada única.
