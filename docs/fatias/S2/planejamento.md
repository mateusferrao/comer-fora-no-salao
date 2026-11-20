# Planejamento da fatia S2 — Portal, ativação proposta com IA, kit, validação e configurações

Status: **aprovado em 20/11/2026 pelo candidato** (revisão independente do plano incorporada — seção 11).

> **Contexto.**
> - **Ponto de partida:** a S1 está no ar (`cf07d32`), com o domínio do check-in, o esquema v2, as telas do cliente e a vitrine de 60 dias, mas sem IA no núcleo.
> - **O que a S2 traz:** o **lado do dono**, com a IA no centro:
>   - entrar no Portal com e-mail real;
>   - foto do cardápio → itens, com o modelo escolhido por medição (T1);
>   - salão e horários vazios;
>   - **pacote proposto**: o código monta as candidatas e a IA escolhe casando item × turno e escreve o convite;
>   - aprovar e ativar;
>   - **kit** com QR por peça e versão;
>   - **Validar código**;
>   - **Configurações**, para editar tudo depois.
> - **Fontes:**
>   - especificação v2 §3.1–3.4, 4.3–4.6;
>   - plano de implementação (S2);
>   - D51–D60, D201–D224, D101–D116;
>   - dívidas das revisões da S0 e da S1.
> - **Decisões do candidato nesta conversa:** D117–D129.

## 1. Objetivo e entrega testável
Ao fim da S2, em produção:
1. **Entrada no Portal.**
   - O dono entra com **e-mail real + código de 6 dígitos (AWS SES)**, numa tela igual ao portal/01.
   - Há também o **link privado do avaliador**.
   - Cada conta ganha a **própria cópia da vitrine** (60 dias), editável.
2. **Assistente ("Criar meu restaurante").**
   - O cardápio entra por foto, PDF convertido em imagem no navegador, 1 de 3 exemplos fictícios em cache, ou "Importar do delivery (simulado)".
   - Em seguida: salão e horários vazios → revisão → **pacote proposto** com o "agora", a recompensa e o convite por faixa, cada um com custo, teto, justificativa e texto da IA (ou o modo sem IA rotulado).
   - O dono ajusta, aprova e **ativa**.
3. **Kit:**
   - display e cartaz, cada um com 2 versões e QR próprio;
   - cartão do garçom;
   - edição, regeneração de campo e aprovação;
   - impressão (A5/A4/¼ A4) e marcação "no salão".
4. **Cliente:** o QR do kit leva ao restaurante do dono. O 2º card mostra o **texto do convite da IA aprovado pelo dono**, e o holdout não vê nada.
5. **Validar código:** reconhece os 3 tipos, confirma uma vez só e mostra o motivo quando recusa.
6. **Configurações:** edita tudo. Cada mudança cria uma nova versão, e os convites já emitidos não mudam.
7. **Limites de uso** persistidos, no lugar dos limites em memória da D115.
8. **T1 medida:**
   - 8 modelos de visão e 3 linhas de base (Tesseract + regras, Vision + regras, Vision + LLM de texto);
   - o modelo da extração sai por número, com o processo documentado.
9. **Prova:**
   - testes de unidade e integração (Vitest);
   - Playwright local e em produção (390/1280 px, axe);
   - CI verde e health com o SHA.

## 2. Requisitos e rastreabilidade
| Requisito | Fonte | Como será provado |
|---|---|---|
| Login por e-mail real + código; conta por pessoa | D118 | integração: 5 erros bloqueiam; código vencido; e-mail só HMAC; E2E com token (D123) |
| Link privado do avaliador | D126 | integração: link válido cria conta nova; inválido → 404; limite diário |
| Cópia da vitrine por conta, isolada e idêntica à original | D119 | integração: 2 contas → 2 restaurantes com as mesmas contagens e o mesmo IC; dono A não lê nem valida B |
| Sessão do dono; restaurante sempre da sessão | 3.6, 4.6 | `forRestaurant` com testes A × B (código, kit, configurações, extração) |
| Limites persistidos | 4.3, D115 | `consume` com 20 chamadas paralelas e limite 10 → 10 ok |
| Guardrails (referências, dígitos fora de referência, palavras proibidas, PII, tamanho) | 4.4, D54 | casos bons e ruins, inclusive "Pizza 4 queijos" por `{prato:id}` |
| Extração: PDF → imagem no navegador; imagem nunca gravada; validação no código | 3.2, D50, D127 | HEIC, > 8 MB, "não é cardápio", > 5 páginas; preço implausível sinalizado |
| T1 medida, processo documentado | D51, D117, D128, D129 | `eval/relatorio-t1.md`, `notas-ia.md`, decisão registrada |
| Candidatas válidas, nota econômica, sem repetir o "agora" | 3.7, D121 | unidade com os números da vitrine (seção 7) |
| Tarefa 3: escolha ∈ candidatas; 1 escolha por faixa; modo sem IA | 3.7, D206 | guard reprova; gateway falho → sem IA rotulado |
| Pacote = 1º plano (`weekly_plans` aprovado) + versões | 3.2, D205 | ativar 2× → 1 `activated_at`, 1 plano, versões v1 |
| Texto do convite no 2º card (só convidável) | D122 | E2E: texto aparece; holdout não |
| Kit não contamina o holdout (peças, recado, garçom) | 3.4, D223 | teste: sem item, dia ou horário do convite em peça e recado |
| Validar código (3 tipos), idempotente | 3.3 | confirmar 2× → 1 efeito; convite → `usado` |
| Configurações versionadas | D120, D218 | nova oferta não altera o convite emitido; item inativo ainda descreve versões antigas |
| Ativação retomável e abandono por passo | 3.2, H5 | recarregar no passo 3 volta ao 3; eventos por passo |
| Dívidas S0 #13/#14/#26 e S1 #23 | revisões | `NavItem`, `Badge outline-red`, primitivos, `data_collection: deny`, IA no núcleo |

