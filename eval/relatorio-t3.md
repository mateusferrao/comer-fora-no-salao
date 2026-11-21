# T3 — Pacote e plano da semana: escolha do modelo (D137)

Rodada de 2026-11-20 · 2 repetições × 5 fixtures fictícias (eval/fixtures-t3.ts) · juiz fixo e cego: `moonshotai/kimi-k3.1-pro` (não concorre; nunca Anthropic) · custo total US$ 0,19.

## 1. Código (regras, tempo, custo)

| Modelo | Passou nas regras | p50 | Custo/chamada | IA ≠ maior nota | Juiz (média 1–5) | Juiz prefere a IA | Elegível |
|---|---|---|---|---|---|---|---|
| gemini-3.1-flash-lite | 70% | 1,1 s | US$ 0,0007 | 100% | 3,67 (n=4) | 3/4 | não |
| gpt-6-luna | 90% | 1,5 s | US$ 0,0002 | 69% | 3,53 (n=5) | 3/5 | sim |
| deepseek-v4.1-flash | 60% | 1,4 s | US$ 0,0006 | 75% | 4,56 (n=3) | 3/3 | não |
| claude-haiku-5.5 (conflito declarado) | 50% | 2,3 s | US$ 0,0004 | 71% | 4,33 (n=2) | 2/2 | não |
| qwen3.8-flash | 0% | — | US$ 0,0000 | — | — (n=0) | 0/0 | não |
| gemini-3.8-flash (referência) | 90% | 2,8 s | US$ 0,0021 | 75% | 4,42 (n=4) | 3/4 | sim |

Regra [C] fixada antes da rodada: elegível com regras ok ≥ 90% e p50 ≤ 15 s; vence a maior média do juiz; a reserva é o melhor elegível de outro provedor.

**Vencedor: gemini-3.8-flash (referência) · reserva: gpt-6-luna.**

Linha de base (sem IA, justificativa modelo do código), nota média do juiz: item × turno 4,28 · fato 3,61 · voz 2,33.

Motivos de reprovação pelas regras (o modo sem IA cobre todos):

- `tempo esgotado`: 10
- `justificativa:numero`: 6
- `textoConvite:tamanho`: 5
- `faixa_repetida`: 3
- `aprendemos:proibida:gratis`: 3
- `justificativa:proibida:gratis`: 2
- `justificativa:referencia:fato:fato:faixa_B_mesas`: 1
- `justificativa:referencia:fato:fato_A_turno`: 1

## 2. Juiz de IA × nota cega do candidato (mesmos pares)

9 pares do vencedor × linha de base (eval/t3-cego.md), ordem A/B sorteada; a chave fica em eval/t3-cego-chave.json.

| Par | Fixture | Juiz | Candidato |
|---|---|---|---|
| 1 | boteco | IA | IA |
| 2 | burger | IA | IA |
| 3 | burger | IA | IA |
| 4 | sushi | IA | IA |
| 5 | sushi | IA | linha de base |
| 6 | vitrine | linha de base | IA |
| 7 | vitrine | IA | IA |
| 8 | borda | IA | IA |
| 9 | borda | IA | IA |

Juiz: prefere a IA em 8 de 9 pares.
Candidato: prefere a IA em 8 de 9 pares.
**Concordância juiz × candidato: 7 de 9 (78%; IC 95% de Wilson 45%–94%) · κ de Cohen 0,55 (indicativo: amostra pequena).**

## 3. Limitações

- Amostra pequena (5 fixtures × 2 repetições; juiz em n ≤ 5 por modelo): a ordem entre modelos próximos pode mudar de uma rodada para outra. A 1ª rodada (prompt com `{horario:FAIXA}` ambíguo, corrigido para `{horario:X}`) foi descartada; o achado virou correção do prompt (pacote-v2/plano-v2).
- A linha de base é reconhecível pelo texto fixo do convite; o juiz e o candidato podem identificá-la.
- O juiz avalia texto, não resultado: quem decide se a oferta funcionou é o veredito do código com os dados reais.
