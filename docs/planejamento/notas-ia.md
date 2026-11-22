# Notas de uso de IA na construção

Registro pedido pela D98: uso de modelos fora do rastro do app (Langfuse), com objetivo e custo. Valores em US$.

| Data | O quê | Modelos | Chave | Custo | Onde está |
|---|---|---|---|---|---|
| 20/11 | Spike da S0 (extração + reserva) | gemini-2.5-flash-lite, gpt-5-nano | demo | ~0,001 | `scripts/spike-ai.ts` |
| 20/11 | **Mini-avaliação T1 (D117, D128, D129)**: 4 cardápios × 7 modelos × 2 repetições + 3 linhas de base de OCR | 7 de visão + Google Vision + gemini-2.5-flash-lite (texto) | demo + service account do Google (só no script) | 0,0841 (inclui o preço de tabela do Vision, coberto pela cota grátis) | `eval/run-t1.ts`, `eval/relatorio-t1.md` |
| 20/11 | Cache das extrações dos 3 exemplos | gemini-3.1-flash-lite | demo | < 0,01 | `scripts/gerar-cache-exemplos.ts` |
| 21/11 | **Spike do copiloto (S8)**: saída achatada + ferramenta + histórico | gemini-3.8-flash, gpt-6-luna, claude-haiku-5.5 | demo | ~0,004 | `eval/spike-copiloto.ts` |
| 21/11 | **Mini-avaliação T4 (S8, D266)**: 4 rodadas (12 e 16 pedidos com gabarito) × até 3 modelos | gemini-3.8-flash, gpt-6-luna, claude-haiku-5.5 | demo | ~0,29 | `eval/run-t4.ts`, `eval/relatorio-t4.md` |
| 20/11 | **Taxa de bloqueio do revisor**: 10 planos da vitrine gerados com IA real + o revisor em cada um | vencedor da T3 + modelo do revisor (outro provedor) | demo | não gravado no JSON (as chamadas ficaram em `ai_calls` do banco local) | `eval/run-revisor.ts`, `eval/resultados-revisor.json` |
| 21/11 | **T3 do agente (D159, D191, D225)**: 3 rodadas (prompts `plano-agente-v1`, `v2`, `v3`) × 5 fixtures × 2 repetições, agente × chamada única + juiz cego nos pares; uma rodada anterior perdeu 12 de 20 execuções por limite de taxa (429) e foi descartada | gemini-3.8-flash; juiz kimi-k3.1-pro | demo | 0,57 (0,170 + 0,187 + 0,214; a rodada descartada não foi gravada) | `eval/run-t3-agente.ts`, `eval/relatorio-t3-agente*.md`, `eval/resultados-t3-agente*.json` |
| 20/11 | **Mini-avaliação T3 (D137, D147)**: 2 rodadas (a 1ª descartada após corrigir o prompt) × 6 modelos × 5 fixtures × 2 repetições + juiz cego nos pares | gemini-3.1-flash-lite, gpt-6-luna, deepseek-v4.1-flash, claude-haiku-5.5, qwen3.8-flash, gemini-3.8-flash; juiz kimi-k3.1-pro | demo | 0,33 (0,14 + 0,14 + 0,04 do juiz nos pares cegos) | `eval/run-t3.ts`, `eval/judge-t3-cego.ts`, `eval/relatorio-t3.md` |

## Como a T1 foi feita (e por quê)
- **Por quê agora (D117):** a leitura do cardápio é o "uau" da ativação; a escolha do modelo tinha de sair de número antes de ligar a extração (D51). O assistente (Claude) é parte interessada: o `claude-haiku-5.5` concorreu com o conflito declarado e não venceu.
- **Por que OCR só como linha de base (D128):** a pergunta do candidato foi "e se tentarmos OCR primeiro, com IA de reserva?". Medimos em vez de supor: Tesseract + regras (nota 0,46), Google Vision + regras (0,42) e Vision + LLM de texto (0,73) contra os modelos de visão (0,98–1,00). O OCR lê as letras, mas não junta nome, preço e seção em layout de colunas, foto torta ou manuscrito; o híbrido custa mais e erra mais preços.
- **Dados:** 3 cardápios fictícios desenhados a partir da mesma fonte que gera o gabarito (`eval/cardapios/dados.ts`) + 1 foto de cardápio impresso enviada pelo candidato para testar robustez (manuscrita, 338×450; sem dados de clientes), mantida fora do produto e da cópia pública (`eval/privado/`); os resultados guardam só as notas, não o texto lido.
- **Resultado:** principal `google/gemini-3.1-flash-lite` (nota 1,000; p50 2,4 s; US$ 0,0017/cardápio); reserva `openai/gpt-6-luna` (0,994; empate com `deepseek-v4.1-flash`, desempate pelo custo). `qwen3.8-flash` estourou o tempo de 30 s em 2 de 8 tentativas.
- **Limite honesto:** os cardápios fictícios saturaram a nota dos melhores modelos (≈ 1,0): entre 1,000 e 0,994 é empate técnico com 2 repetições. Valeu a regra combinada antes (maior nota; reserva de outro provedor). O custo absoluto (US$ 0,0017 por cardápio) é desprezível nessa escala; o `gpt-6-luna` é ~7× mais barato e o `deepseek` mais rápido, e nenhum dos dois foi o critério. Uma avaliação maior (cardápios reais variados) fica para o piloto.