## 3. Decisões desta fatia
| ID | Decisão | Alternativas | Trade-off | Motivo | Quem |
|---|---|---|---|---|---|
| D117 | **T1 já na S2**, antes de ligar a extração; **processo e motivo documentados** (`eval/relatorio-t1.md`, `notas-ia.md`, slide) | par do spike agora, medir na S3 | ~1–2 h e < US$ 0,30 × modelo medido no "uau" | D51 | U |
| D118 | **Login por e-mail real + código de 6 dígitos via AWS SES** (fora do sandbox, subdomínio novo); **tela idêntica ao portal/01** | código simulado; tela sem a marca | dado pessoal, dependência do SES e risco antiphishing × login de verdade e conta por pessoa; riscos ouvidos (revisores) e aceitos | escolha do candidato | U |
| D119 | **Cada conta ganha a própria cópia da vitrine** (60 dias, mesmos números), editável; a original fica só para "Sou cliente" | vitrine única só leitura ou editável por todos | ~3–5 s e ~15 mil linhas por conta, limpeza em 7 dias × isolamento total | conta pessoal | U |
| D120 | **Configurações na S2: depois da IA, tudo editável** | só no assistente | +2–3 h × controle do dono (D206) | pedido do candidato | U |
| D121 | **Nota da candidata só econômica; a IA escolhe item × turno**; o modo sem IA usa a maior nota | nota com item × turno | escolha da IA conta × linha de base sem esse critério | IA decide algo real entre opções válidas | U |
| D122 | **Texto do convite da IA (aprovado) também no 2º card**; dias, horário, oferta e validade vêm do código | só Portal e reativação | IA no cliente × aprovação e guardrails antes | IA visível no produto | U |
| D123 | **`E2E_LOGIN_TOKEN`** libera o login dos e-mails de teste `e2e-dono+N@exemplo.invalid` no E2E (devolve o código sem enviar); o candidato grava no Easypanel e no GitHub | E2E do dono só local | segredo a mais × fluxo provado em produção | D91 | U |
| D124 | **S2 sem corte**; a ordem protege o núcleo (seção 12). O que não couber até a manhã de 22/11 vai para a S3, registrado | corte agora | — | escolha do candidato | U |
| D125 | **Texto do convite editado pelo dono: livre, só com aviso** (números, "%", "R$", "grátis", "desconto" geram aviso, não bloqueio) | bloquear números e preços (recomendado pelos 2 revisores) | liberdade × risco de promessa diferente da regra (o garçom recusa) | escolha do candidato | U |
| D126 | **Link privado do avaliador** (`/parceiro/acesso/<token>`), enviado junto com a entrega do case: abre uma conta própria sem e-mail, com a cópia da vitrine; sem botão público | só e-mail | segredo a mais × avaliador não fica preso se o SES ou um filtro de e-mail falhar | revisão de produto (B1) | U |
| D127 | **PDF sempre convertido em imagem no navegador** (pdf.js, até 5 páginas, carregado só quando há PDF) | PDF direto aos modelos que aceitam | ~1 MB carregado sob demanda e camada de texto perdida × entrada igual para todos os modelos, contagem de páginas confiável, PDF não sai do aparelho | ideia do candidato | U |
| D128 | **OCR só como linha de base da T1** (fora do produto): Tesseract + regras, Google Vision + regras e **Vision + LLM de texto (híbrido)**. Credencial `GOOGLE_VISION_CREDENTIALS` (service account) no Easypanel, lida pelo conector só para a T1 | OCR primeiro com IA de reserva no produto; sem OCR | chave privada passa pelo histórico da sessão (aceito) × prova com número quanto a IA acrescenta | IA onde faz sentido, medida | U |
| D129 | **Modelos da T1:** gemini-2.5-flash-lite (linha de base do spike), gemini-3.1-flash-lite, gpt-6-luna, deepseek-v4.1-flash, claude-haiku-5.5 (conflito declarado), qwen3.8-flash, gemini-3.8-flash (referência de qualidade) | incluir gpt-5-nano (expira 11/12) e muse-ember | — | levantamento sem viés, preços conferidos em 20/11 | U |
| D130 | Itens [C] desta fatia (seção 13) | — | — | detalhes técnicos e de produto | IA [C] |

## 4. Produto e fluxos

### 4.1 Personas e caminhos
- **Avaliador ou dono:**
  - "/" → "Sou dono: abrir Portal" → `/parceiro/entrar` → código → no 1º acesso, "Preparando seu restaurante de demonstração…" (cópia) → Início da cópia;
  - **ação principal** no Início: "Criar meu restaurante" → assistente → kit → "Abrir este QR" → check-in → validar.
- **Avaliador pelo link privado:** `/parceiro/acesso/<token>` → conta nova (sem e-mail) → o mesmo caminho.
- **Garçom:** outro aparelho → mesmo e-mail → código → escolhe o restaurante → **Validar código**. Isso expõe a caixa de e-mail do dono; está declarado, e o "modo salão" fica no roadmap.
- **Cliente:** QR do kit → `/r/<slug>?p=<token>`. O fluxo é o da S1, com o texto da IA no 2º card.

### 4.2 Login (D118, D126)
**`/parceiro/entrar`, igual ao portal/01:**
- logo, "Portal do Parceiro", "Gerencie sua loja de forma fácil e rápida";
- `Field` "E-mail" com placeholder "nome@email.com.br", `type=email`, `autocomplete="email"`;
- botão "Avançar";
- erro de campo vazio: "Preencha os campos destacados para prosseguir." (texto do print);
- formato inválido: "Use um e-mail válido" [C];
- nota [C]: "Protótipo de case: usamos seu e-mail só para enviar o código. Guardamos apenas um código irreversível dele (HMAC). Contas sem acesso por 7 dias são apagadas."

**`/parceiro/entrar/codigo`** (textos [C], não existem nos prints):
- "Digite o código de 6 dígitos que enviamos para m•••@d•••.com";
- campo com `inputmode=numeric` e `autocomplete="one-time-code"`;
- "Reenviar código" liberado depois de 60 s (só o fim da contagem é anunciado);
- "Usar outro e-mail".

**Código:**
- 6 dígitos (`secureRandInt`), 10 min, uso único, até 5 tentativas;
- guardado como HMAC; um código novo invalida o anterior.

**Conta:**
- `owners.email_hmac`: HMAC-SHA256 com o `SESSION_SECRET` e a finalidade `email:` [C];
- `email_hint` mascarado;
- **o e-mail em claro nunca é gravado nem logado**; só vai ao SES no envio.

**Sessão:**
- `cf_dono` = `signValue("dono:"+ownerId)`, httpOnly, Secure por protocolo, Lax, 30 dias;
- `cf_loja` (`loja:`) guarda o restaurante atual, sempre conferido contra o dono;
- `getOwnerSession` confere se o dono existe e atualiza `last_seen_at` no máximo 1 vez por hora;
- "Sair" apaga os cookies.

**E-mail [C]:**
- assunto "Seu código de acesso: 123456 · Comer Fora no Salão (protótipo de case)";
- texto puro + HTML simples, **sem logo e sem link**, com o aviso "protótipo de case, não é produto oficial do iFood; se não foi você, ignore";
- `MAIL_FROM` com nome de exibição codificado (RFC 2047, porque tem "ã").

**Transporte:**
- SES pela API v2 (`POST https://email.{SES_REGION}.amazonaws.com/v2/email/outbound-emails`, SigV4 via `aws4fetch`);
- `MAIL_TRANSPORT=memory` só explícito (CI e local);
- em produção sem as variáveis do SES: erro claro e `mail: "ausente"` no health (só o estado).

**Link do avaliador (D126):**
- `EVALUATOR_LINK_TOKEN` gerado e gravado pela IA no Easypanel, nunca ecoado;
- cada abertura válida cria uma conta nova (`email_hint` = "acesso por link"), com limite de 20/dia;
- comparação em tempo constante; o token errado devolve 404 com o mesmo tempo;
- o link vai no envio do case (S4) e nunca para o repositório público.

