# Mini-avaliação T1 — estruturar cardápio (foto/PDF → itens)

Rodada: 2026-11-20T12:13:31.042Z · prompt `cardapio-v1` · 2 repetições por cardápio por modelo · gerado por `eval/relatorio-t1.ts`.

## Por que medir agora (D117) e o que foi medido

- A extração é o momento "uau" da ativação. A escolha do modelo sai de número, não de opinião (D51), e o assistente que conduz a avaliação (Claude) é parte interessada: o `claude-haiku-5.5` concorre com o conflito declarado.
- **3 cardápios fictícios com gabarito** (mesma fonte de dados desenha a imagem e o gabarito): `boteco` (foto torta, 2 colunas, ruído), `burger` (limpo, fundo escuro), `sushi` (PDF de 2 páginas convertido em imagens, como o navegador faz — D127). **+1 foto de cardápio impresso** enviada pelo candidato (manuscrita, em ângulo, 338×450, com desenhos; sem dados de clientes), só como teste de robustez e de invenção de itens; fica em `eval/privado/` (fora do produto e da cópia pública) e os resultados guardam só as notas.
- Configuração de cada modelo: esforço de raciocínio no mínimo disponível, provedor ordenado por latência e `data_collection: deny` (revisão T-I4). Tempo-limite de 30 s por tentativa (o mesmo do produto): estourar conta como falha.
- **Linhas de base sem LLM (D128):** Tesseract + regras (OCR local) e Google Vision + regras (OCR em nuvem). **Híbrido:** Google Vision + LLM de texto barato.
- Métricas: preço exato (sobre os itens esperados), F1 de itens (nome normalizado, similaridade ≥ 0,8), categoria certa entre os pareados, JSON válido, latência p50 e custo médio por cardápio. **Nota = 0,5·preço + 0,4·F1 + 0,1·categoria** [C].

## Resultado (cardápios fictícios)

| Concorrente | Tipo | Nota | Preço exato | F1 itens | Categoria | JSON válido | p50 (s) | Custo/cardápio (US$) |
|---|---|---|---|---|---|---|---|---|
| gemini-3.1-flash-lite | visao | 1.000 | 100% | 100% | 100% | 100% | 2.4 | 0.00170 |
| gpt-6-luna | visao | 0.994 | 100% | 100% | 94% | 100% | 3.0 | 0.00025 |
| deepseek-v4.1-flash | visao | 0.994 | 100% | 100% | 94% | 100% | 1.6 | 0.00044 |
| gemini-3.8-flash (referência) | visao | 0.992 | 99% | 99% | 100% | 100% | 5.1 | 0.00452 |
| claude-haiku-5.5 | visao | 0.981 | 98% | 98% | 98% | 100% | 2.6 | 0.00093 |
| gemini-2.5-flash-lite | visao | 0.839 | 83% | 83% | 94% | 100% | 2.1 | 0.00035 |
| qwen3.8-flash | visao | 0.830 | 83% | 83% | 80% | 83% | 20.3 | 0.00059 |
| Google Vision + LLM de texto (gemini-2.5-flash-lite) | hibrido | 0.725 | 65% | 77% | 94% | 100% | 2.4 | 0.00239 |
| Tesseract + regras | ocr | 0.455 | 42% | 43% | 73% | 100% | 2.5 | 0.00000 |
| Google Vision + regras | ocr | 0.419 | 20% | 58% | 88% | 100% | 0.4 | 0.00200 |

## Nota por cardápio e a foto real

| Concorrente | boteco | burger | sushi | foto real (nota) | foto real: itens inventados |
|---|---|---|---|---|---|
| gemini-3.1-flash-lite | 1.00 | 1.00 | 1.00 | 1.00 | 0.0 |
| gpt-6-luna | 1.00 | 0.98 | 1.00 | 1.00 | 0.0 |
| deepseek-v4.1-flash | 1.00 | 0.98 | 1.00 | 1.00 | 0.0 |
| gemini-3.8-flash (referência) | 1.00 | 1.00 | 0.97 | 1.00 | 0.0 |
| claude-haiku-5.5 | 1.00 | 0.99 | 0.95 | 1.00 | 0.0 |
| gemini-2.5-flash-lite | 0.79 | 0.98 | 0.75 | 1.00 | 0.0 |
| qwen3.8-flash | 1.00 | 0.99 | 0.50 | 0.50 | 0.0 |
| Google Vision + LLM de texto (gemini-2.5-flash-lite) | 0.65 | 0.87 | 0.65 | 1.00 | 0.0 |
| Tesseract + regras | 0.21 | 1.00 | 0.15 | 0.00 | 0.0 |
| Google Vision + regras | 0.37 | 0.54 | 0.35 | 0.55 | 1.0 |

## Escolha

- **Principal: `gemini-3.1-flash-lite`** — maior nota entre os modelos de visão com p50 ≤ 15 s (a referência mais cara fica fora da escolha).
- **Reserva: `gpt-6-luna`** — melhor de outro provedor (o laço de reserva troca de provedor quando o principal falha — D53).
- Empate na nota → menor custo por cardápio. Custo total desta rodada: US$ 0.0841 (inclui o preço de tabela do Vision, coberto pela cota grátis).
- O que a IA acrescenta sobre o OCR clássico está na diferença de nota para as linhas de base: o OCR lê as letras, mas não sabe juntar nome, preço e seção quando o layout é de colunas, foto torta ou manuscrito.
