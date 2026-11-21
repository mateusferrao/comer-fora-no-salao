# Revisão da fatia S2 — Portal, ativação proposta com IA, kit, validação e configurações

Data: 20/11/2026 · Base: `f8d9615` (planejamento aprovado) · Revisado: `adbf94b` + este registro · Produção: `03e9feb` (merge da S2, no ar às 14:40 UTC)

Revisores independentes (D08): aderência ao case e ao iFood · técnica e arquitetura · produto, design e UX · segurança, IA e qualidade. E2E profunda feita pela IA, com IA real no servidor local (D09). Decisões sobre cada achado tomadas pela IA (D101) e registradas na D134. A troca do remetente do e-mail foi decidida pelo candidato (D135).

## 1. Resumo e veredito
**Pronta para merge** depois das correções desta revisão.

**Críticos (2, encontrados na E2E):**
- **IA quebrada neste ambiente:** a chave do OpenRouter veio com aspas "curvas", e toda extração falhava em menos de 0,1 s. Em produção a chave está limpa. Corrigido no código, e o health passou a mostrar o estado da chave.
- **Kit sempre sem IA:** as 2 tentativas reprovavam por tamanho depois de renderizar as referências. Agora, de 4 tentativas reais, as 4 passam.

**Altos (10), todos corrigidos:**
- justificativa da IA com números sem unidade;
- duas versões vigentes numa edição simultânea;
- plano aprovado fora do contrato da S3;
- falta do limite de contas novas;
- upload sem teto de corpo;
- convite valendo menos que o "agora";
- becos sem saída no assistente;
- ajustes do pacote perdidos;
- abas das Configurações cortadas a 390 px;
- login sem saída enquanto o e-mail falha (remetente trocado na D135 e dica do link de acesso).

**Médios:** a maior parte foi corrigida; os demais viraram dívida da S3 (§2). Nenhuma decisão do candidato foi reaberta.

## 2. Achados consolidados
Grav.: crítico · alto · médio · baixo. Frentes: E2E (IA), Ad (aderência), Tec (técnica), Pr (produto/UX), Seg (segurança/IA).