**Erros:**
- código errado: "Código incorreto. Restam N tentativas";
- vencido: "Código expirado. Peça outro";
- limite: "Muitas tentativas. Tente de novo em N min";
- falha do SES: "Não conseguimos enviar o código agora. Tente de novo em instantes." (log com `safeErr`, sem o e-mail).

### 4.3 Cópia da vitrine (D119)
Correção do bloqueante técnico B1: com a mesma semente, o simulador gera os mesmos UUIDs (`generator.ts:129/233`), e a 1ª cópia violaria `customers_pkey`. Por isso a cópia funciona assim:
1. **Simula** com o `VITRINE_ID` e os tokens originais, então o sorteio de grupo (`assignArm`) é idêntico e os números batem com a original.
2. **Grava remapeando:** `restaurantId` → id da cópia, e todo id gerado → `uuidFrom(hash(copyId:idOriginal))`. Isso vale para clientes, contatos, convites, check-ins, códigos (`checkin_id`/`invite_id`), membros de envio, leituras e faixas. Tokens viram `<token>-<sufixo>`, e o telefone simulado usa o prefixo `sim:<runIdDaCópia>:`.
3. `vitrineSpec(opts)` e `vitrineHistory(tokens)` passam a receber parâmetros.

**Demais regras:**
- **Restaurante da cópia:** slug `cantina-nonna-lucia-<6>`, `kind=vitrine`, `protected=false`, `copied_from` (sem FK).
- **Estado e execução:** `restaurants.setup_status` (`criando|pronta|falhou`) + `setup_started_at`. Mais de 120 s em `criando` passa a `falhou`, com "Tentar de novo". Roda no `getSeedDb()` (1 conexão, 120 s), o que **serializa** as cópias. Tempo medido na VPS.
- **Sem cópia** (falhou ou criando): o Início mostra "Criar meu restaurante", e a cópia aparece quando ficar pronta.
- **Quantidade e versões:** 1 cópia por conta; o "resetar demo" (S3) recria. Uma versão nova do seed não recria as cópias [C].
- **Limpeza "de carona":** no login, no máximo 2 contas por vez, fora do caminho da resposta. Apaga contas com `last_seen_at` de mais de 7 dias que têm `email_hmac` ou entraram pelo link, poupando donos de restaurantes `protected`.

### 4.4 Assistente de ativação — `/parceiro/salao/ativar/[passo]`, retomável
- `restaurants.onboarding_step` guarda o passo; `onboarding_events` registra entrou e saiu (H5).
- Endereço fictício padrão do restaurante de teste: "Rua Exemplo Fictícia, 100 – São Paulo – SP" [C].
- O assistente tem 5 passos.

**1. Cardápio do salão**
- **Entradas:**
  - "Enviar foto ou PDF": JPG, PNG, WEBP ou PDF. HEIC → "Formato não suportado: tire um print ou exporte como JPG".
  - **3 exemplos fictícios:** "Boteco do Seu Zé", "Burger Lab" e "Sushi Hanami" [C]. Em cache, com o rótulo "processado anteriormente".
  - **"Importar do delivery (simulado)"**, com o "Por quê?" da especificação.
- **Pré-processamento no navegador:**
  - imagem → JPEG de 1600 px;
  - PDF → até 5 páginas renderizadas pelo pdf.js (D127) → JPEGs;
  - limite de 8 MB de entrada.
- **Servidor:** confere o tipo pelos *magic bytes* (`rejectCrossSite` com `requireJson: false`).
- A extração roda **em segundo plano** (`menu_extractions`, com vencimento de 90 s), e o dono segue para o passo 2.
- **Os exemplos também pré-preenchem o passo 2** com dados fictícios editáveis (mesas, clientes, funcionamento e 2 faixas), para a demo caber em 0:45–2:30.

**2. Seu salão** (enquanto a IA lê)
- Nome, nº de mesas, clientes de salão por semana.
- **Funcionamento:** blocos com dias D S T Q Q S S + início/fim (padrão do portal/03).
- **Horários vazios** (≥ 1): dias + um intervalo (padrão "1º turno" do portal/02), intensidade "Muito/Um pouco" e mesas a mais por semana.
- Ticket e margem opcionais, com o rótulo "estimativa sua; usada só para calcular retorno".

**3. Revisão do cardápio**
- `DataTable` editável (rótulo por célula), adicionar e remover linha; culinária e faixa de preço sugeridas.
- **Validação do código depois da IA:** preço fora de R$ 1–R$ 1.000 ou duplicado vira "confira"; categoria fora da lista → "prato".
- Estados: "lendo seu cardápio… · N itens encontrados", "isso não parece um cardápio", leitura parcial, falha → reserva → "digitar ou usar exemplo", limite → exemplo.
- Edições vão para `owner_edits`.

**4. Pacote proposto**
- **Agora:** o código propõe o de menor custo por cliente identificado, nesta ordem: doce grátis (sobremesa mais barata) > cortesia (bebida mais barata) > entrada grátis [C]. Texto por `describeOffer`.
- **Recompensa da cartela:** a sobremesa de maior preço; sem sobremesa, o prato de menor preço [C].
- **Convite por faixa:** card com:
  - a oferta;
  - "Por que esta" (justificativa com os fatos já resolvidos);
  - o texto do convite como o cliente verá;
  - "até N convites/semana ≈ M mesas" e o custo máximo por semana;
  - "Ver outras opções" num `SidePanel` com rodapé "Cancelar/Salvar".
- **Ajustes do dono:**
  - trocar a candidata;
  - trocar item, tipo ou % (validados pelo código);
  - teto de 1 a 999;
  - texto do convite **livre, só com aviso** (D125).
- **Rótulos e controles:** "Gerar de novo" (com limite); "Sugestão automática (sem IA)" no modo sem IA; estado `gerando` com vencimento de 90 s.

**5. Resumo e ativar**
- Prévia dos 2 cards, como o cliente verá.
- "Ativar Comer Fora no salão": `SELECT … FOR UPDATE` no restaurante; se já estiver ativo, devolve o resultado sem refazer.
- **Na mesma transação:**
  - `benefits` + `benefit_versions` v1 (o convite com `weekly_cap` e `invite_text`);
  - `weekly_plans` aprovado (`approved_via=portal`, fatos declarados, `generatedBy`, gravado como `history.ts` grava);
  - `status=ativo`, `activated_at`;
  - `owner_edits`.
- **Depois da transação:** a **geração do kit começa em segundo plano**, e o botão "Ver meu kit" leva a ela.

