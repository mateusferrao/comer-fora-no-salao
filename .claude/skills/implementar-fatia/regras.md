# Regras de implementação — "Comer Fora no Salão"

Fonte: `docs/planejamento/especificacao.md`, `plano-implementacao.md` (Global Constraints) e `decisoes-e-tradeoffs.md`. Em caso de conflito, o planejamento aprovado da fatia prevalece e o conflito é registrado.

## Arquitetura (D44, D45)
- Monólito modular: `src/modules/<modulo>/{domain,application,adapters}`; telas e rotas em `app/`.
- `domain/` não importa `next`, `drizzle-orm`, `ai`, `@openrouter/*`, `src/db/**` (verificado por `npm run check:boundaries`).
- Portas e adaptadores **só** em: IA, fonte do cardápio, canal de campanha, relógio (`Clock`), repositório principal. Nada de framework de DI, filas ou CQRS.
- Rotas JSON validam entrada e saída com Zod; o restaurante vem **sempre da sessão**; consultas do dono passam por `forRestaurant`.
- Extensões por registro: tipos de benefício (estratégia), ações candidatas, tarefas de IA.

## Dados (D46)
- Drizzle + migrações versionadas; `migrate()` programático no boot.
- UTC no banco + `day_sp` (`America/Sao_Paulo`); toda data de negócio via `Clock` + `src/shared/tz.ts` (nunca `new Date()` solto no domínio).
- Eventos append-only com chave de idempotência; `simulation_run_id` nas tabelas de eventos.
- PII só em `customer_contacts`: telefone como HMAC + 4 dígitos; desde a S4, e-mail real do cliente como HMAC (`cliente-email:`) + AES-256-GCM e nome em claro (D154, D171, D173). Coordenada do cliente nunca no servidor. Foto de cardápio nunca persistida.

## IA (D51–D60)
- Modelos **só via OpenRouter**, pelo `AiGateway`; nada de chamar provedor direto.
- Toda chamada passa por `runTask` (laço de reserva, timeout por tentativa, orçamento total, rastro).
- Saída sempre validada por Zod; textos passam por `guardCopy` (referências `{fato:…}`, `{prato:…}`, `{beneficio}`, `{recompensa}`; palavras proibidas; PII).
- A IA nunca escreve números, preços, descontos ou nomes de pratos diretamente; o código substitui as referências.
- Modo sem IA em toda tarefa; exemplos com extração em cache.
- PII nunca entra em prompt (fatos agregados; público resolvido pelo código).
- Prompts: parte editável (instruções/tom) no banco, versionada; schema e guardrails no código.

## Interface e design (D38–D42, especificação 4.9)
- Componentes de `src/ui/components`; tokens de `src/ui/tokens.css`; fiel aos prints em `referencias/`.
- Responsivo em 390, 768 e 1280 px; Portal com sidebar → gaveta; App em coluna de 420 px no computador.
- Barra de protótipo em todas as páginas com o texto exato; `noindex`.
- Acessibilidade: contraste AA, foco visível e preso em sheets, Esc fecha, alvos ≥ 44 px, rótulos completos.
- Estados obrigatórios em toda tela: normal, vazio, carregando (com etapas quando IA), erro, borda.
- Textos exatos do planejamento/prints; nenhum `dangerouslySetInnerHTML` com conteúdo de IA ou usuário.
- Selo "simulado" só em ações com efeito externo falso (D22).

## Segurança e privacidade (especificação 4.6)
- Cookies assinados, httpOnly, Secure, SameSite=Lax; cookies separados de dono e cliente.
- Limites de uso (visitante, IP, global) em toda rota que chama IA ou grava.
- Uploads: ≤ 8 MB, tipos verificados por bytes, PDF ≤ 5 páginas.
- Segredos só em variáveis de ambiente; nunca em código, logs, prompts ou commits.

## Testes (especificação 4.7)
- TDD no domínio e nos casos de uso; contratos de IA com fixtures boas e ruins; integração com Postgres; E2E Playwright da fatia.
- Relógio fixo nos testes de horário (inclusive 23/11/2026 17h10 em SP).
- Rodar Playwright com `--trace off` (salvo para depurar).

## Git e deploy (D12, D62–D66)
- Commits pequenos, mensagem convencional, terminando com as linhas de atribuição da sessão.
- Push só no branch da sessão; merge na `main` só ao fim da fatia, após revisão aprovada; deploy acontece pelo CI verde.
- Antes do merge: conferir memória livre da VPS pelo conector Easypanel (só leitura).
- Depois de 23/11 às 15h: nenhum merge na `main` (congelamento).
- Flags `ab`, `revisor`, `aprende`: recurso incompleto fica desligado.

## Nunca
- Inventar dado, texto de tela, regra ou comportamento do app real que não esteja nas fontes.
- Usar dado real de restaurantes ou do iFood. Dado pessoal real só o que o próprio usuário digita no login (dono: D118; cliente: D154/D171, risco aceito pelo candidato), nunca em log, prompt, MCP ou rastro.
- Tocar serviços do Easypanel que não sejam os de prefixo `case-salao-` no projeto `sites` (D100).
