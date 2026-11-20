---
name: implementar-fatia
description: Use when implementing a slice (fatia S0–S4) of the "Comer Fora no Salão" project after its planejamento.md was approved, or when applying review fixes the candidate approved.
---

# Implementar fatia

## Visão geral

Implementa **exatamente** o que `docs/fatias/<SX>/planejamento.md` aprovou, seguindo as regras do projeto em [regras.md](regras.md). Execução **nativa**, tarefa por tarefa, com **REQUIRED SUB-SKILL: superpowers:executing-plans** (D07), **superpowers:test-driven-development** em todo domínio e caso de uso, **superpowers:systematic-debugging** em qualquer falha e **superpowers:verification-before-completion** antes de declarar algo pronto.

**Regra de ferro — autonomia (D101):** com o planejamento aprovado, você conduz a fatia **sozinho, do início ao fim** (implementação → `revisar-fatia` → correções → merge → deploy → E2E em produção), sem pedir confirmação entre etapas.
- Decisão que o planejamento não tomou: decida pela especificação e pelas decisões vigentes, registre como **[C]** em `decisoes-e-tradeoffs.md` e na seção "Mudanças durante a implementação" do planejamento da fatia, e liste no relatório final. Não invente dado, texto do app real nem regra sem fonte: use a fonte ou marque [C] com o motivo.
- Pare **só** por bloqueio que só o candidato resolve (credencial, conta paga, acesso, orçamento de IA, serviço do Easypanel fora dos `case-salao-`) ou por ação irreversível fora do escopo da fatia. Nesses casos, avance no que não depende do bloqueio e pergunte uma vez, com a recomendação.

## Quando usar
- Depois da aprovação do planejamento da fatia.
- Para as correções decididas na revisão (D10, D101). Correção que muda decisão de produto ou arquitetura: decida pela especificação, registre como [C] com alternativas e motivo, e destaque no relatório final.

## Processo
1. **Pré-voo:** leia `regras.md`, o planejamento aprovado da fatia e as interfaces das fatias anteriores. Confirme que está no branch da sessão atual (D77), nunca na `main`.
2. **Para cada tarefa, na ordem do planejamento:**
   1. Teste que falha (valores exatos do planejamento) → rode e veja falhar.
   2. Código mínimo → rode e veja passar.
   3. Refatore mantendo verde.
   4. Rode o pacote da tarefa + `npm run check:boundaries` + `npx tsc --noEmit`.
   5. Commit pequeno (mensagem convencional) e push no branch da sessão.
3. **Fim da fatia:** suíte completa (unit, integração, E2E local da fatia), lint, tipos, fronteiras — tudo verde, com a saída à vista (verification-before-completion).
4. **Registro:** atualize `docs/planejamento/decisoes-e-tradeoffs.md` se alguma decisão nova foi tomada com o candidato durante a implementação; anote no planejamento da fatia o que mudou e por quê.
5. **Entrega para revisão:** passe direto para `revisar-fatia`, sem esperar confirmação (D101). O merge na `main` só acontece depois da revisão concluída (D12).

## Sinais de alerta
| Pensamento | Realidade |
|---|---|
| "Escrevo o teste depois" | TDD é obrigatório no domínio e nos casos de uso. Teste primeiro. |
| "O planejamento não diz, escolho o mais razoável" | Pode decidir (D101), mas pela especificação, registrado como [C] e listado no relatório final. Nunca em silêncio. |
| "Vou confirmar com o candidato antes de seguir" | Depois do planejamento aprovado, não há confirmação entre etapas (D101). Só pare por bloqueio que só ele resolve. |
| "Funciona na minha máquina" | Só está pronto com a saída dos testes, lint, tipos e fronteiras à vista. |
| "Push direto na main é mais rápido" | Cada push na main é um build na VPS compartilhada. Branch da sessão. |
| "A IA quase sempre devolve certo" | Toda saída de IA passa por schema e guardrails. Sem exceção. |
| "Esse texto da tela eu improviso" | Textos exatos vêm do planejamento/prints. Os demais seguem o tom do app e são marcados [C]. |