### 4.5 Regras no código
**Candidatas** (`buildCandidates`, função pura), para cada faixa:
1. **Famílias:** sobremesa → doce grátis; entrada ou porção → entrada grátis; bebida → cortesia; prato → desconto de 15% [C].
2. **Fora:** os itens do "agora" e da recompensa (para não ser "volte e ganhe o que você já ganhou").
3. **Fora:** itens com preço abaixo de 15% do `ticket_ref` [C] (ex.: água).
4. **Fora:** custo unitário acima de 35% do `ticket_ref` [C].
5. **Escolha por família:** o item de menor custo.
6. **Nota:** `1 − custo/ticket_ref`, com `ticket_ref` = ticket declarado ou 2 × o preço médio (D121).
7. **Até 3 candidatas** de famílias diferentes. Com 0, o pacote mostra "Escolha um item".
8. **Teto e custos:** teto = mesas × 4; custo máximo = teto × custo unitário.
9. **Ids estáveis** `<slotId>:<kind>:<itemId>`.
10. **Modo sem IA:** a maior nota ainda não usada por outra faixa, nesta ordem de prioridade [C].
11. **Conversão para o formato do plano:** `toPlanCandidate()` grava `offer:{kind,itemId,pct}` (formato de `planContentSchema`).

**Fatos declarados**, com chaves estáveis:
- `faixa_<id>_intensidade|mesas|turno`, `ticket_medio`, `margem_pct`, `mesas_total`, `clientes_semana`, `itens_<categoria>`;
- **convenção:** chaves `_pct` são formatadas pelo código com "%"; o texto nunca escreve "%";
- os planos fixos da vitrine são ajustados no `SEED_VERSION` 2.

**Referências** (módulo puro único, `src/modules/textos/domain/references.ts`):
- substitui o `referencesIn` de `plan-content.ts`;
- suporta `{fato}`, `{prato}`, `{horario}`, `{oferta}`, `{beneficio}`, `{recompensa}`;
- `renderReferences(text, ctx)` resolve; `{horario}` no 2º card usa o `slot_snapshot` do convite.

**Guardrails** (`src/modules/ia/guardrails/`), aplicados ao texto da IA:
1. só referências permitidas por campo;
2. nenhum dígito fora de referência [C];
3. palavras proibidas [C]: "grátis", "de graça", "metade", "dobro", "garantido", "melhor do", "o melhor", "últimas", "só hoje", "imperdível", "iFood paga", "reais", "R$". "%" e "desconto" só em `textoConvite`;
4. PII (e-mail, telefone, CPF);
5. tamanho medido **depois** de renderizar as referências;
6. nada de HTML nem chaves soltas.

No texto do dono, os itens 2 e 3 viram aviso (D125); os itens 1, 4, 5 e 6 continuam bloqueando.

**Tarefa 3, pacote**: `buildPackageTask(slots, cands, { learned? })`. O parâmetro `learned` já fica previsto para a S3.
- **Apelidos curtos no prompt:** faixas `A`, `B`; candidatas `A1`, `A2`; pratos `p1`, `p2`… O código converte de volta para os ids.
- **Schema por chamada:** `escolhas[]{slot: enum, candidata: enum, textoConvite ≤ 160, justificativa ≤ 400}`, `ordem`, `aprendemos: []`.
- **O guard confere:** exatamente 1 escolha por faixa; a candidata pertence à faixa; a ordem é uma permutação; as regras 1–6.
- **Prompt:** um bloco de instruções e tom (separado, a S3 torna editável), os fatos, as faixas descritas pelo código e as candidatas com nomes limpos.
- **Fallback:** `fallbackPackage`.

**Tarefa 1, cardápio:**
- **Saída:** `{ehCardapio, itens: [{categoria, nome ≤ 80, precoCentavos}] ≤ 80, culinaria: string|null, faixaPreco: "$"…"$$$$"|null, parcial}`. Campos `nullable`, não `optional`.
- **Entrada:** 1 a 5 imagens. O texto da imagem é tratado como dado, nunca como instrução.

**Tarefa 2, kit**, por versão A/B:
- **Campos:** `{titulo ≤ 40, subtitulo ≤ 90, acao ≤ 40, recado ≤ 120}`, com `{beneficio}` e `{prato:id}`.
- **Proteção do holdout:**
  - o contexto **não recebe as faixas nem os itens de convite**;
  - o guard reprova `{prato}` de item de convite e palavras de dia ou turno ("segunda" a "domingo", "tarde", "noite", "almoço", "happy hour").
- **Linha do convite:** fixa, genérica e do código.
- **Cartão do garçom:** modelo do código, "Hoje, quem faz check-in ganha {beneficio}. Peça o código ao cliente e valide no Portal."
- **"Regenerar campo"** refaz a versão e troca só aquele campo.

**Validar código:**
- **`lookupCode`:** procura primeiro no restaurante da sessão. `OUTRO_RESTAURANTE` só vale entre os restaurantes **do mesmo dono**; código de outro dono → `INVALIDO`.
- **A vista mostra:** o tipo, o primeiro nome + inicial, o telefone mascarado, o item, as condições e, se já usado, "validado às HH:MM".
- **`confirmCode(db, {restaurantId, code, idempotencyKey, now})`:** transação com `FOR UPDATE`. Muda para `validado`; se for convite, o convite passa a `usado`. A mesma chave devolve o mesmo resultado.

**Configurações (D120):**
- **Versões:** mudar oferta, teto ou texto cria uma nova `benefit_version` (`superseded_at` na anterior); o teto da semana acompanha.
- **Faixa:** a edição mantém o id (os convites guardam `slot_snapshot`); desativar = `active=false`.
- **Faixa nova:** escolher a oferta por "Sugerir com IA" ou manualmente.
- **Itens do cardápio:**
  - viram `active=false`, nunca são apagados;
  - **não dá para desativar um item usado numa versão vigente** ("troque a oferta antes");
  - `loadContext` passa a carregar também os itens inativos, para descrever versões antigas.
- **Restaurante de teste:** "Excluir restaurante de teste".
- Tudo vai para `owner_edits`.

**2º card** (D122): `invite_text` entra em `InviteView`, `sanitizeCheckinView` e `checkinViewSchema` (`views.ts`, a lista de campos permitidos). A linha secundária fica no estilo do "Recado", abaixo da linha do código.

**Chaves e custo:**
- `OPENROUTER_KEY_PUBLIC` para todos;
- `OPENROUTER_KEY_DEMO` para os e-mails em `PRESENTER_EMAILS`, que também ficam isentos do limite global;
- teto da chave pública de US$ 0,50/dia (soma de `ai_calls`) → modo sem IA com aviso;
- `provider.data_collection: "deny"` em `openrouter-gateway.ts`.

## 5. Telas, estados e textos
**Casca do Portal:**
- **Topo da barra lateral (portal/02):** logo; nome do restaurante com o link "Trocar loja" no estilo do "Trocar grupo" do portal/05; caixa de status **"Loja aberta / Loja fechada · Fora do horário programado"**, calculada pelo funcionamento.
- **Seção "Comer Fora no salão"** (selo "Novo", `Badge outline-red` em pílula):
  - Início, Ativação (se em rascunho), Kit, Validar código, Configurações;
  - o status "Ativo / Em ativação" aparece no Início.
