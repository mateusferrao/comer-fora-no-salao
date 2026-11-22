# Revisão da fatia S9 — Polimento pré-entrega

Data: 22/11/2026 · Base: `05985dd` (main) · Revisado: branch `claude/dreamy-cray-gg09nn` · Produção: _(preencher depois do merge)_

## 1. Resumo e veredito
A S9 nasceu de uma revisão completa do sistema (requisitos × briefing, segurança e privacidade, camada de IA × cultura iFood) e de uma revisão de toda a copy com a skill de copywriting (pedidos do candidato em 22/11). Foi implementada em 5 frentes paralelas, revisada por 4 revisores independentes (aderência ao iFood, técnica, produto/UX/copy, segurança/IA) e corrigida numa segunda rodada em 3 frentes.
Nenhum achado crítico. Todos os altos e médios foram corrigidos agora, exceto os marcados abaixo. **Pronta para merge** com a suíte verde (seção 3).

Auditorias de copy completas: [copy-cliente.md](copy-cliente.md) e [copy-portal.md](copy-portal.md). Decisões: D277–D294.

## 2. Achados consolidados (revisão independente da S9)
| # | Gravidade | Frente | Achado | Evidência | Decisão |
|---|---|---|---|---|---|
| 1 | alto | segurança/IA | Portão de escopo do assistente deixava passar 8 textos fora do escopo (poema com "mesa", SQL, inglês, receita…) | revisor de segurança, `copilot.ts` outputGate | corrigido (D286): léxico sem termos genéricos, âncora = 1 referência ou 2 termos, teto de tamanho e de palavras, padrões de código; texto da D277 corrigido ("não garante o assunto") |
| 2 | alto | produto | Landing prometia teto de custo também para o benefício de 1ª visita | `OwnerLanding.tsx` | corrigido (D294) |
| 3 | alto | aderência | Print do topo sem dizer que o efeito é simulado | legenda `text-xs` | corrigido: legenda `text-sm` "histórico gerado, efeito do convite fixado em +0,2 visita… Não é resultado medido" |
| 4 | alto | aderência | "Funciona sem o candidato" depende de passos manuais (teto de IA, recriar demo) | `/api/health`, plano | operacional: checklist de envio no relatório final (religar teto, recriar demo depois das 08:30) |
| 5 | médio | técnica/UX | Falha só de formato virava "Eu só ajudo com o seu salão" e apagava propostas válidas | `copilot-turn.ts` | corrigido: formato vai ao guard (nova tentativa); se persistir, mantém as propostas com texto do código |
| 6 | médio | técnica | Recado da IA escapava da revisão (editar durante "revisando" e aprovar) | `kit.ts` | corrigido (D285) com teste da sequência |
| 7 | médio | técnica/segurança | Limite de 64 KB com furo em 6 rotas (corpo sem content-length) | `req.json()` direto | corrigido (D287) + teste que barra `req.json()` em `app/api` |
| 8 | médio | segurança | Filtro de nome com contato/marca contornável ("11 9 87…", "@perfil", "iF00d", cirílico) | `contact-info.ts` | corrigido (D292) |
| 9 | médio | segurança | Guard de números barrava "Bar Dois Irmãos" e não pegava "na terceira visita" | `guardrails/index.ts` | corrigido (D283) |
| 10 | médio | operação | Fumaça de produção gastava a chave pública a cada deploy | `gateway-factory.ts` | corrigido (D293): contas E2E sem IA em produção |
| 11 | médio | produto/aderência | Herói não nomeava o Comer Fora; subtítulo prometia benefício a todos; "quem aceitar recebe convites" falso; "Pronto com uma foto" prometia demais; print ilegível no celular; FAQ sem indicador | landing | corrigido (D294) |
| 12 | médio | produto | Estado "cruza zero" com "garantir lucro" e sem próximo passo; antecipado com aviso escondido; metas "mesas a mais" × "não prova efeito" | `ValueHero`, `SlotGoals` | corrigido (D282) com fonte única de texto |
| 13 | médio | técnica | "Ver minha página" com `?p=` entra no A/B da versão A | `dashboard.ts` | não corrigir: trade-off registrado (D289) |
| 14 | médio | processo | Decisões da implementação e auditorias sem registro | seção O | corrigido: D282–D294 e auditorias salvas |
| 15 | baixo | técnica | "Trocar" sem alternativa mantém a oferta sem aviso | `candidates.ts` | corrigir depois (aviso no plano); registrado em D284 |
| 16 | baixo | técnica | `explainOffer` carregava o contexto inteiro | `explain-offer.ts` | corrigido: 1 select |
| 17 | baixo | UX | Validade "a partir de amanhã" quando não há janela | `textos.ts` | corrigido: "Vale até dd/mm" |
| 18 | baixo | copy | Termos duplicados (teto × limite; "da"/"de 1ª visita"; estado do plano com 3 nomes) | várias telas | corrigido |
| 19 | médio | aderência | Dado real: o restaurante vê contato de quem fez check-in na vitrine pública | D154/D237 | decisão do candidato mantida; resposta preparada e "Recriar vitrine" antes do envio |

Não procede: "a linha 'você pode ganhar um convite' contraria a §3.5" (a §3.5 pede a linha — D281).

## 3. Verificação (local)
- `tsc`, eslint (0 erros), dependency-cruiser: limpos.
- Unitários 658/658; integração 201/201; E2E completo em banco novo: 105 passaram e 2 falharam por texto antigo nos specs (porta-conta e "Hoje no salão", corrigidos e reexecutados: verdes). Uma corrida antiga no helper `startNewStore` (clicava antes de a cópia do exemplo ficar pronta) também foi corrigida.
- T4 de escopo com IA real: gemini 30/30, luna 30/30 (15 casos × 2; indicativo) — `eval/relatorio-t4-escopo.md`.
- Capturas: [landing-390.png](capturas/landing-390.png), [landing-1280.png](capturas/landing-1280.png).

## 4. Produção
_(preencher depois do merge: SHA no `/api/health`, fumaça + `*.on`, landing a 390/1280, assistente com "escreve um poema")_

## 5. Pendências fora da fatia (S7 e operação, 23/11)
- Religar o teto diário de IA (tirar `IA_SEM_TETO_DIARIO`, Restart, conferir `ia.teto: ativo`).
- "Recriar minha demo" e "Recriar vitrine" depois das 08:30 de segunda.
- Slide do processo, vídeo reserva, cópia pública (lista do que entra + `git init` novo + gitleaks; excluir `docs/contexto`, `docs/pessoal`, `referencias`, `eval/privado`, `docs/fatias/*/revisao`), preparação da entrevista técnica, currículo × portfólio ("semanal" × "quinzenal").

## 6. Decisões novas registradas
D277–D281 (candidato) e D282–D294 (IA [C]) em `decisoes-e-tradeoffs.md`, seção O.
