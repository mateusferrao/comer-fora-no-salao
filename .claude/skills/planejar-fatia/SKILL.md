---
name: planejar-fatia
description: Use when starting any slice (fatia S0–S4) of the "Comer Fora no Salão" project, or when a review finding changes a product or architecture decision — before writing any code for that slice.
---

# Planejar fatia

## Visão geral

Toda fatia do projeto começa aqui. O objetivo é chegar a um **planejamento da fatia aprovado pelo candidato**, construído com leitura completa do contexto, análise profunda e **discussão crítica por perguntas**. Nada é assumido nem inventado: se uma informação não está nas fontes, pergunte.

**Regra de ferro:** nenhuma linha de código de produto da fatia antes de o candidato aprovar o documento `docs/fatias/<SX>/planejamento.md`.

## Quando usar
- Início de cada fatia (S0, S1, S2, S3, S4).
- Quando uma correção da revisão muda uma decisão de produto ou de arquitetura (D10).
- Não usar para correções pontuais já decididas: essas vão direto para `implementar-fatia`.

## Processo

### 1. Leitura completa (obrigatória, sem atalhos)
Leia inteiro, nesta ordem, e anote o que é relevante para a fatia:
1. `docs/planejamento/especificacao.md` (fonte única) e `docs/planejamento/plano-implementacao.md` (a fatia e as vizinhas).
2. `docs/planejamento/decisoes-e-tradeoffs.md` (decisões vigentes; não reabra sem motivo forte e explícito).
3. `docs/planejamento/00-contexto-problema-recorte.md` e `docs/planejamento/revisoes.md`.
4. `docs/contexto/resumo-case.md`, `docs/contexto/emails.md`, `docs/contexto/resumo-cultura.md` (requisitos, regras, critérios de avaliação, cultura).
5. Planejamentos e revisões das fatias anteriores em `docs/fatias/` (achados abertos, dívidas, decisões novas).
6. O código e os testes existentes que a fatia toca (estado real, não o planejado).
7. Referências visuais em `referencias/` (versionadas só no repositório privado; ver `referencias/README.md`), quando a fatia tem tela.

### 2. Análise profunda
Escreva para si, antes de perguntar:
- **Requisitos da fatia** → de onde vêm (especificação, case, decisão) → como serão provados (teste/E2E).
- **Lacunas:** o que as fontes não dizem e a fatia precisa saber.
- **Conflitos:** entre especificação, plano, decisões e código real.
- **Riscos:** técnicos, de produto, de UX, de prazo, de aderência ao case e ao iFood, de segurança/privacidade, da demo ao vivo.
- **Dependências:** interfaces que a fatia consome e produz.
- **Opções** para cada ponto em aberto, com trade-offs e uma recomendação.

### 3. Discussão crítica com o candidato
- Cubra **todas as frentes**: produto e funcionalidade · design, UX, usabilidade e acessibilidade · técnica, arquitetura e padrões · dados · IA e guardrails · segurança e privacidade · testes e operação · aderência ao case e ao iFood (cultura, valores, AI-first, negócio).
- **Uma pergunta por vez** (ou um lote pequeno e independente), com: o que você encontrou, por que importa, as opções concretas, os trade-offs de cada uma e a sua recomendação. Use a ferramenta de perguntas.
- Seja **crítico**: aponte fraquezas do próprio plano, questione premissas, traga o "e se" (estados de erro, bordas, demo ao vivo, avaliador sozinho).
- Pergunte só o que muda o que será construído; o resto vira proposta sua marcada **[C]**, que o candidato pode corrigir.
- Se o candidato pedir explicação, explique de forma mais clara antes de pedir a decisão.

### 4. Revisão independente do plano (obrigatória — D95)
Com as decisões fechadas e o plano escrito (rascunho), **antes de pedir a aprovação**:
- Lance **2 subagentes em paralelo**, sem acesso à conversa e sem receber as suas conclusões como verdade:
  1. **Técnico (back-end + front-end + infra):** arquitetura, contratos/interfaces consumidos pelas fatias seguintes, dados, IA e guardrails, versões reais das bibliotecas, build/deploy/CI, testes que provam o que dizem, ordem das tarefas e tempo.
  2. **Produto (produto + UX/design + aderência ao case e ao iFood):** critérios do case, demo ao vivo, fidelidade aos prints de `referencias/`, acessibilidade, riscos de marca/privacidade, decisões tomadas como [C] que deveriam ser do candidato, qualquer coisa inventada sem fonte.
- Cada um lê **inteiro** o plano e as fontes (especificação, plano de implementação, decisões, contexto do case, regras de implementação, prints relevantes) e entrega achados por severidade (bloqueante / importante / menor) com **evidência, impacto e correção**, separando fato verificado de suspeita. Revisores só leem: nada de editar arquivos.
- **Filtre criticamente:** confira os fatos citados (versões de pacote, cores, trechos) antes de aceitar. Correções técnicas sem efeito em produto entram como [C]; **o que muda decisão volta ao candidato por pergunta**, com a evidência nova e uma recomendação.
- Registre o resultado na seção "Revisão independente do plano" do documento da fatia (achado → destino).

### 5. Documento da fatia
Crie `docs/fatias/<SX>/planejamento.md` usando [template-planejamento.md](template-planejamento.md). Ele deve permitir implementar sem voltar ao candidato.

### 6. Registro e aprovação
- Acrescente cada decisão nova a `docs/planejamento/decisoes-e-tradeoffs.md` (alternativas, trade-offs, motivo, quem decidiu).
- Atualize `plano-implementacao.md` se tarefas, interfaces ou testes mudaram; e o log `docs/planejamento/log-conversa-ia.md`.
- Peça aprovação explícita do documento. Com a aprovação: commit + push na `main` (documentos vão na hora — D12).
- Só então passe para `implementar-fatia`. **A partir da aprovação, a fatia corre sem novas confirmações até o fim da revisão e da E2E em produção (D101).** Por isso, a discussão do planejamento é o momento de fechar tudo que é do candidato.

## Sinais de alerta
| Pensamento | Realidade |
|---|---|
| "Já li isso antes, pulo a leitura" | A fatia anterior pode ter mudado decisões. Leia de novo. |
| "Isso é óbvio, decido sozinho" | Se muda o que é construído, é do candidato. Pergunte. |
| "Vou supor o comportamento do app real" | Só o que está nos prints/fontes. O resto é hipótese declarada ou pergunta. |
| "Pergunto tudo de uma vez" | Lotes grandes viram respostas rasas. Uma por vez, com recomendação. |
| "O plano já diz, não preciso criticar" | O plano é ponto de partida. Procure o que ele erra. |
| "As decisões estão fechadas, pulo a revisão independente" | Na S0 ela achou 5 bloqueantes e 2 decisões tomadas com premissa errada. Sempre rode os 2 revisores. |
| "O revisor disse, então é fato" | Revisor também erra. Confira a evidência antes de aceitar ou de levar ao candidato. |
