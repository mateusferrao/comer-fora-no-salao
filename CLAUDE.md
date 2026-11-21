# Comer Fora no Salão — instruções do projeto

- Fonte única: `docs/planejamento/especificacao.md`. Decisões: `docs/planejamento/decisoes-e-tradeoffs.md` (registre toda decisão nova com alternativas, trade-offs, motivo e quem decidiu).
- Toda fatia (S0–S7) segue: skill `planejar-fatia` (com revisão independente do plano por 2 subagentes — D95) → `implementar-fatia` → `revisar-fatia`. Nada de código de produto antes do planejamento da fatia aprovado pelo candidato.
- Não inventar nem assumir informação ou decisão. **No planejamento**, na dúvida, perguntar ao candidato.
- **Autonomia depois do planejamento (D101):** com o planejamento da fatia aprovado, a IA conduz sozinha, do início ao fim, implementação → revisão (revisores + E2E) → correções → merge na `main` → deploy → E2E em produção, **sem pedir confirmação entre etapas**. Decisão que o planejamento não tomou: decidir pela especificação e pelas decisões vigentes, registrar como [C] em `decisoes-e-tradeoffs.md` e listar no relatório final da fatia. Parar só por bloqueio que só o candidato resolve (credencial, conta paga, acesso, orçamento de IA, serviço fora dos `case-salao-`) ou por ação irreversível fora do escopo da fatia.
- Commits no **branch da sessão atual** (o ambiente só permite push nele — D77); merge na `main` só ao fim da fatia, após revisão aprovada. Documentos de planejamento vão para a `main` na hora.
- Easypanel: só os serviços com prefixo `case-salao-` dentro do projeto `sites` (D100). Congelamento: 23/11/2026 às 15h.
- Nunca usar dados reais. `docs/contexto/` e `docs/pessoal/` nunca vão para a cópia pública.
