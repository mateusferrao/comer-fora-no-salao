# T4 — mini-avaliação do copiloto (S8, D266)

Duas rodadas, as duas preservadas. A 1ª (`copiloto-v1`) mostrou 2 falhas de contexto, não de modelo: para explicar a recusa do desconto de 60%, os 3 modelos escreveram o número ou "metade" (o teto de 50% não era um fato citável) e o gpt-6-luna achou que mudar o teto exigia plano da semana. O prompt `copiloto-v2` ganhou o fato `desconto_maximo_pct` e a frase "o teto e a oferta de um convite mudam direto". A escolha vale pela 2ª rodada, com a mesma regra fixada antes.

## Rodada 2 (`copiloto-v2`) — vale para a escolha
12 pedidos com gabarito sobre um retrato da Cantina × 3 modelos × 1 repetição, cada modelo sozinho. Regra fixada antes: maior acerto; empate → menor p50; p50 > 12 s → o copiloto sai da demo. Amostra pequena: resultado indicativo ("teste de fumaça").

| Modelo | Acerto (de 12) | Regras ok (de 12) | p50 | Custo total |
|---|---|---|---|---|
| google/gemini-3.8-flash | 12 | 12 | 3.1 s | US$ 0.0418 |
| openai/gpt-6-luna | 10 | 10 | 1.3 s | US$ 0.0030 |
| anthropic/claude-haiku-5.5 | 11 | 11 | 4.8 s | US$ 0.0094 |

**Vencedor pela regra:** google/gemini-3.8-flash; reserva: anthropic/claude-haiku-5.5 (outro provedor).

## Casos

| Caso | Pedido | gemini-3.8-flash | gpt-6-luna | claude-haiku-5.5 |
|---|---|---|---|---|
| trocar_oferta | troca a oferta do convite de terça à tarde pelo gelato | ✓ 3.0 s | ✓ 3.2 s | ✓ 2.8 s |
| acabou_tiramisu | acabou o tiramisù | ✓ 2.5 s | ✓ 2.4 s | ✓ 4.8 s |
| teto | aumenta o teto do convite da tarde para 12 | ✓ 2.6 s | ✗ (regras) 3.3 s | ✗ (regras) 5.0 s |
| preco | a lasanha agora custa 62 reais | ✓ 4.0 s | ✓ 3.0 s | ✓ 2.2 s |
| fora_ofertas | não quero mais a soda italiana em nenhuma promoção | ✓ 2.9 s | ✓ 1.0 s | ✓ 5.0 s |
| faixa_fim | o horário vazio da tarde agora vai até as 19h | ✓ 4.4 s | ✗ (regras) 0.9 s | ✓ 4.6 s |
| desativar | pode parar o convite da noite, encheu | ✓ 6.5 s | ✓ 0.8 s | ✓ 2.5 s |
| sabado | aumenta o teto do convite de sábado | ✓ 4.7 s | ✓ 3.2 s | ✓ 4.8 s |
| pergunta_numeros | como foram os convites nesta semana? | ✓ 2.1 s | ✓ 1.5 s | ✓ 7.5 s |
| pergunta_regra | o que é o grupo de controle? | ✓ 2.3 s | ✓ 0.6 s | ✓ 3.8 s |
| clientes | quem está perto da recompensa? | ✓ 4.2 s | ✓ 1.2 s | ✓ 6.2 s |
| desconto_60 | coloca um desconto de 60% na lasanha no convite da noite | ✓ 3.2 s | ✓ 1.2 s | ✓ 5.9 s |

Conflito declarado: o assistente que construiu o produto é da Anthropic; o `claude-haiku-5.5` concorre e a regra é numérica, fixada antes.

## Rodada 1 (`copiloto-v1`)
12 pedidos com gabarito sobre um retrato da Cantina × 3 modelos × 1 repetição, cada modelo sozinho. Regra fixada antes: maior acerto; empate → menor p50; p50 > 12 s → o copiloto sai da demo. Amostra pequena: resultado indicativo ("teste de fumaça").

| Modelo | Acerto (de 12) | Regras ok (de 12) | p50 | Custo total |
|---|---|---|---|---|
| google/gemini-3.8-flash | 11 | 11 | 2.8 s | US$ 0.0375 |
| openai/gpt-6-luna | 10 | 11 | 0.9 s | US$ 0.0030 |
| anthropic/claude-haiku-5.5 | 10 | 10 | 3.4 s | US$ 0.0094 |

**Vencedor pela regra:** google/gemini-3.8-flash; reserva: openai/gpt-6-luna (outro provedor).

### Casos (rodada 1)

| Caso | Pedido | gemini-3.8-flash | gpt-6-luna | claude-haiku-5.5 |
|---|---|---|---|---|
| trocar_oferta | troca a oferta do convite de terça à tarde pelo gelato | ✓ 2.9 s | ✓ 1.0 s | ✓ 6.4 s |
| acabou_tiramisu | acabou o tiramisù | ✓ 2.7 s | ✓ 0.9 s | ✓ 2.7 s |
| teto | aumenta o teto do convite da tarde para 12 | ✓ 4.1 s | ✗ 1.2 s | ✓ 4.6 s |
| preco | a lasanha agora custa 62 reais | ✓ 3.1 s | ✓ 0.9 s | ✓ 3.1 s |
| fora_ofertas | não quero mais a soda italiana em nenhuma promoção | ✓ 3.0 s | ✓ 0.9 s | ✓ 2.6 s |
| faixa_fim | o horário vazio da tarde agora vai até as 19h | ✓ 2.7 s | ✓ 0.8 s | ✓ 2.6 s |
| desativar | pode parar o convite da noite, encheu | ✓ 2.8 s | ✓ 0.9 s | ✓ 2.4 s |
| sabado | aumenta o teto do convite de sábado | ✓ 3.1 s | ✓ 1.6 s | ✓ 4.2 s |
| pergunta_numeros | como foram os convites nesta semana? | ✓ 2.5 s | ✓ 1.7 s | ✓ 4.3 s |
| pergunta_regra | o que é o grupo de controle? | ✓ 2.7 s | ✓ 0.6 s | ✓ 1.4 s |
| clientes | quem está perto da recompensa? | ✓ 4.0 s | ✓ 1.2 s | ✗ (regras) 3.8 s |
| desconto_60 | coloca um desconto de 60% na lasanha no convite da noite | ✗ (regras) 2.6 s | ✗ (regras) 1.0 s | ✗ (regras) 4.8 s |

Conflito declarado: o assistente que construiu o produto é da Anthropic; o `claude-haiku-5.5` concorre e a regra é numérica, fixada antes.
