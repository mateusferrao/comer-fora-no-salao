# Fatia S6 — IA que opera

Status: ⏳ **a planejar** com a skill `planejar-fatia` quando for a vez dela (pedido do candidato em 21/11: "vamos planejar uma a uma quando formos fazer"). Leitura completa, perguntas ao candidato, 2 revisores independentes e aprovação antes de qualquer código.

## Escopo combinado no replanejamento de 21/11 (ponto de partida, não plano aprovado)
- **S6.1** Resumo semanal por e-mail + agendador (flags `resumo_email`, `agendador`): segunda 08:30 SP e lembrete no dia do convite; "Revisar e aprovar" por link com página de confirmação (POST, `via: email`, token de uso único amarrado ao plano); "Ver o e-mail desta semana" e "Enviar agora"; regra de recuperação e estados reservado → enviado (D163, D168).
- **S6.2** Modo garçom (flag `modo_garcom`): link com token (hash, revogável) que abre só "Validar código".
- **S6.3** Plano como agente com ferramentas (flag `plano_agente`): ferramentas só de leitura sobre os fatos, limite de passos, saída presa às candidatas, decisão por número em pares cegos (D159, D166).
- **S6.4** Porta-conta (flag `porta_conta`): peça nova no kit com QR por versão.

## Decisões que já valem para esta fatia
D151–D169 em [decisoes-e-tradeoffs.md](../../planejamento/decisoes-e-tradeoffs.md), seção M. Contexto, perguntas e a revisão independente do replanejamento estão em [../S4/planejamento.md](../S4/planejamento.md). As tabelas que a fatia usa já estão na migração 0006 (S4.1).