| # | Grav. | Frente | Achado | Evidência | Correção | Decisão |
|---|---|---|---|---|---|---|
| 1 | **crítico** | E2E | Extração sempre "Não conseguimos ler" em ~0,1 s | `ai_calls.attempts` com `provider` em 23 ms; a chave tinha aspas curvas e o cabeçalho Authorization nem saía | `cleanApiKey` tira espaços e aspas (retas ou curvas), e chave fora do ASCII vale como ausente; `/api/health` → `ia: {publica, demo}` só com o estado | **corrigido** |
| 2 | **crítico** | E2E | Kit sempre "Texto modelo (sem IA)" | guard reprovou `recado:tamanho:159>120` e `B.acao:42>40` | o prompt diz o tamanho de cada referência e o limite contando o texto renderizado; 4 de 4 tentativas reais ok | **corrigido** |
| 3 | alto | E2E | Justificativa da IA ilegível: "o 5 é uma escolha leve", "as 4 … no 15 do salão" | passo 4 com IA real | os fatos saem com unidade ("4 mesas", "15 mesas", "300 clientes por semana", "5 bebidas"), o prompt mostra o valor como o dono lê, e a intensidade concorda com "a faixa" | **corrigido** |
| 4 | alto | Tec | Duas edições simultâneas criavam 2 versões vigentes | `update-settings.ts` (FOR UPDATE com filtro reavaliado) | lock do restaurante na transação e índice único parcial (migração 0003, que antes acerta duplicatas antigas); teste com 4 edições em paralelo | **corrigido** |
| 5 | alto | Tec | Plano aprovado fora do `planContentSchema` (opções vazias, candidata `manual:`, tamanho com UUID) | `activate.ts`, `plan-content.ts` | contrato documentado (opções podem vir vazias; `manual:<kind>:<item>`; tamanho guardado com folga, enquanto o limite real é conferido renderizado); `planContentFromRow` conferido na ativação e nos testes | **corrigido** [C] |
| 6 | alto | Seg | Faltava o limite de contas novas (cada uma copia ~15 mil linhas) | `verify-code.ts` | 10/dia por IP e 100/dia no total, checados antes de gastar o código | **corrigido** |
| 7 | alto | Seg/Tec | O upload lia o corpo inteiro antes de checar o tamanho | `cardapio/extrair/route.ts` | `content-length` obrigatório e teto de 24 MB antes do `formData` | **corrigido** |
| 8 | alto | Pr | Convite mais fraco que o "agora" (refrigerante de R$ 9 contra cookie de R$ 16) | captura 14-passo4 | `buildCandidates` prefere o item que vale pelo menos o "agora" (sem excluir os outros); com IA real, o convite virou a batata rústica de R$ 24 | **corrigido** [C] |
| 9 | alto | Pr | Becos sem saída: "digitar os itens" sem link; sem "Voltar" | `ExtractionStatus`, passos 2–4 | links "Digitar os itens" / "usar um exemplo", "Digitar o cardápio" no passo 1, "← Voltar" e passos concluídos clicáveis no Stepper | **corrigido** |
| 10 | alto | Pr | Ajustes do passo 4 perdidos ao atualizar; "Gerar de novo" sem confirmação | `Step4Pacote.tsx` | rascunho salvo sozinho (800 ms) e confirmação antes de gerar de novo | **corrigido** |
| 11 | alto | Pr | Configurações a 390 px rolavam a página para o lado | captura 05-config-390 | só a barra de abas rola | **corrigido** |
| 12 | alto | Ad/Seg | Login público sem saída enquanto o SES não estiver verificado; health dizia "configurado" | D132 | remetente trocado para um domínio já verificado (D135); health `mail: "falhou"` se o último envio deu erro; a tela de erro lembra do link de acesso | **corrigido** |
| 13 | médio | Seg | Teto de US$ 0,50/dia derrubável por terceiros; o avaliador caía na chave pública | `gateway-factory.ts` | conta do link do avaliador usa a chave de demo; IA da faixa nova conta no limite do pacote (10/dia) | **corrigido** [C] |
| 14 | médio | Seg | Sessão sem validade no servidor | `owner-session.ts` | data de emissão no valor assinado, ≤ 30 dias; `cache()` evita consultas repetidas | **corrigido** |
| 15 | médio | Seg/Tec | IP do cliente pelo 1º item do X-Forwarded-For (forjável) | `rate-limit-memory.ts` | último item (o que o proxy da VPS acrescenta) | **corrigido** |
| 16 | médio | Tec | Kit podia citar item desativado | `context.ts`/`kit.ts` | `inactiveItemIds` no contexto, filtrado no prompt do kit | **corrigido** |
| 17 | médio | Tec | Texto do dono no kit e no recado sem proteção do holdout | `kit.ts` | dia, turno ou item de convite viram **aviso** (D125), com mensagem própria | **corrigido** |
| 18 | médio | Tec | `addSlot` fora de transação, sem limite de faixas (apelidos A–H) | `update-settings.ts` | IA antes, gravação numa transação, até 8 faixas | **corrigido** |
| 19 | médio | Pr | Passo 2 inventava 15 mesas e Ter–Qui 15h–18h para quem envia foto; "85,00" como placeholder | `[passo]/page.tsx` | sem exemplo: mesas e dias vazios em branco, com erro por faixa ("Escolha os dias…"); sem placeholder | **corrigido** |
| 20 | médio | Pr | 2º card com o rótulo "Recado do restaurante" (o mesmo do kit) e horário curto no meio da frase | `InviteCard.tsx` | sem rótulo (texto entre aspas) e `{horario}` por extenso: "terça, quarta e quinta, das 15h às 18h" | **corrigido** |
| 21 | médio | Pr | Campo de teto com `Number(v)\|\|1` ("20" virava "120") e "1 mesas" | Step 4 e Configurações | `useNumberField` (aceita vazio enquanto digita) | **corrigido** |
| 22 | médio | Pr | Desativar faixa sem confirmação | `ConfigManager.tsx` | confirmação | **corrigido** |
| 23 | médio | Pr | Tela "ativo" sem próximos passos | captura 15-ativo | lista: imprimir → no salão → testar como cliente → validar | **corrigido** (a barra lateral ainda mostra "Ativação" até navegar: baixo) |
| 24 | médio | Pr | Peças: nome do restaurante pequeno; selos vermelhos para estados normais | capturas 03/16 | marca maior (H5) e selos neutros | **corrigido** |
| 25 | médio | Ad | Peça impressa sem aviso de protótipo; Kit dizia "A IA escreveu" na vitrine (textos fixos) | `KitPiece.tsx`, `kit/page.tsx` | rodapé "protótipo de case, não oficial"; texto neutro e selo de origem | **corrigido** |
| 26 | médio | Ad | `notas-ia.md` dizia que a T1 se decidiu "por latência e custo" | `notas-ia.md:16` | "empate técnico; valeu a regra combinada antes" | **corrigido** |
| 27 | médio | Ad | Foto real na T1 descrita como "foto real" | `relatorio-t1.md` | descrita como "cardápio impresso, sem dados de clientes", fora do produto e da cópia pública; só notas guardadas | **corrigido** (texto) |
| 28 | médio | Tec | Editar uma versão já impressa ou "no salão" troca o texto no lugar (o A/B mede outra coisa) | `kit.ts` | — | **depois (S3)**, junto com a medição A/B |
| 29 | médio | Ad | Falta número que mostre se a escolha da IA no pacote difere da maior nota | D121 | os dados já existem (`owner_edits`, `ai_calls`) | **depois (S3)**, "Qualidade da IA" |
| 30 | médio | Ad | "Como medir" ainda não aparece na tela do dono | Início | — | **depois (S3)**, painel |
| 31 | médio | Pr | Texto editado pelo dono pode citar o item antigo depois de trocar a oferta | Configurações | — | **depois (S3)** (aviso) |
| 32 | médio | Pr | Cópia da vitrine sem cartão do garçom | captura 03-kit-copia | — | **depois (S3)**, com o "resetar demo" |
| 33 | baixo | Seg | `login_codes` nunca apagado (HMAC do e-mail ficava) | `cleanup.ts` | códigos com mais de 1 dia apagados na limpeza | **corrigido** |
| 34 | baixo | Tec | As consultas automáticas paravam num erro passageiro | `ExtractionStatus`, `KitManager` | tentam de novo | **corrigido** |
| 35 | baixo | Seg | `por.traineddata` (2,4 MB) versionado na raiz | git | removido; `*.traineddata` no `.gitignore` | **corrigido** |
| 36 | baixo | E2E | Faixa branca no rodapé do login; ponto duplo na prévia do kit | capturas 01/16 | corrigidos | **corrigido** |
| 37 | baixo | Tec | Acoplamentos (`slotLabel` em `onboarding`, `randomSuffix`), duplicações (`toOffer`), janela dos limites em UTC | revisor técnico | — | **depois** (limpeza na S3) |
| 38 | baixo | Pr | Raio dos botões (2 px contra ~8 px), barra lateral sem ícones, Stepper em 3 linhas no celular, placeholder do Validar | revisor de produto | — | **depois** (S3/S4, polimento) |
| 39 | — | Ad | Risco de antiphishing derrubar o domínio inteiro | D118 | monitorar; o vídeo de plano B (S4) cobre | **não procede como correção** (risco aceito na D118) |
| 40 | — | E2E | Barra lateral "termina" na captura de página inteira | captura 03 | é `sticky`; artefato da captura | **não procede** |

