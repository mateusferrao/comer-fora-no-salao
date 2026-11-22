# T4 — validação fora da amostra (revisão S8)

Casos novos (o prompt nunca foi ajustado neles), inclusive o chip exato da demo; 3 repetições. Não reescolhe o modelo: confere se a escolha da rodada 4 se sustenta.

| Modelo | Acerto | Regras ok | p50 | Custo |
|---|---|---|---|---|
| google/gemini-3.8-flash | 17/18 | 17/18 | 3.2 s | US$ 0.0591 |
| openai/gpt-6-luna | 14/18 | 14/18 | 1.1 s | US$ 0.0024 |

| Caso | Pedido | gemini-3.8-flash | gpt-6-luna |
|---|---|---|---|
| v_chip_demo | Trocar a oferta do convite de Ter, Qua, Qui · 15h–18h por Gelato artesanal | 3/3 | 3/3 |
| v_noite_bruschetta | no convite da noite quero dar a panna cotta em vez da bruschetta | 3/3 | 3/3 |
| v_nhoque_sumiu | tira o nhoque do cardápio, não fazemos mais | 3/3 | 3/3 |
| v_resumo_sexta | manda o resumo semanal na sexta às 18h | 3/3 | 0/3 |
| v_margem | nossa margem é uns 55% | 2/3 | 2/3 |
| v_duvida_holdout | por que alguns clientes não recebem convite? | 3/3 | 3/3 |
