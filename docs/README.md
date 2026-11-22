# Como ler esta documentação

## Por onde começar, conforme o seu tempo
| Você tem… | Leia | O que você leva |
|---|---|---|
| **5 minutos** | [README](../README.md) | O problema, a solução, como testar, o que é real e o que é gerado, onde está a IA |
| **20 minutos** | [Decisões principais](decisoes-principais.md) → [IA no produto](ia-no-produto.md) | As 18 escolhas que definem o produto, com alternativas e trade-offs; o que foi medido e o que é hipótese |
| **Perfil de engenharia** | [Arquitetura](arquitetura.md) → código de `src/modules/*/domain` → [testes](../tests) | Módulos, fluxo de dados, métrica, segurança, CI e deploy |
| **Perfil de produto** | [Especificação §1–§3 e §9](planejamento/especificacao.md) | Diagnóstico, hipóteses, árvore de métricas, cada tela, roadmap |
| **Como foi feito com IA** | [Processo com IA](processo-com-ia.md) → [log da conversa](planejamento/log-conversa-ia.md) | Método, prompts e como evoluíram, ferramentas e por quê, riscos, onde o candidato mudou o rumo da IA |
| **Tudo, em ordem** | [Índice do planejamento](planejamento/README.md) | Planejamento e revisão de cada fatia (S0 a S9) |

## Mapa dos documentos
```
README.md                      ← comece aqui
docs/
├── README.md                  ← este arquivo: como ler e glossário
├── decisoes-principais.md     ← as 18 decisões que importam
├── arquitetura.md             ← módulos, fluxo, dados, segurança, CI
├── ia-no-produto.md           ← tarefas de IA, guardrails, custo, avaliações
├── processo-com-ia.md         ← como foi construído com IA (prompts, APIs, riscos)
├── entrega/                   ← slide do processo e apresentação (PDF e PPTX)
├── planejamento/
│   ├── especificacao.md       ← fonte única do produto e da técnica
│   ├── decisoes-e-tradeoffs.md← todas as decisões (~320), uma a uma
│   ├── 00-contexto-problema-recorte.md ← leitura do enunciado, recorte, pesquisa pública
│   ├── log-conversa-ia.md     ← a conversa com a IA, item por item
│   ├── notas-ia.md            ← avaliações de modelo, com custo
│   ├── revisoes.md            ← revisões independentes do planejamento inicial
│   └── notas-infra.md         ← deploy, rollback, tempos
└── fatias/S*/                 ← planejamento e revisão de cada fatia
eval/                          ← avaliações T1, T3, T4 e do revisor (relatórios + resultados)
```

## Legenda usada nos documentos
| Marca | Significado |
|---|---|
| **[B]** | Vem do briefing do case (os números do briefing são **fictícios**, como o próprio briefing avisa) |
| **[P]** | Pesquisa pública (com a fonte citada) |
| **[O]** | Observado no app ou no Portal do iFood (prints usados só como referência visual, não publicados) |
| **[H]** | Hipótese declarada, ainda não provada |
| **[C]** | Decisão tomada pelo assistente de IA durante a implementação, aberta a correção do candidato |
| **U** / "candidato" | Decisão do candidato |
| **Dxxx** | Número da decisão em [decisoes-e-tradeoffs.md](planejamento/decisoes-e-tradeoffs.md) |
| **S0…S9** | Fatias da construção (cada uma com planejamento aprovado e revisão) |

## Glossário
| Termo | O que quer dizer aqui |
|---|---|
| **Horário vazio (faixa)** | Dias e horas em que o restaurante tem mesa sobrando, marcados pelo dono. Ex.: "Ter, Qua, Qui · 15h–18h" |
| **Benefício de 1ª visita** | O que o cliente ganha na hora, no 1º check-in (ex.: uma sobremesa). Vale em qualquer horário |
| **Convite de volta** | Oferta para voltar num horário vazio, mostrada logo depois do check-in. Faixa e validade ficam congeladas quando o convite nasce |
| **Teto semanal** | Quantos convites cada faixa pode emitir por semana. Limita o custo do restaurante |
| **Grupo de controle (holdout)** | 1 em cada 10 clientes que poderiam receber convite e não recebem. É a base para medir a volta **a mais** |
| **Convite fantasma** | O convite invisível do grupo de controle, com as mesmas datas, para os dois grupos começarem a contar no mesmo dia |
| **Intenção de tratar** | Comparar os grupos como foram sorteados, use o cliente o convite ou não |
| **Incremento** | Diferença de visitas (e de margem em R$) entre convidados e grupo de controle em 14 dias, com intervalo de 95% |
| **Migração** | Quando o convite só troca o cliente de horário (sai do sábado, vem na terça). Medida à parte |
| **Candidatas** | As 2–3 ofertas válidas que o código calcula para cada horário vazio. A IA escolhe uma delas |
| **Veredito** | Manter, trocar ou "cedo demais" para cada oferta da semana anterior. Calculado pelo código; a IA só explica |
| **Plano da semana** | A sugestão semanal de oferta por horário vazio, com justificativa e "o que aprendemos". Só vale com a aprovação do dono |
| **Pacote proposto** | O 1º plano, montado na ativação a partir do cardápio e do que o dono informou |
| **Kit** | Peças impressas: display de mesa e cartaz (com QR, em 2 versões para teste A/B) e cartão do garçom |
| **Restaurante de exemplo ("vitrine")** | A Cantina Nonna Lúcia, com 60 dias de histórico **gerado** por simulação. Cada conta ganha uma cópia própria e editável |
| **Link do avaliador** | Link privado, enviado com a entrega, que abre uma conta pronta sem pedir e-mail |
| **Modo sem IA** | Funcionamento sem chamar modelos: oferta de maior nota e textos modelo, rotulados |
| **Assistente do salão (copiloto)** | O dono pede em português; a IA devolve uma proposta "antes → depois" que o código confere; só o clique aplica |
| **MCP** | Protocolo que deixa agentes de IA externos (Claude, ChatGPT…) usarem as mesmas operações do Portal, com o token do dono |
| **Bastidores** | Páginas públicas que explicam o protótipo (Como funciona, Qualidade da IA, Visão da plataforma) e a configuração protegida por senha |
| **Flag** | Interruptor que liga ou desliga um recurso ao vivo, sem deploy |