- **Rodapé (portal/05):** e-mail mascarado, "Usuário logado" e "Sair".
- **`NavItem` ativo:** fundo rosado, barra vermelha e `aria-current`.
- **Itens do Portal real que o protótipo não tem:** não aparecem [C, destacado no relatório final].

**Telas:**
- **Início** (`/parceiro/salao`, provisório até o painel da S3):
  - ação principal "Criar meu restaurante" (o banner "Crie o seu restaurante" da especificação §3.1);
  - cards: Ativar, Kit, Validar código, Configurações e "Abrir como cliente";
  - na cópia da vitrine: "60 dias de dados de exemplo".
- **Componentes novos:** `Stepper` (`aria-current="step"`), `DaySelector`, `TimeRangeField`, `SlotEditor`, `DataTable`, `UploadDrop` (com botão equivalente), `Toast` (`role="status"`), `SidePanel` (Esc e X).
- **Kit:**
  - peças com prévia A/B, "Editar" no `SidePanel`, "Regenerar" por campo, contador de caracteres;
  - "Aprovar peça", "Imprimir", "Está no salão" e **"Abrir este QR"** por versão (link `?p=`, só na tela);
  - esqueleto durante a geração; depois de 45 s, o texto modelo.
- **Impressão:**
  - sem casca; a barra aparece na tela e o `@media print` a esconde;
  - `@page` A5, A4 e A4 com 4 cartões;
  - QR em SVG com ≥ 3 cm, endereço por `PUBLIC_BASE_URL`.
- **Validar código:**
  - campo grande com `autocapitalize="characters"`, `autocomplete="off"` e `spellcheck=false`;
  - card com o selo do tipo;
  - "Confirmar" → "Código validado ✓ às HH:MM", e os 4 estados de recusa.
- **Configurações:** abas Benefício agora · Horários vazios e convites · Cartela · Cardápio · Restaurante, com o `Toast` "Salvo · nova versão em vigor".
- **"/":** ganha "Sou dono: abrir Portal".

**Acessibilidade:**
- alvos ≥ 44 px e foco visível;
- erros com `aria-describedby` e foco no resumo de erros;
- `aria-live` nos estados de IA e de validação;
- axe sem violações.

## 6. Técnica

### 6.1 Arquivos
- **`src/modules/contas/`:**
  - `domain/login-code.ts`;
  - `application/{request-code, verify-code, evaluator-link, copy-vitrine, cleanup}.ts`;
  - `adapters/{mail-sender.ts (porta), ses-sender.ts, memory-sender.ts}`.
- **`src/modules/onboarding/`:**
  - `domain/{candidates.ts, package.ts, facts.ts, menu-extraction.ts}`;
  - `application/{extract-menu, save-salon, save-menu, propose-package, activate, wizard-events}.ts`;
  - `adapters/{photo-source, example-source, delivery-import-simulated}.ts` + `exemplos/*.json`.
- **`src/modules/textos/domain/references.ts`** (puro).
- **`src/modules/ia/`:**
  - `models.ts` (registro por tarefa, com `reasoningEffort` e `providerOptions`);
  - `gateway-factory.ts`;
  - `tasks/{menu, package, kit}.ts`;
  - `guardrails/{rules, forbidden, pii, index}.ts`;
  - `ai-calls.ts`;
  - `fallback-templates.ts`.
- **`src/modules/kit/`:**
  - `domain/{templates, qr}.ts`;
  - `application/{generate-kit, edit-piece, approve-piece, mark-in-salon}.ts`.
- **`src/modules/salao/application/validate-code.ts`.**
- **`src/modules/config/application/update-settings.ts`.**
- **`src/shared/rate-limit.ts`.**
- **`src/web/owner-session.ts`.**
- **Mudanças em arquivos existentes:**
  - `src/db/seed/{vitrine, history}.ts` (parâmetros);
  - `src/modules/simulacao/application/persist.ts` (remapeamento de ids);
  - `src/modules/salao/application/{context, views}.ts`;
  - `src/ui/components/PortalShell.tsx` (topo, rodapé, `NavItem`).
- **Rotas:**
  - `app/parceiro/**`;
  - `app/api/parceiro/{entrar, entrar/codigo, acesso, sair, loja, restaurantes, cardapio/extrair, cardapio/[id], salao, pacote, pacote/aprovar, ativar, kit, kit/[peca], codigos/consultar, codigos/confirmar, configuracoes/*}`;
  - tudo com Zod, `rejectCrossSite`, `consume` e o restaurante tirado da sessão.
- **Ferramentas:**
  - `scripts/gerar-cardapios.ts` (HTML → PNG e PDF fictícios com Playwright);
  - `eval/run-t1.ts`, `eval/cardapios/*.json`, `eval/relatorio-t1.md`;
  - `docs/planejamento/notas-ia.md`.
- **Dependências** (versões conferidas na implementação):
  - `qrcode`, `aws4fetch` e `pdfjs-dist` (carregado sob demanda no navegador);
  - `tesseract.js` só como dependência de desenvolvimento, para a T1.
- **Porta nova `MailSender`:** extensão registrada da D45 [C].

### 6.2 Interfaces produzidas (a S3 consome)
```ts
consume(ex, key, max, windowSec, now?): Promise<{ ok: true } | { ok: false; retryAfterSec: number }>;
getOwnerSession(): Promise<{ ownerId: string; restaurantId: string | null } | null>;
forRestaurant(ex, ownerId, restaurantId): Promise<RestaurantRow>; // 404 se não for do dono
buildCandidates(slots, menu, decl: { ticketCents?; marginPct?; exclude: string[] }): Array<{ slotId; options: Candidate[] }>;
toPlanCandidate(c: Candidate): PlanContent["candidates"][number]["options"][number];
declaredFacts(r, slots, menu): Record<string, number | string>;
buildPackageTask(slots, cands, opts?: { learned?: VerdictInput[] }): TaskDef<PackageOut>;
renderReferences(text, ctx: RefContext): string; guardText(text, ctx, opts: { allowed: RefKind[]; maxLen: number; mode: "ia" | "dono" }): GuardResult & { warnings: string[] };
lookupCode(ex, ownerId, restaurantId, raw, now): Promise<CodeLookup>; confirmCode(db, { restaurantId, code, idempotencyKey, now }): Promise<CodeLookup>;
recordAiCall(ex, { task, promptVersion, restaurantId?, result, keyKind }): Promise<void>;
copyVitrineFor(ownerId): Promise<void>; // serializada no pool do seed
```