## 3. Matriz E2E (local, com IA real; capturas em `capturas/`)
| Cenário | Persona | Tela | Esperado | Observado | Evidência | Veredito |
|---|---|---|---|---|---|---|
| Login: vazio, e-mail inválido, código | avaliador | 390/1280 | textos do portal/01, axe ok | ok | 01-login-* | ok |
| Conta nova → cópia da vitrine | avaliador | 1280/390 | cópia pronta e Início | cópia em 3,6 s; axe ok | 02-inicio-copia-* | ok |
| Kit, Validar, Configurações da cópia | dono | 1280/390 | telas úteis, axe ok | ok; abas a 390 px cortadas (achado 11, corrigido) | 03/04/05-* | ok após correção |
| Foto (boteco.jpg) → extração | dono novo | 1280 | itens lidos | **antes:** falha em 0,1 s (achado 1); **depois:** 21 itens em 4,8 s | 12-passo2-foto-* | ok após correção |
| PDF (sushi.pdf, 2 páginas) | dono novo | 1280 | PDF → imagens → itens | 18 itens em 3,9 s (pdf.js como estático) | 12-passo2-pdf-* | ok |
| HEIC, > 8 MB, imagem que não é cardápio | dono novo | 1280 | mensagens certas | "Formato não suportado…", "passa de 8 MB…", "não parece um cardápio" + links | 11-erro-* | ok |
| Foto de cardápio impresso enviada pelo candidato (dado real: sem capturas) | dono novo | 1280 | itens certos, nada inventado | 2/2 itens, preços exatos, 0 inventados, nada do desenho; 3,9 s; 1 tentativa, US$ 0,0006 | só números | ok |
| Passo 2 sem dias no horário vazio | dono novo | 1280 | erro na faixa | **antes:** só "Confira os campos"; **depois:** "Escolha os dias em que este horário fica vazio." | 12-passo2-sem-dias | ok após correção |
| Pacote com IA real | dono novo | 1280/390 | escolha da IA com justificativa legível | **antes:** números soltos (achado 3); **depois:** "busca preencher 4 mesas…"; convite ≥ "agora" | 14-passo4-* | ok após correção |
| Painel "Ver outras opções" | dono | 1280 | abre, Esc fecha, axe ok | ok | 14-passo4-opcoes | ok |
| Ativar com clique duplo | dono | 1280 | 1 ativação | 1 ativação; tela "ativo" | 15-* | ok |
| Kit com IA real | dono | 1280/390 | "Escrito pela IA" | **antes:** sem IA (achado 2); **depois:** IA em 2,4 s | 16-kit-* | ok após correção |
| Cliente pelo QR até cair convidável | cliente | 390 | 2º card com o texto aprovado | texto aparece; holdout sem nada | 20-cliente-* | ok |
| Validar (OK / já usado / inexistente), isolamento A×B, Configurações → oferta nova, link do avaliador | garçom/dono | 1280 | conforme o plano | `dono.spec.ts`: 10 testes verdes | E2E automatizada | ok |