## Como a T3 foi feita (e por quê)
- **O que mede (D137):** a tarefa 3 (pacote da ativação e plano da semana) em 3 camadas: o código (regras ok, latência, custo, "IA ≠ maior nota"), um juiz de IA fixo e cego (Moonshot, que não concorre; nunca Anthropic, pelo conflito do assistente) e a nota cega do candidato nos mesmos pares, com concordância (% com intervalo de Wilson e κ).
- **Linha de base:** o modo sem IA do produto (maior nota + textos modelo + justificativa montada pelo código a partir dos fatos).
- **Achado que virou correção:** na 1ª rodada, 3 modelos copiaram o marcador `{horario:FAIXA}` do prompt ao pé da letra. O prompt passou a dizer `{horario:X}` com exemplo (`pacote-v2`/`plano-v2`) e a rodada foi refeita.
- **Nota humana (3ª camada):** o candidato pontuou os 9 pares às cegas, pelo chat. Preferiu a IA em 8 de 9 e concordou com o juiz em 7 de 9 (κ 0,55). Os desacordos foram o par 5 (ele escolheu o desconto em Temaki; o juiz, o Sunomono) e o par 6 (ele escolheu a IA; o juiz, a linha de base).
- **Resultado:** principal `google/gemini-3.8-flash` (regras ok 90%; p50 2,8 s; juiz 4,42), reserva `openai/gpt-6-luna` (90%; 1,5 s; 3,53). O kit segue o vencedor [C].
- **Limite honesto:** amostra pequena; a ordem entre modelos próximos muda entre rodadas. O ganho medido é de texto (voz e uso dos fatos), não de resultado no salão: quem diz se a oferta funcionou é o veredito do código com dados reais.
- **O que o "8 de 9" prova e o que não prova (S9, revisão de IA A3):** a linha de base é o texto modelo do produto, escrito pelo próprio candidato e reconhecível pelo formato; o par não é cego de verdade. Na nota do juiz para o vencedor (n=4), o critério item × turno, que é a parte da **escolha**, empatou com a linha de base em 3 de 4 fixtures (burger 5 × 5, sushi 5 × 5, vitrine 4 × 4; só a borda 5 × 3). A vantagem medida está em voz e uso dos fatos, ou seja, no texto. A IA escolher diferente da maior nota mostra que ela não repete a regra do código, mas não mostra que escolhe melhor. **Ganho medido:** leitura do cardápio (T1, contra OCR) e texto (T3, contra o texto modelo). **Hipótese:** a escolha item × turno rende mais, a medir no piloto com um grupo de restaurantes sem a escolha da IA.

## Como a T3 do agente foi feita (e por quê)
- **O que mede (D159):** o plano da semana como agente com ferramentas (ver ofertas, números, custo e conferir o texto nas regras) contra a chamada única, no mesmo modelo, mesmas fixtures e mesmas regras, sem reserva (falha conta como falha). Regra fixada antes: liga `plano_agente` com regras ok ≥ 90%, p50 ≤ 20 s e juiz não pior.
- **Rodada 1 (`plano-agente-v1`, US$ 0,170):** agente 10/10, chamada única 5/10 nas regras; p50 12,4 s × 2,6 s; juiz 2 × 3 (pior). Pela regra, não ligaria.
- **Rodada 2 (`plano-agente-v2`, US$ 0,187):** agente 9/10, única 8/10; p50 14,0 s × 2,6 s; juiz 3 × 4 (pior). Pela regra, não ligaria; o candidato ligou mesmo assim (D225), pela confiabilidade nas regras, com a chamada única de reserva.
- **Rodada 3 (`plano-agente-v3`, US$ 0,214):** o convite passou a exigir dia e horário (D226). Agente 10/10, única 10/10; p50 13,8 s × 3,6 s; US$ 0,0142 × 0,0022 por plano; juiz 6 × 1 empate × 3. Pela regra, ligaria.
- **Limite honesto:** na v3 a chamada única também passou 10/10, então o argumento da confiabilidade enfraqueceu; o que sobra é o juiz (6 × 3 com n=10, sem significância) por ~6,5× o custo e ~3,8× a latência. A vantagem concreta do agente é corrigir o próprio texto pelas regras antes de devolver (`checar_texto`); a alternativa barata seria a chamada única com uma rodada de reparo.

## Revisor
- **O que mede:** quantos planos bons da IA o revisor (outro provedor) bloqueia sem motivo. Resultado: 0 de 10 bloqueados, 3 com "atenção" (`eval/resultados-revisor.json`).
- **Limite honesto:** só os falsos positivos foram medidos. Textos ruins de propósito (promessa extra, número por extenso, dado pessoal) ainda não passaram pelo revisor numa rodada medida.