### 6.3 Dados — migração `0002` (só aditiva)
- **`owners`:** + `email_hmac` (único, anulável), `email_hint`, `last_seen_at`, `via` (`email|link|e2e`).
- **`restaurants`:** + `onboarding_step`, `copied_from` (sem FK), `setup_status`, `setup_started_at`.
- **`benefit_versions`:** + `invite_text`.
- **`piece_variants`:** + `approved_at`. O `kit_pieces.status` passa a usar `rascunho|aprovado|no_salao`.
- **Tabelas novas:**
  - `login_codes`;
  - `rate_limits` (`key`, `window_start`, `count`), com limpeza de janelas antigas "de carona";
  - `menu_extractions` (estado + `started_at`, **sem imagem**);
  - `owner_edits`;
  - `onboarding_events`;
  - `ai_calls` (`restaurant_id` com `on delete set null`).
- **Seed:** `SEED_VERSION` 2. Entram o `invite_text` dos convites da vitrine e a convenção `_pct` nos planos fixos; a vitrine original é recriada.

### 6.4 IA e T1
**T1** (`eval/run-t1.ts`; não roda no CI):
- **Cardápios:** 3 fictícios renderizados por nós, com gabarito: um "foto torta" com ruído, um limpo de 2 colunas e um PDF de 2 páginas convertido em imagens como no produto.
- **Concorrentes:**
  - os 7 modelos de visão da D129, com esforço de raciocínio "low/minimal" e provedor ordenado por latência (`sort: "latency"`, sem o tier flex);
  - **Tesseract + regras**;
  - **Vision + regras**;
  - **Vision + LLM de texto barato** (o mais barato dos 7 em modo texto).
- **Métricas:** F1 de itens (nome normalizado), % de preços exatos, % de categorias, JSON válido, p50 e custo.
- **Regra [C]:**
  - nota = 0,5·preço + 0,4·F1 + 0,1·categoria, com p50 ≤ 15 s;
  - a reserva é o melhor de **outro provedor**.
- **Se o híbrido vencer:** ele vai ao produto só com uma decisão registrada e o Vision no Easypanel (a credencial já está lá).
- **Depois da T1:** o vencedor gera o cache dos 3 exemplos.
- **Credencial do Vision:**
  - `GOOGLE_VISION_CREDENTIALS` (JSON de service account);
  - lida do Easypanel pelo conector, só para a T1, sem ecoar;
  - o token OAuth é assinado com JWT RS256 pelo `crypto` do Node.
- **Registro:** custo e chamadas em `notas-ia.md`, e o processo e o motivo na decisão.

**T3 e kit:** modelos provisórios de texto até a T3 da S3 [C].

**Orçamentos de tempo:** extração com 30 s por tentativa e 60 s no total; pacote e kit com 20 s e 45 s. `maxOutputTokens` por tarefa, com folga para o raciocínio.

**Rastro:** Langfuse, com a imagem mascarada, mais a tabela `ai_calls`.

### 6.5 Segurança e privacidade
- **E-mail:** só HMAC + dica mascarada; nunca em log, rastro, prompt ou `ai_calls`. Que o SES processa o endereço fica declarado na tela de login e no "Como funciona" (S3).
- **Login:** limites, tentativas e comparação em tempo constante.
- **Tokens:** E2E e link do avaliador comparados em tempo constante; sem a variável, o recurso fica desligado.
- **Isolamento:** `forRestaurant` em todas as consultas do Portal; `rejectCrossSite` em toda escrita.
- **Imagem:** nunca gravada.
- **URL do QR:** sai de `PUBLIC_BASE_URL`, não do `Host`.
- **Limites persistidos [C]:**

| Ação | Limite |
|---|---|
| Enviar código | 3/15 min e 5/dia por e-mail; 10/h por IP; 300/dia global (`PRESENTER_EMAILS` isentos) |
| Conferir código | 20/h por IP |
| Contas novas | 10/dia por IP |
| Link do avaliador | 20/dia |
| Restaurantes de teste | 3 por conta; 10/dia por IP |
| Extração | 5/dia por conta; 15/dia por IP; 150/dia global |
| Pacote | 10/dia por restaurante |
| Kit | 6/dia; regenerar campo 30/dia |
| Consultar código | 30/min por conta |
| Rotas públicas | os números da D115 |

  - Isentos: as contas `via=e2e` e os restaurantes delas.

### 6.6 Operação e passos do candidato
**Já feito:** `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY` e `MAIL_FROM` no Easypanel, conferidos por nome.

**Passos do candidato:**
1. `E2E_LOGIN_TOKEN` no Easypanel e no GitHub (gerado pelo candidato com `openssl rand -hex 32`).
2. `GOOGLE_VISION_CREDENTIALS` no Easypanel (JSON em uma linha).
3. Opcional: `PRESENTER_EMAILS`.
4. SES:
   - DMARC (`p=none`) no subdomínio;
   - acrescentar `ses:GetAccount` ao usuário IAM, para o preflight conferir `ProductionAccessEnabled`;
   - antes do merge, 1 envio real para uma caixa Gmail e uma Outlook, conferindo o spam.

**Feito pela IA depois da aprovação:** gerar e gravar `EVALUATOR_LINK_TOKEN` e `PUBLIC_BASE_URL`, sem ecoar.

**Antes do merge:**
- conferir os nomes das variáveis e o preflight do SES;
- remedir a memória do build;
- conferir a memória livre da VPS.

**E2E de produção:** envia também ao simulador do SES, pela rota normal (não substitui o teste manual).

## 7. Testes
**Unitários:**
- **Login:** `login-code`; `ses-sender` (forma da requisição: URL v2, `service: "ses"`, `Content.Simple`, nome RFC 2047, log sem o endereço).
- **Textos e guardrails:**
  - `references` e `render` (`_pct` vira "65%", nunca "65%%"; `{horario}` usa o snapshot);
  - `guardrails`: modo IA reprova "50% off", "metade do preço", telefone, `{fato:x}` desconhecido; modo dono só avisa os itens 2 e 3;
  - kit: reprova item de convite e "terça"/"à tarde" no recado.
- **`buildCandidates` com a vitrine** (margem de 65%, ticket de R$ 85):
  - a água sai (preço abaixo de 15% do ticket);
  - o "agora" (panna cotta) e a recompensa (tiramisù) saem;
  - ids estáveis, nota decrescente, famílias diferentes;
  - **as contas esperadas são escritas no teste a partir do cardápio real**.
- **Proposta e tarefa 3:** `proposeAgora`/`proposeRecompensa`; `buildPackageTask` (apelido → id; guard: 1 por faixa, pertence à faixa, permutação).
- **Kit e extração:** templates do kit (cartão ≤ 2 frases, sem convite); `menu-extraction` (limpeza, validação de preço).

**Integração (Postgres):**
- **Login e contas:**
  - login com `memory-sender`;
  - código errado 5×;
  - link do avaliador;
  - **cópia da vitrine** (mesmas contagens e o mesmo IC da original; 2 cópias sem conflito; tokens com sufixo);
  - limpeza (poupa `protected` e contas ativas).
- **Limites e assistente:**
  - `consume` paralelo;
  - assistente completo com gateway falso;
  - ativar 2×;
  - modo sem IA.
