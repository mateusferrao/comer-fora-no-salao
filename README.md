# Comer Fora no Salão

Protótipo de case para o processo seletivo iFood GenAI 2027 (trilha AI Builder). **Protótipo de case, não é produto oficial do iFood; dados gerados** no restaurante de exemplo. Desafio escolhido: *"faça o dono do restaurante entrar, divulgar no salão e ter mais retorno com isso."* A resposta: o salão cheio divulga o horário vazio. Um QR na mesa dá ao cliente um benefício na 1ª visita e um convite para voltar no horário em que sobra mesa; o dono ativa tudo a partir de uma foto do cardápio, recebe um plano por semana e vê, em reais, quanto a volta rendeu, medido contra um grupo de clientes que não recebe convite.

## Onde ver
- Produção: https://sites-case-salao-app.lyv8st.easypanel.host/
- Portal do dono (`/parceiro/entrar`): e-mail e um código de 6 números enviado por e-mail. O link privado do avaliador, que abre uma conta sem e-mail com um restaurante de exemplo de 60 dias de histórico, vai junto com a entrega.
- Como o protótipo funciona, o que é real e o que é gerado: `/bastidores/como-funciona` (também Qualidade da IA e Visão da plataforma).

## Arquitetura
Monólito modular em Next.js 16 (App Router) + TypeScript estrito + Postgres (Drizzle) + Vercel AI SDK pelo OpenRouter.
- `src/modules/*`: um módulo por domínio (`salao`, `beneficios`, `planos`, `onboarding`, `kit`, `analytics`, `agente`, `mcp`, `ia`, `contas`, `config`, `agendador`, `simulacao`, `textos`), cada um com `domain/` (regras puras, sem framework nem banco), `application/` (casos de uso) e, quando precisa, `adapters/`.
- `app/`: rotas e páginas (cliente em `/r/[slug]`, Portal em `/parceiro`, garçom, Bastidores, API em `app/api`).
- `src/ui`: componentes e telas; `src/db`: esquema, migrações e seed; `src/web`: sessão, guardas e utilitários HTTP.
- As fronteiras são conferidas no CI (`npm run check:boundaries`, dependency-cruiser): o domínio não importa banco, IA nem framework.
- Recursos novos ficam atrás de flags (`src/modules/config/domain/flags.ts`), que os Bastidores ligam e desligam ao vivo.

## IA
- **O sistema decide número e dinheiro.** Preço, custo, teto de convites, sorteio do grupo de controle e resultado são calculados pelo código. A IA escreve com referências (`{prato}`, `{horario}`, `{fato}`) que o código troca pelos valores.
- **A IA lê o cardápio** por foto, **escolhe entre ofertas candidatas** que o código já calculou (item × horário vazio) e **explica** a escolha; a saída passa por schema, regras fixas, revisor de outro provedor e aprovação do dono. Sem IA ou com falha, há modelo reserva e, por fim, texto modelo.
- **Assistente do salão:** o pedido do dono vira uma proposta com antes, depois e custo calculados pelo código; nada muda até o clique em "Aplicar".
- **MCP** (`/api/mcp`): um agente externo, com o token do dono, lê o plano e os números e pode propor e aplicar as mesmas mudanças.
- Avaliações em `eval/` (T1 leitura do cardápio contra OCR, T3 plano e T3 do agente com juiz cego, T4 assistente, revisor). Ganho medido: extração e texto. A escolha item × horário pela IA é hipótese a medir num piloto.

## Como rodar
Requisitos: Node 22 e Postgres 16 (nativo ou `docker compose up -d db`, que sobe `postgres://salao:salao@localhost:5432/salao`).

```bash
npm ci
export DATABASE_URL=postgres://salao:salao@localhost:5432/salao
export MAIL_TRANSPORT=memory                    # e-mails ficam em memória (sem envio)
export EVALUATOR_LINK_TOKEN=um-token-local      # abre /parceiro/acesso/um-token-local sem e-mail
export BASTIDORES_PASSWORD=uma-senha-local      # senha de /bastidores/config
npm run dev
```

- Migrações e seed rodam sozinhos quando o servidor sobe: o restaurante de exemplo nasce com 60 dias de histórico gerado pela simulação (mesmas regras do produto). `/api/health` mostra o estado do banco e do seed.
- Sem `OPENROUTER_KEY_PUBLIC` e `OPENROUTER_KEY_DEMO`, o produto roda no modo sem IA (ofertas de maior nota e textos modelo). Langfuse é opcional (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`).
- Para o cliente entrar sem código por e-mail no ambiente local, desligue a flag `login_cliente_email` em `/bastidores/config`.
- Em produção também são exigidos `SESSION_SECRET`, `PHONE_HASH_SECRET` e as variáveis do e-mail (`SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `MAIL_FROM`). A imagem é o `Dockerfile` (Next standalone).

## Testes

```bash
npx tsc --noEmit && npx eslint . && npm run check:boundaries
npx vitest run --project unit                       # ~70 arquivos, regras puras
DATABASE_URL=postgres://salao:salao@localhost:5432/salao_test npx vitest run --project integration   # ~35 arquivos, Postgres
npm run build && npx playwright test                # ~23 specs E2E, com as flags desligadas e depois ligadas
```

O CI (`.github/workflows/ci.yml`) roda os três; na `main`, com tudo verde, dispara o deploy e roda a fumaça E2E contra produção.

## Documentos
- [Especificação](docs/planejamento/especificacao.md): fonte única do produto e da técnica.
- [Decisões e trade-offs](docs/planejamento/decisoes-e-tradeoffs.md): cada decisão com alternativas, motivo e quem decidiu.
- [Índice do planejamento e status das fatias](docs/planejamento/README.md): planejamento e revisão de cada fatia (S0 a S9) em `docs/fatias/`.
- [Uso de IA na construção](docs/planejamento/notas-ia.md) e avaliações em `eval/` (relatórios `relatorio-t*.md` e resultados em JSON).
