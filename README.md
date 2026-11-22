# Comer Fora no Salão

**"Encha a terça à tarde com quem lotou seu sábado à noite."**

Protótipo de case para o processo seletivo **iFood GenAI 2027 (trilha AI Builder)**. Não é produto oficial do iFood. O produto funciona de verdade (login, check-in, códigos, convites, e-mails e IA); o único dado gerado é o histórico do restaurante de exemplo.

- **Produção:** https://sites-case-salao-app.lyv8st.easypanel.host
- **Como este protótipo funciona** (dentro do app): [/bastidores/como-funciona](https://sites-case-salao-app.lyv8st.easypanel.host/bastidores/como-funciona)
- **Link do avaliador:** abre uma conta pronta, sem pedir e-mail. Vai no e-mail da entrega e não fica neste repositório.

---

## O problema
O desafio escolhido é a opção 2 do case: **"faça o dono do restaurante entrar, divulgar no salão e ter mais retorno com isso"**.

- Só **20%** dos restaurantes ativos divulgam o Comer Fora no salão. É um número **fictício** do briefing.
- O cliente que está sentado na mesa é **anônimo** para o restaurante, e o salão cheio de sábado não ajuda a terça vazia.
- O Comer Fora já tem benefício de 1ª visita, cartela de selos e benefício por dia e turno. Falta ligar o cliente de hoje à mesa vazia de amanhã, e **provar** ao dono que isso dá retorno.

**Para quem:**
- dono de restaurante parceiro com salão (usuário principal);
- o cliente no salão;
- o garçom, que valida os códigos.

## A resposta
O salão cheio vira a mídia do horário vazio:

```mermaid
flowchart LR
  A[Cliente no sábado lotado<br/>lê o QR da mesa] --> B[Check-in<br/>ganha o benefício de 1ª visita]
  B --> C[Recebe um convite para voltar<br/>terça, 15h–18h]
  C --> D[Volta na terça<br/>o garçom valida o código]
  D --> E[O dono vê em R$<br/>quanto a volta rendeu]
  B -.1 em 10 fica sem convite.-> F[Grupo de controle]
  F -.comparação.-> E
```

1. **Ativação em minutos:** o dono manda uma foto do cardápio e marca os horários vazios. O sistema monta um pacote (benefício, convite por horário, teto e custo), o dono aprova e imprime o kit com QR.
2. **No salão:** o cliente faz check-in pelo QR, ganha o benefício na hora e, depois do check-in, um convite para voltar num horário vazio. O garçom valida os códigos.
3. **Toda semana:** um plano sugere a oferta de cada horário vazio, explica a escolha e diz o que funcionou. O dono aprova, ou pede mudanças ao **Assistente do salão**, que mostra "antes → depois" e só aplica com um clique.
4. **Resultado medido:** 1 em cada 10 clientes não recebe convite. O painel compara os dois grupos e mostra a diferença em visitas e em R$, com intervalo de confiança.

| Já existe no Comer Fora | Novo aqui |
|---|---|
| Benefício de 1ª visita, cartela, benefício por dia e turno | **Convite de volta nascido na mesa**, para o horário vazio, com teto de custo |
| Configurar trilhas de marketing no Portal | **Ativação proposta:** foto do cardápio → pacote pronto → kit para imprimir |
| Resultados de campanha | **Incremento medido contra um grupo de controle**, com intervalo |
| Toqan (chat de IA do Portal, voltado ao delivery) | **Assistente do salão:** o pedido vira uma proposta conferida pelo código; nada muda sem o clique do dono |

## Como avaliar em 5 minutos
1. Abra o **link do avaliador** (no e-mail da entrega). Você entra numa conta própria com a **Cantina Nonna Lúcia**, um restaurante de exemplo com 60 dias de histórico gerado. A conta fica pronta em ~10 s.
2. **Visão geral:** a margem a mais em R$ (com intervalo), os clientes novos vindos do salão e as metas da semana.
3. **Plano da semana:** a oferta sugerida para cada horário vazio, "Por que esta oferta?" e "O que aprendemos".
4. **Assistente** (botão no menu): toque na sugestão "Trocar a oferta do convite…", veja o cartão "antes → depois" e toque em **Aplicar**.
5. **Cadastrar meu restaurante:** use um dos cardápios de exemplo, marque um horário vazio e veja o **pacote proposto** pela IA (~10 s). Ative e abra o kit.
6. **Seja o cliente:** no kit, "Testar este QR como cliente" → check-in → benefício + convite. Volte ao Portal, **Validar código** e veja o painel reagir.

O que é real e o que é gerado está detalhado em [Como funciona](https://sites-case-salao-app.lyv8st.easypanel.host/bastidores/como-funciona).

### Se algo falhar
- **O convite não apareceu depois do check-in:** esse cliente caiu no grupo de controle (1 em 10). Entre com outro e-mail; é o sistema funcionando.
- **O código não chegou por e-mail:** confira o spam. Pelo link do avaliador, o Portal não pede e-mail.
- **A IA demorou ou falhou:** o produto segue no **modo sem IA** (oferta de maior nota e texto modelo, rotulados).
- **"Preparando o restaurante de exemplo…" passou de 1 minuto:** recarregue a página.

## Onde está a IA, e onde não está
**O código decide números e dinheiro; a IA escolhe entre opções válidas e escreve.**

| A IA faz | O código faz |
|---|---|
| Lê a foto do cardápio (itens, preços, categorias) | Calcula as ofertas possíveis para cada horário vazio, o custo e o teto |
| Escolhe uma oferta entre as candidatas e casa item × horário | Sorteia o grupo de controle, emite e valida os códigos |
| Escreve o convite, a justificativa e "o que aprendemos" na voz do restaurante | Calcula o veredito de cada oferta e o incremento contra o grupo de controle |
| Entende o pedido do dono no assistente | Confere a proposta, mostra "antes → depois" e aplica só com o clique |

- **Guardrails em camadas:** schema → regras fixas (valores só por referência, palavras proibidas, escolha só entre candidatas) → revisor de outro provedor → aprovação do dono → rastro.
- **Reserva:** cada tarefa tem um modelo de outro provedor de reserva e, por fim, o modo sem IA.
- **Medido:** a IA lê cardápio muito melhor que OCR (nota 0,98–1,00 × 0,42–0,73) e escreve melhor que o texto modelo (preferida em 8 de 9 pares cegos).
- **Hipótese, não provada:** que a **escolha** de item por horário feita pela IA traga mais visitas. Isso se mede num piloto.

Detalhes: [docs/ia-no-produto.md](docs/ia-no-produto.md).

## Como medir sucesso
- **Para o iFood:** novos usuários do Comer Fora vindos do salão (1º check-in da vida feito por uma peça do kit) e % de restaurantes divulgando. Liga à meta fictícia do briefing de 2,5 → 5 milhões de usuários ativos.
- **Para o dono:** visitas e **margem incrementais** contra o grupo de controle, em 14 dias, com intervalo de 95% e 4 estados: positivo, negativo, "ainda não dá para afirmar" e amostra insuficiente.
- **Proteção:** visitas fora do horário vazio também são comparadas, para pegar a migração (o cliente só troca de horário).
- **Limites:**
  - "visitas" são check-ins;
  - um restaurante sozinho tem amostra pequena;
  - a prova estatística é um piloto com vários restaurantes (~50, número ainda sem cálculo de poder).

Na **Visão da plataforma** (Bastidores) está a conta de bolso para o iFood, rotulada como hipótese, e o custo de IA por restaurante (menos de US$ 0,01 por ativação).

## Arquitetura em uma imagem
```mermaid
flowchart LR
  U[Dono · Cliente · Garçom] --> N[Next.js 16<br/>telas + rotas]
  AG[Agente externo] -->|MCP + token do dono| N
  N --> UC[Casos de uso] --> D[Domínio puro<br/>regras testadas]
  UC --> DB[(Postgres 16)]
  UC --> IA[Porta de IA] --> OR[OpenRouter<br/>Gemini · GPT · DeepSeek]
  IA --> LF[Langfuse]
  UC --> SES[AWS SES]
```

Monólito modular com fronteiras conferidas no CI: o domínio não importa banco, IA nem framework. Detalhes: [docs/arquitetura.md](docs/arquitetura.md).

## As decisões que mais importam
1. **O valor é encher o horário vazio**, não "mais um benefício": benefício por turno já existe; o novo é o convite nascido na mesa + incremento medido (D203).
2. **Métrica contra grupo de controle** com convite fantasma (intenção de tratar), em vez de "voltaram em 30 dias" (D208, D216).
3. **O sistema propõe, o dono aprova**: pacote na ativação e plano semanal, em vez de um chat (D211).
4. **Assistente que só propõe**: cartão "antes → depois" + clique; a IA nunca escreve número (D260, D261).
5. **Um modelo por tarefa, escolhido por avaliação**, com reserva de outro provedor; o assistente de IA da construção declarou conflito de interesse (D51).
6. **OCR medido, não suposto**: perdeu para os modelos de visão (D128).
7. **Sem LangChain/LangGraph**: chamadas com schema e humano no meio como estado no banco (D215).
8. **Contato de cliente nunca vai à IA**: ela vê só primeiro nome + inicial (D262).
9. **Operável por agentes (MCP)**, inclusive para aprovar e aplicar, com token por restaurante — escolha do candidato contra a recomendação da IA (D219, D269).
10. **Cada conta com a própria cópia** do restaurante de exemplo e **link do avaliador**: ninguém mexe na conta de outro (D119, D126).

As ~20 principais, com alternativas e trade-offs: [docs/decisoes-principais.md](docs/decisoes-principais.md). Todas as 322: [docs/planejamento/decisoes-e-tradeoffs.md](docs/planejamento/decisoes-e-tradeoffs.md).

## O que dá para mudar sem deploy
- **Bastidores › Configurações** (senha): liga e desliga recursos por flag (A/B, revisor, plano como agente, assistente, MCP, agendador…) e edita o bloco de instruções e tom de cada prompt, com "testar com exemplo" e "voltar versão". O schema e os guardrails ficam no código.
- **Configurações do restaurante:** benefício, horários vazios, teto, cartela, tom da IA, avisos e automação.
- **Assistente do salão** e **agentes pelo MCP:** pedidos em português viram mudanças conferidas pelo código.

## Como o escopo foi priorizado (80/20)
- **Primeiro o fluxo integral:** QR → benefício + convite → validação → volta → painel. Depois os guardrails e o modo sem IA. Depois o plano da semana com IA e as avaliações. Por último os extras (A/B, revisor, MCP, assistente).
- **Tudo novo nasceu atrás de uma flag**, com horário de corte: o que não estivesse testado ficaria desligado.
- **Ficou de fora de propósito:** avaliações de restaurante, reservas, fila, WhatsApp/push reais e login iFood real.

## Linha do tempo
| Data | O quê |
|---|---|
| 19/11 | Leitura do case, recorte, especificação e 5 revisões independentes do plano; fundação (S0) e 1º deploy |
| 20/11 | Replanejamento por diferenciação; domínio e cliente (S1); Portal, ativação com IA e kit (S2); painel, plano da semana e Bastidores (S3) |
| 21/11 | Produto real e identidade (S4), valor e conversão (S5), IA que opera (S6), Assistente do salão e MCP (S8) |
| 22/11 | Revisão completa e de textos (S9); entregáveis e documentação (S7) |

## Privacidade
- **Login:** dono e cliente entram com o próprio e-mail e um código de 6 dígitos, com aceite explícito.
- **Guarda do e-mail:** HMAC (para achar a conta) + AES-256-GCM.
- **Contato nunca vai para** log, prompt de IA, MCP ou rastro.
- **Apagar:** o cliente apaga tudo em "Sua jornada" › "Apagar meus dados".
- **No restaurante de exemplo:** os contatos são fictícios (`exemplo.invalid`, DDD 00).
- **Riscos aceitos e declarados em "Como funciona":**
  - o protótipo recebe dados reais de quem testa;
  - os interruptores de comunicação vêm ligados; em produção, a LGPD pede consentimento ativo.

## Como rodar localmente
Requisitos: Node 22 e Postgres 16 (nativo ou `docker compose up -d db`).

```bash
npm ci
export DATABASE_URL=postgres://salao:salao@localhost:5432/salao
export MAIL_TRANSPORT=memory                    # e-mails ficam em memória
export EVALUATOR_LINK_TOKEN=um-token-local      # abre /parceiro/acesso/um-token-local sem e-mail
export BASTIDORES_PASSWORD=uma-senha-local
npm run dev
```

- Migrações e seed rodam sozinhos quando o servidor sobe: o restaurante de exemplo nasce com 60 dias de histórico gerado pelas mesmas regras do produto.
- Sem as chaves do OpenRouter (`OPENROUTER_KEY_PUBLIC`, `OPENROUTER_KEY_DEMO`), tudo roda no modo sem IA. Langfuse é opcional.
- Em produção também são exigidos `SESSION_SECRET`, `PHONE_HASH_SECRET` e as variáveis do e-mail (`SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `MAIL_FROM`).

### Testes
```bash
npx tsc --noEmit && npx eslint . && npm run check:boundaries
npx vitest run --project unit                       # ~660 testes de regras puras
DATABASE_URL=postgres://salao:salao@localhost:5432/salao_test npx vitest run --project integration   # ~200, contra Postgres
npm run build && npx playwright test                # 23 specs E2E, com axe
```

O CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda tudo isso. Na `main`, só com tudo verde, dispara o deploy e roda uma fumaça E2E contra produção.

## Documentação
- [Como ler a documentação e glossário](docs/README.md)
- [Decisões principais](docs/decisoes-principais.md) · [Arquitetura](docs/arquitetura.md) · [IA no produto](docs/ia-no-produto.md) · [Como foi construído com IA](docs/processo-com-ia.md)
- [Especificação](docs/planejamento/especificacao.md) (fonte única) · [Todas as decisões](docs/planejamento/decisoes-e-tradeoffs.md) · [Avaliações](eval/)

O logo e o visual do iFood aparecem no protótipo só para que ele pareça uma extensão do app, como pede o case. A marca é do iFood; este repositório não tem relação oficial com a empresa.
