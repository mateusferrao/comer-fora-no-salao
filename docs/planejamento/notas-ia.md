# Notas de uso de IA na construção

Registro pedido pela D98: uso de modelos fora do rastro do app (Langfuse), com objetivo e custo. Valores em US$.

| Data | O quê | Modelos | Chave | Custo | Onde está |
|---|---|---|---|---|---|
| 20/11 | Spike da S0 (extração + reserva) | gemini-2.5-flash-lite, gpt-5-nano | demo | ~0,001 | `scripts/spike-ai.ts` |
| 20/11 | **Mini-avaliação T1 (D117, D128, D129)**: 4 cardápios × 7 modelos × 2 repetições + 3 linhas de base de OCR | 7 de visão + Google Vision + gemini-2.5-flash-lite (texto) | demo + service account do Google (só no script) | 0,0841 (inclui o preço de tabela do Vision, coberto pela cota grátis) | `eval/run-t1.ts`, `eval/relatorio-t1.md` |
| 20/11 | Cache das extrações dos 3 exemplos | gemini-3.1-flash-lite | demo | < 0,01 | `scripts/gerar-cache-exemplos.ts` |
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
- **Resultado:** principal `google/gemini-3.8-flash` (regras ok 90%; p50 2,8 s; juiz 4,42), reserva `openai/gpt-6-luna` (90%; 1,5 s; 3,53). O kit segue o vencedor [C].
- **Limite honesto:** amostra pequena; a ordem entre modelos próximos muda entre rodadas. O ganho medido é de texto (voz e uso dos fatos), não de resultado no salão: quem diz se a oferta funcionou é o veredito do código com dados reais.