- **Código e configurações:**
  - `validate-code` nos 5 estados, idempotência, convite → usado, código de outro dono → INVALIDO;
  - Configurações: versão nova, convite emitido intacto, item em versão vigente bloqueado.
- **Isolamento e rastro:** isolamento A × B; `ai_calls` gravado sem conteúdo.

**E2E** (serial no arquivo do dono, 390 e 1280 px, axe, local e produção):
1. **Conta e cópia:** login com o token (`e2e-dono+1`) → cópia pronta → check-in como cliente na cópia → validar (OK, depois JÁ USADO).
2. **Assistente completo:**
   - a conta apaga os próprios restaurantes de teste pela rota de exclusão;
   - criar → exemplo (passo 2 pré-preenchido) → pacote (sem IA no CI, com IA em produção) → ajustar teto → ativar → kit → aprovar → impressão com QR;
   - "Abrir este QR" → check-in **repetido com clientes novos até cair convidável** → 2º card com o texto → validar.
3. Configurações: trocar a oferta → o próximo cliente convidável vê a nova.
4. Isolamento: a conta `e2e-dono+2` recebe 404 nas rotas da conta 1.
5. Erros: código de login errado, código inexistente, limite.
6. Link do avaliador: inválido → 404 (o válido é testado só na integração, para não gastar o link).
7. Produção: envio ao simulador do SES.

**Ensaio do roteiro:** cronometrar a demo de 0:45–2:30 com o exemplo, já logado.

## 8. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Tela de login idêntica ao iFood pedindo e-mail → marcação antiphishing ou e-mail na quarentena (D118 aceito) | Link privado do avaliador (D126); `noindex`; e-mail sem logo nem link; DMARC; risco registrado com a decisão do candidato |
| SES no sandbox, credencial errada ou spam | Preflight `GetAccount`, teste manual Gmail/Outlook antes do merge, simulador no E2E, health `mail` |
| Disparo de e-mails por terceiros | Limite por e-mail, por IP e global logo depois do login (ordem da seção 12) |
| E-mail real é dado pessoal | Só HMAC + dica; declarado; limpeza em 7 dias |
| Texto livre do dono contradiz a oferta (D125) | Aviso na edição + prévia do 2º card ao lado; registrado como risco aceito |
| Cópia da vitrine lenta ou concorrente | Serializada no pool do seed, estado persistido, medida na VPS, limites |
| Escopo de ~25–35 h | Ordem da D124; o que sobrar vai para a S3, registrado |
| IA inventa ou fica cara | Referências com apelidos, regras, escolha ∈ candidatas, aprovação do dono, teto diário, modo sem IA |
| Contaminação do holdout pelo kit | Contexto do kit sem convite; guard de dia e turno; teste |
| Credencial do Google no histórico da sessão (D128) | Aceito; service account só com Vision; o candidato pode revogar depois da T1 |

## 9. Fora de escopo
- **Painel e análise:** Visão geral, Clientes, plano da semana na tela e sua aprovação, insights, "o que aprendemos", reativação.
- **Demo e bastidores:** "Simular 30 dias", "resetar demo", Bastidores, "Como funciona", modo apresentação, prompts editáveis e flags.
- **IA avançada:** revisor, A/B, "aprende com o dono", MCP, T3 da mini-avaliação.
- **Outros:**
  - "quem já está no Comer Fora pula o passo 1" (sem fonte de "já está");
  - OCR no produto (D128).

## 10. Perguntas respondidas pelo candidato
1. T1 → medir já, documentando o processo e o motivo (D117).
2. "Por que um terceiro entra na conta de outro?" → login por pessoa; SMS/e-mail → **e-mail real pelo AWS SES já configurado**, subdomínio novo, fora do sandbox; "só e-mail real" (D118). Depois da revisão: **login idêntico + link do avaliador** (D126).
3. Vitrine → uma cópia por conta (D119).
4. Tudo editável depois da IA; Configurações na S2 (D120).
5. Papel da IA: código = custo, IA = item × turno (D121).
6. Texto da IA também no 2º card (D122).
7. E2E do dono em produção → token (D123).
8. Sem corte (D124).
9. Texto do dono → livre, só com aviso (D125, contra a recomendação dos revisores).
10. PDF → sempre imagem (D127, ideia do candidato).
11. OCR primeiro? → só como linha de base na T1, com Tesseract e Google Vision em 2 formas (D128); credencial no Easypanel, lida pelo conector.
12. Modelos da T1 (D129). O gemini-2.5-flash-lite não foi descontinuado: o catálogo não mostra data de expiração.

## 11. Revisão independente do plano (20/11, 2 subagentes)
Conferi no código os fatos citados (ids determinísticos do simulador, `persist.ts`, tokens fixos, `context.ts` com `active=true`, "%" nos planos fixos).

### Técnico
| # | Sev. | Achado | Destino |
|---|---|---|---|
| T-B1 | bloq. | A cópia da vitrine repete os UUIDs do simulador e os tokens `nl-*` (chave duplicada); grupos diferentes com outro `restaurantId` | **[C]:** simular com `VITRINE_ID` e remapear ids ao gravar (4.3) |
| T-I1 | imp. | Formato das candidatas ≠ `planContentSchema`; "%" proibido × planos fixos; `buildPackageTask` sem `learned` | **[C]:** `toPlanCandidate`, convenção `_pct`, parâmetro `learned` |
| T-I2 | imp. | UUID dentro das referências da IA | **[C]:** apelidos curtos |
| T-I3 | imp. | `renderReferences` em `ia/` quebra a fronteira; parser duplicado | **[C]:** `textos/domain/references.ts` único |
| T-I4 | imp. | Flex do Gemini (p50 16 s), raciocínio obrigatório, `data_collection` ausente | **[C]:** `reasoningEffort`/`providerOptions` no `ModelRef`; aplicado na T1 |
| T-I5 | imp. | Estado de tarefas em segundo plano não persiste; concorrência da cópia | **[C]:** `setup_status` com vencimento; pool do seed |
| T-I6 | imp. | Limpeza apagaria sessões ativas e não protege donos de `protected` | **[C]:** `last_seen_at` na sessão; filtros (4.3) |
| T-I7 | imp. | Transporte em memória poderia ligar sozinho em produção | **[C]:** `MAIL_TRANSPORT=memory` explícito; health `mail` |
| T-I8 | imp. | Limite global esgotável; DKIM pode atrasar | **[C]:** isenção do apresentador; 5/dia por e-mail; passos do candidato já |
| T-I9 | imp. | Limites por último; T1 fora da ordem | **[C, só ordem]:** limites logo depois do login; T1 antes da extração (seção 12) |
| T-I10 | imp. | E2E: um e-mail só, corrida, rota de exclusão faltando, holdout | **[C]:** `+N`, serial, exclusão, repetir até convidável, isenção por conta |
| T-I11 | imp. | Candidatas: o teste estava errado; a água ganharia sempre | **[C]:** piso de 15% do ticket, exclusões, fallback distinto por faixa |
| T-I12 | imp. | Item inativo quebra versões antigas | **[C]:** carregar inativos; bloquear item em versão vigente |
| T-I13 | imp. | 2º card: lista de campos permitidos e snapshot | **[C]:** `views.ts` + `slot_snapshot` |
| T-m | menor | 1 escolha por faixa; `nullable`; mecanismo de ativar; magic bytes; multipart; `OUTRO_RESTAURANTE` só entre lojas do mesmo dono; teste do SES pela forma; segredo do HMAC; limpeza de `rate_limits`; `PUBLIC_BASE_URL`; tamanho medido depois de renderizar; assinatura uniforme | **[C] aceitos** |

