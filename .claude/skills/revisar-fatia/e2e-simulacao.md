# Verificação E2E profunda (simulação de uso real)

Você mesmo dirige um navegador real (Playwright + Chromium já instalados; `require('playwright')`, `chromium.launch()` sem opções) e usa o produto como cada pessoa usaria, olhando **criticamente** cada tela. Não é um teste de fumaça: é a última barreira antes de um avaliador do iFood abrir o link sozinho.

## 1. Montar a matriz de cenários (antes de rodar)
Derive do planejamento da fatia, da especificação e do case. Para cada **persona** × **caso**:
- **Personas:** dono pela conta demo (vitrine) · dono novo (criar restaurante de teste) · cliente no salão (celular) · garçom (validar código) · **avaliador sozinho** (abre o link sem explicação, em outro horário) · apresentador no modo apresentação (demo pelo Meet).
- **Casos:** caminho feliz · cada estado da fatia (vazio, carregando, erro, borda) · cada resultado de regra (ex.: 1ª visita, volta, já hoje, fora do horário, recompensa, código inválido/expirado/usado) · entradas ruins (arquivo grande, formato errado, imagem que não é cardápio, campos vazios, clique duplo, voltar/atualizar no meio) · IA forçada a falhar (modo sem IA) · limite de uso atingido · relógio fixo na data da demo (23/11/2026 17h10 em SP) e fora do horário do benefício · GPS negado, longe, tempo esgotado.
- **Telas:** 390 px (celular), 768 px e 1280 px.

## 2. Rodar cada cenário e registrar
Para cada cenário, registre na matriz: **passos · esperado · observado · evidência · veredito (ok / problema)**.
- **Capturas** em cada passo relevante (`deviceScaleFactor: 1` para análise; 2 para as que o candidato vai ver), salvas em `docs/fatias/<SX>/revisao/capturas/<cenario>-<passo>.png`.
- **Console e rede:** registre todo erro de console, requisição com falha e status ≥ 400.
- **Tempos:** tempo até a tela útil e duração das chamadas de IA.
- **Acessibilidade:** rode axe-core em cada tela; foco por teclado; Esc nos sheets; alvos ≥ 44 px.

## 3. Olhar crítico em cada tela (todas as frentes)
- **Visual e fidelidade:** compare lado a lado com `referencias/` (cores, tipografia, espaçamentos, raios, componentes, botões pretos do Comer Fora, vermelho na marca). Aponte cada diferença perceptível.
- **Textos:** exatos onde a especificação fixa; tom do app nos demais; nenhum texto técnico, inglês solto, "undefined", "NaN" ou placeholder esquecido.
- **Produto:** a tela cumpre o objetivo da persona? O próximo passo é óbvio? Métricas fazem sentido com os dados mostrados?
- **UX:** atrito, ambiguidades, estados sem saída, mensagens de erro úteis, confirmação de ações, comportamento de clique duplo e de "voltar".
- **Aderência:** barra de protótipo e simulação declarada visíveis onde devem; nenhum dado real; nada que pareça página oficial sem o aviso; "funciona sem depender do candidato".
- **Técnica:** dados persistem após atualizar a página; isolamento entre restaurantes (o dono A não vê nada do B); idempotência; nada quebra com o relógio da demo.
- **Segurança e privacidade:** PII só mascarada; nenhuma coordenada enviada; nenhuma chave no código do navegador; cabeçalhos `noindex` e CSP presentes.

## 4. Produção (depois do merge)
Repita no link público: caminho feliz completo de cada persona + todos os casos críticos/altos da fatia; confira `/api/health` com o SHA do merge; anexe o resultado à revisão.

## 5. Saída
A matriz completa vai em `revisao.md`. Cada "problema" vira achado com gravidade, evidência (captura/console) e correção proposta, no mesmo formato dos revisores.