## 4. Matriz E2E (produção)
| Cenário | Esperado | Observado | Evidência | Veredito |
|---|---|---|---|---|
| Health | SHA do merge, banco e seed ok | `03e9feb`, `db: up`, `seed: ok`, `mail: configurado`, `ia: {publica: ok, demo: ok}` | `/api/health` | ok |
| Login real ao simulador do SES (390/1280), com remetente `msg.automato.pro` | "Digite o código…", axe ok | ok já no 1º deploy (`04dead7`) | CI run 34 | ok |
| `dono.spec` completo em produção (conta + cópia, isolamento, assistente com IA, kit, impressão, QR, validar, Configurações, link inválido) | verde | **1º deploy:** falhou antes de chamar o app ("Invalid character in header content": o secret `E2E_LOGIN_TOKEN` do GitHub veio com quebra de linha ou aspas); **corrigido** no helper (limpa o token, como `cleanApiKey`) → verde | CI runs 34 e 36 | ok após correção |
| Fumaça + cliente | verde | verde | CI run 36 | ok |
| Tempo do push ao ar | ~4 min | push 14:35:49 → health com o SHA 14:40:56; E2E de produção até 14:43:11 | job `deploy` | ok |

## 5. Console, rede, tempos e acessibilidade
- **axe:** sem violações em todas as telas visitadas (login, código, Início, Kit, Validar, Configurações, passos 1–5, painel, cliente), a 390 e 1280 px.
- **Rede:** 4xx só onde era esperado (400 do passo 2 antes da correção do achado 19; 409 "gerando" no pacote durante a corrida). Nenhum erro de console fora desses.
- **Tempos (local, IA real):**
  - cópia da vitrine: 3,6 s;
  - extração: foto 4,8 s, PDF 3,9 s, foto do candidato 3,9 s;
  - pacote: 1,9–3,0 s;
  - kit: 2,4 s;
  - telas do Portal: 0,6–0,7 s.
- **Build:** pico de 1,39 GB (D133). A VPS tinha 2,34 GB livres antes do merge (Easypanel, 20/11).
- **Testes:** 228 unitários e 51 de integração verdes; E2E local 45/45; lint, tipos e fronteiras verdes.

## 6. Correções aplicadas
| Achados | Commit | Verificação |
|---|---|---|
| 1–8 (chave, fatos, kit, limites, upload, versão vigente, contrato do plano) | `5b52e55` | unitários + integração (`settings`, `onboarding`, `login`) + sonda real do kit (4/4) |
| 9–11, 13–15, 19–21 (sessão, chave do avaliador, convite ≥ agora, assistente, rascunho, campos, horário por extenso) | `f2dde21`, `d098f82` | unitários (candidatas, sessão, chave) + integração + E2E 45/45 |
| 16–18, 22–27, 33–36 (kit, faixa nova, e-mail no health, limpeza, consultas, textos) | `ced3543` | integração (`kit`, `settings`) + E2E 45/45 |
| 19 (erro por faixa), 3 (concordância) | `adbf94b` | E2E com IA real (passos 2–5 e kit) |
| 12 (remetente) | variável `MAIL_FROM` no Easypanel (D135) | E2E de produção (§4) |

## 7. Decisões novas registradas
- **D134:** itens [C] da revisão da S2 (achados 5, 8, 13, 17, 20 e o contrato do plano).
- **D135:** remetente do código de login em `msg.automato.pro`, já verificado no SES de São Paulo e com DMARC (decisão do candidato; muda a D118 "subdomínio novo").