### Produto
| # | Sev. | Achado | Destino |
|---|---|---|---|
| P-B1 | bloq. | Login idêntico ao iFood pedindo e-mail real, sem plano B → antiphishing e critério 2 | **candidato:** login idêntico + **link do avaliador** (D126) |
| P-B2 | bloq. | O simulador do SES não prova a entrega fora do sandbox | **[C]:** preflight `GetAccount`, teste manual Gmail/Outlook, DMARC (passos do candidato) |
| P-B3 | bloq. | Limites por último com o envio de e-mail aberto | igual a T-I9 |
| P-I1 | imp. | Demo de 0:45–2:30 não cabe | **[C]:** exemplo pré-preenche o passo 2; kit em segundo plano ao ativar; demo já logada; exclusão de restaurante |
| P-I2 | imp. | O recado da IA pode contaminar o holdout | **[C]:** contexto sem convite + guard de dia e turno + teste |
| P-I3 | imp. | O "agora" e o convite no mesmo item | **[C]:** excluir das candidatas |
| P-I4 | imp. | Texto do dono só com aviso permite "50% off" | **candidato:** manteve livre com aviso (D125); risco registrado |
| P-I5 | imp. | Primeira tela sem "Criar meu restaurante"; QR sem `?p=` | **[C]:** ação principal no Início; "Abrir este QR" |
| P-I6 | imp. | Especificação desatualizada; "cifrada" incorreto | **[C]:** atualizações na seção 12; texto corrigido |
| P-I7 | imp. | O garçom precisa do e-mail do dono | **[C]:** declarado; "modo salão" no roadmap |
| P-M1–M9 | menor | Textos do print 01; caixa de status; "Trocar loja"; print certo para a faixa; acessibilidade; limites por NAT; linha secundária do 2º card; aviso de 7 dias; esforço do muse-ember; endereço padrão | **[C] aceitos.** "Só itens que funcionam" na barra lateral fica [C] e vai destacado no relatório final |

## 12. Ordem de implementação e registro
**Ordem (D124, ajustada pela revisão só na sequência):**
1. Migração `0002` + `consume` + sessão do dono + login (SES e memória) + link do avaliador + limites de login.
2. Cardápios fictícios + **T1** (com o Vision) → modelo escolhido + cache dos exemplos.
3. Extração (passos 1–3 do assistente).
4. Candidatas + tarefa 3 + modo sem IA + pacote + ativar.
5. 2º card com o texto.
6. Validar código.
7. Kit + impressão + QR.
8. Configurações.
9. Cópia da vitrine por conta + limpeza.
10. Demais limites + E2E de produção.

**Ao aprovar:**
1. Copiar este texto para `docs/fatias/S2/planejamento.md`.
2. Registrar D117–D130 (seção K) em `decisoes-e-tradeoffs.md`.
3. Atualizar a especificação:
   - §3.1 (login por e-mail, link do avaliador, cópia da vitrine);
   - §3.6 (Configurações na S2);
   - §4.3 (rotas);
   - §4.5 (variáveis);
   - §4.6 e §8 (e-mail real, antiphishing);
   - §10 (login real deixa de estar fora de escopo);
   - §5 (checklist: já logado, SES).
4. Atualizar o plano de implementação (S2/S3) e o `log-conversa-ia.md`.
5. Commit + push na `main` e no branch da sessão.
6. Gravar `EVALUATOR_LINK_TOKEN` e `PUBLIC_BASE_URL` no Easypanel.
7. `implementar-fatia S2` autônoma (D101).

## 13. Itens [C] (D130)
- **E-mail e sessão:** textos da tela de código e do e-mail; validade e tentativas; cookies e 30 dias; segredo e finalidade do HMAC do e-mail.
- **Contas e cópias:** slug e limpeza das cópias; até 3 restaurantes de teste.
- **Exemplos e T1:** os 3 exemplos; regra de escolha da T1; modelos provisórios da T3 e do kit.
- **Candidatas e pacote:** famílias, 15% em prato, piso de 15% e teto de 35% do ticket, nota, fallback distinto, proposta do "agora" e da recompensa.
- **Guardrails:** "sem dígito fora de referência" e a lista de palavras proibidas.
- **Custo:** US$ 0,50/dia da chave pública.
- **Interface:** barra lateral só com itens que funcionam; Início provisório; impressão sem casca; endereço fictício padrão; textos dos estados.
- **Técnica:** porta `MailSender`; `aws4fetch`; tabelas da `0002`; `SEED_VERSION` 2; apelidos no prompt; limites da tabela 6.5.

## 14. Mudanças durante a implementação (D130–D135, [C])
1. **T1 com a foto real** enviada pelo candidato como 4º cardápio (robustez e invenção de itens), guardada em `eval/privado/` (fora do produto e da cópia pública).
2. **Modelos da extração (D131):** gemini-3.1-flash-lite + gpt-6-luna; os mesmos, provisórios, para pacote e kit.
3. **SES (D132):** remetente não verificado em `sa-east-1` → passo do candidato; simulador do SES isento do limite por e-mail.
4. **Link do avaliador por POST:** a página `/parceiro/acesso/<token>` tem um botão "Entrar no Portal"; robôs que abrem links (antivírus de e-mail, prévias) não criam contas nem gastam o limite.
5. **Login em uma página com 2 passos** (e-mail → código), em vez de `/parceiro/entrar/codigo`: o e-mail não vai para a URL (nem para logs de acesso).
6. **Candidatas:** item grátis por preço ≤ 50% do `ticket_ref`; teto de custo de 35% só com custo conhecido (D133).
7. **pdf.js como arquivo estático** (`public/vendor/`), fora do webpack: pico do build 1,48 → 1,39 GB (D133).
8. **Outros [C] (D133):** fila serializada da cópia; isenção das contas E2E nos limites; passo 5 sem refresh; faixa nova com "Sugerir com IA"; axe espera o título.
9. **Revisão (D134):** correções dos 4 revisores e da E2E com IA real; ver `revisao/revisao.md`.
10. **Remetente (D135, candidato):** `acesso@msg.automato.pro` no lugar de `case.automato.pro`.
