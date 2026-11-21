# Planejamento da fatia S4 — Produto real e identidade

Status: ✅ **aprovado em 21/11/2026 pelo candidato** depois da rodada própria de `planejar-fatia` (D171–D176; a seção "Rodada própria da S4" no fim **prevalece** sobre o texto anterior onde houver conflito). Escopo e decisões do replanejamento aprovados antes (replanejamento de 21/11, decisões D151–D169). Este documento guarda o que é comum ao replanejamento (contexto, decisões, perguntas e revisão independente) e o detalhe da S4. **Cada fatia seguinte (S5, S6, S7) é planejada com `planejar-fatia` só quando for a vez dela** (pedido do candidato, 21/11): os documentos delas guardam por enquanto só o escopo combinado.

> **Execução suspensa (21/11, ~01h) e retomada depois da aprovação da rodada própria da S4.** O candidato pediu "primeiro registrar tudo". A sub-fatia S4.1 tinha sido feita antes desse pedido, só no branch da sessão (commit `7b01c74`), e ficou parada lá. O resto só começa com a liberação dele. Ver §14.

## 0. Fatiamento novo (D151)
| Fatia | Nome | Sub-fatias | Flag | Planejamento |
|---|---|---|---|---|
| **S4** | Produto real e identidade | S4.1 base de dados e identidade · S4.2 login do cliente · S4.3 limpeza + Ferramentas do avaliador · S4.4 reativação entregue | Sem flag (núcleo); só `login_cliente_email` como saída de emergência | este documento |
| **S5** | Valor e conversão | S5.1 painel em R$ + meta + "Hoje no salão" · S5.2 landing, página do QR e convite com agenda · S5.3 "Por que esta oferta?" | `painel_valor`, `copy_v2`, `explica_ia` | a planejar na vez dela ([escopo](../S5/planejamento.md)) |
| **S6** | IA que opera | S6.1 resumo semanal por e-mail + agendador · S6.2 modo garçom · S6.3 plano como agente · S6.4 porta-conta | `resumo_email`, `agendador`, `modo_garcom`, `plano_agente`, `porta_conta` | a planejar na vez dela ([escopo](../S6/planejamento.md)) |
| **S7** | Entregáveis (era a S4) | Slide, vídeo de telas reais, repositório público, preparação | — | a planejar na vez dela (segunda de manhã) |

**Ritmo (D160, D167, D168):**
- a ordem das fatias é a ordem de corte;
- cada sub-fatia fecha verde (testes, tipos, lint, fronteiras) antes da próxima;
- a S4 não tem flag: se uma sub-fatia dela não fechar, as seguintes esperam;
- corte no domingo 22/11 às 22h: o que da S5/S6 não estiver pronto e testado fica desligado;
- **uma revisão** (4 revisores + E2E profunda) e **um merge** depois da S6, com meta antes de segunda 23/11 às 08:30;
- construção até segunda às 10h no máximo; a S7 vai de 10h às 15h (congelamento).

## 1. Contexto, objetivo e entrega testável
O candidato pediu duas coisas:
- um replanejamento com foco em **valor para o dono** e em **conversão de clientes**, usando a skill de copywriting (`coreyhaines31/marketingskills`, `copywriting`);
- tirar do produto **tudo que o apresenta como teste ou simulação**. Só o título de protótipo no cabeçalho fica.

Ele também disse sentir "pouca inovação, resultado e técnica". A análise crítica concordou, com evidência:
- **Inovação invisível:** o diferencial (convite nascido na mesa, grupo de controle com convite invisível, teto) mora nas regras e só aparece em "Como funciona". Na tela, o produto parece um clone do Portal.
- **Resultado que parece programado:** o painel mostra um efeito simulado (+0,20). O restaurante que o avaliador cria fica vazio sem "Simular 30 dias".
- **Técnica escondida:** a profundidade (avaliação de modelos, juiz cego, revisor de outro provedor, guardrails, MCP, estatística) só aparece nos Bastidores.

**Entrega testável da S4:**
- o produto não se apresenta mais como teste nem simulação;
- o cliente entra com nome, telefone e e-mail reais + código por e-mail;
- o restaurante criado é real, começa vazio e tem "Primeiros passos";
- a reativação chega de verdade ao cliente (Jornada e e-mail);
- o avaliador continua fechando o ciclo sozinho, pelas Ferramentas do avaliador nos Bastidores.

Provas: suíte verde, a varredura de textos pelo Playwright e a E2E do ciclo completo.

## 2. Requisitos e rastreabilidade
| Requisito | Fonte | Como será provado |
|---|---|---|
| Nada de "teste/simulado/fictício/demonstração" nas telas do produto | Pedido do candidato; D152, D156 | Varredura de textos pelo Playwright no texto renderizado, numa lista de rotas (exceções: barra, Bastidores, rodapés do impresso e do e-mail) |
| Funciona sem depender do candidato | Case (critério 2) | E2E: criar restaurante → ativar → kit → cliente entra → check-in → validar → Avançar 1 dia → volta com convite |
| Cliente entra com dados reais + código por e-mail | D154, D161 | Integração do login; E2E com o padrão da D123 |
| Dado pessoal tratado (consentimento, 7 dias, apagar) | Case ("nada de dados reais" → risco aceito D154/D161); LGPD | Integração da retenção e do "Apagar meus dados"; linha de consentimento na tela |
| Reativação entregue de verdade | D155, D163 | Integração: só convidáveis, grupo de controle sem nada, e-mail só com consentimento e depois do commit; E2E na Jornada |
| Honestidade sobre o histórico gerado | D162, D209 | E2E: selo só na Cantina |
| Barra nova | D164 | E2E: texto exato da barra |

## 3. Decisões (D151–D169)
Todas registradas em [decisoes-e-tradeoffs.md](../../planejamento/decisoes-e-tradeoffs.md), seção M.

| ID | Decisão | Alternativas recusadas | Quem |
|---|---|---|---|
| D151 | Fatias novas S4–S6 até segunda 10h; entregáveis viram a S7, a última | Fatia única até domingo 18h (recomendado); só limpeza + landing | Candidato |
| D152 | **Sistema real só com seed.** A cópia da Cantina sem "demonstração/simulado". O restaurante criado é real e começa vazio, com "Primeiros passos". Saem: "Simular 30 dias", "Limpar simulação", "Antecipar 1 dia", "Importar do delivery (simulado)" e o motivo do grupo de controle mostrado ao cliente | Manter "Simular" com outro nome | Candidato |
| D153 | "Avançar 1 dia" nos Bastidores (Ferramentas do avaliador) | Tirar de vez; regra "voltar hoje" | Candidato |
| D154 | Cliente entra com nome, telefone e e-mail + código de 6 dígitos por e-mail. Campos livres, sem pré-preenchimento | Degraus (recomendado); só telefone; pré-preenchido realista | Candidato |
| D155 | Reativação entregue: Jornada ("Seus convites", aviso de novo) + e-mail para quem consentiu | Só tirar "(simulado)" | Candidato |
| D156 | Na barra, só "Como funciona". Saem o roteiro da entrada, "Trocar de lado" e "Testar como outro cliente" (vira "Sair" na Jornada) | Manter "Trocar de lado" | Candidato |
| D157 | Vídeo da S7 com telas reais (Playwright, legendas, narração por IA) | Vídeo gerado por IA; sem vídeo | Candidato |
| D158 | Apostas: ciclo semanal por e-mail com Aprovar, plano como agente, "Por que esta oferta?"; kit ampliado só no porta-conta | Arte do kit por IA | Candidato |
| D159 | Agente decidido por número (T3 refeita, pares cegos; critério indicativo) | Ligar sem medir; medir + nota cega | Candidato |
| D160 | Ordem de corte: (1) limpeza + login + reativação + Bastidores; (2) R$ + meta + feed; (3) landing, QR, agenda; (4) "Por que esta oferta?"; (5) resumo por e-mail; (6) garçom; (7) agente; (8) porta-conta | Inovação antes da conversão | Candidato |
| D161 | Login completo no check-in + linha "Protótipo de case, não é o iFood. Seus dados são apagados em 7 dias" + retenção de 7 dias + "Apagar meus dados". Aparelhos da demo logados antes | E-mail só no convite (recomendado); sem aviso | Candidato (após a revisão de produto) |
| D162 | Selo "Restaurante de exemplo · histórico gerado" na Cantina; topo "R$ X a mais em margem entre N convidados até agora" | Sem rótulo | Candidato (após a revisão de produto) |
| D163 | Tudo por e-mail (resumo do dono + convite, lembrete e reativação aos clientes). Reabre a mitigação "e-mail sem logo e sem link" da D118 | Só o resumo do dono (recomendado); sem agendador | Candidato (após a revisão de produto) |
| D164 | Rodapé "Protótipo" no impresso e no e-mail; barra "Protótipo de case · não é produto oficial do iFood" (sem "dados fictícios") | — | Candidato |
| D165 | Consentimento continua ligado por padrão | Desmarcado (proposto pela IA) | Candidato |
| D166 | O agente reabre a D215, com as defesas dela | Cortar o agente (revisor de produto) | Candidato (via D158) |
| D167 | 1 merge no fim da S6 | 2 merges, o 1º no sábado (recomendado) | Candidato (após a revisão técnica) |
| D168 | E-mails por evento + agendador; meta de merge antes de segunda 08:30 | Só por evento (recomendado) | Candidato (após a revisão técnica) |
| D169 | Itens [C] (§13) | — | IA [C] |

## 4. Produto e fluxos da S4

### 4.1 Personas e caminhos
- **Avaliador como dono:** login por e-mail ou pelo link privado de avaliação → Portal com a Cantina (selo "Restaurante de exemplo") → "Cadastrar meu restaurante" → assistente → ativar → kit → "Ver minha página" → depois volta ao Portal e vê "Primeiros passos" se marcando.
- **Avaliador como cliente:** QR do kit ou "Ver minha página" → página do restaurante → Check-in → entrar (nome, telefone, e-mail, consentimento) → código por e-mail → check-in → código do benefício (+ convite, se for sorteado) → Jornada.
- **Garçom:** "Validar código" no Portal (o link próprio do garçom vem na S6).
- **Ferramentas do avaliador (Bastidores, `/bastidores/avaliador`):** roteiro "Como testar sozinho", "Avançar 1 dia" e "Ver como cliente reativado".

### 4.2 Limpeza (inventário de 21/11)
Cada item do inventário é reescrito ou sai. Classes:
- **(a)** texto;
- **(b)** comportamento só do restaurante de teste;
- **(c)** simulação;
- **(d)** ajuda ao avaliador.

| Onde | Hoje | Depois |
|---|---|---|
| Barra (`PrototypeBar.tsx`) | "Protótipo de case · não é produto oficial do iFood · dados fictícios" + "Trocar de lado" + "Como funciona" | "Protótipo de case · não é produto oficial do iFood" + "Como funciona" (D164, D156) |
| `BottomSheet.tsx` | repete o texto da barra | sai (a barra já está na página) |
| `layout.tsx` (título/descrição) | "protótipo de case… Dados fictícios" | "Comer Fora no Salão · protótipo de case" (sem "dados fictícios") |
| `not-found.tsx` | "…ainda não existe neste protótipo" | "Página não encontrada" + link para o início |
| `/trocar-lado` | atalho | sai (D156) |
| Entrada `/` | "Sou dono: abrir Portal (demo)", "Sou cliente", roteiro | Landing nova (S5.2); até lá, "Entrar no Portal" e "Veja o que seu cliente vê", sem roteiro |
| Login (`entrar/page.tsx`, `LoginForm.tsx`) | "Portal (demo)… link de avaliação", "Protótipo de case: usamos seu e-mail…" | "Entre no Portal do Parceiro" + a linha de privacidade sem "protótipo" (o e-mail continua guardado como HMAC + criptografado — D169) |
| E-mail de login do dono | "Portal do protótipo… protótipo de case" no assunto e no corpo | assunto "Seu código de acesso: 123456 · Comer Fora no Salão"; rodapé de 1 linha "Protótipo de case · não é produto oficial do iFood" (D164) |
| Link de avaliação (`acesso/[token]`) | "Acesso de avaliação", "restaurante de demonstração", "dados fictícios" | "Acesso de avaliação" (página privada, meta) + roteiro "Como testar sozinho" (revisão de produto B3) |
| Visão geral | "Restaurante de demonstração com 60 dias de dados de exemplo"; `DemoStatus` "Preparando seu restaurante de demonstração"; `TestGuide`; "Teste com outro cardápio"; "Criar outro restaurante" | selo "Restaurante de exemplo · histórico gerado" (só na Cantina); "Preparando o restaurante de exemplo"; "Primeiros passos" (restaurante criado); "Cadastrar outro restaurante" |
| Dashboard | "Para ver o painel cheio, use Simular 30 dias"; "Dados simulados · efeito programado: +0,20 visita · Como funciona" | estado vazio real ("Seu 1º check-in aparece aqui"); o selo do restaurante substitui o rótulo |
| Seletor de loja (`storeLabel`) | "demonstração" / "teste · ativo" / "teste · em ativação" | "exemplo" / "ativo" / "em ativação" |
| Assistente passo 1 | "Ou use um exemplo (fictício)"; "Importar do delivery (simulado)" + "Por quê?" | "Não tem o cardápio à mão? Use um de exemplo"; a importação sai (o "Por quê" vai para o FAQ da landing) |
| `ExtractionStatus` | "· importação simulada" / "processado anteriormente" | sai |
| Passo 4 | "O limite diário de IA desta demonstração…" | "O limite diário de IA foi atingido…" |
| Passo 5 | "Teste como cliente: leia o QR…" | "Veja como o cliente vê: leia o QR…" |
| Plano e histórico | "Exemplo pronto (escrito antes, sem IA ao vivo)"; "enviado para N clientes (simulado)"; "simulado: nada foi enviado"; "exemplo com cliente fictício"; "Reativação (simulada)" | "Plano pronto do restaurante de exemplo"; "Enviado para N clientes no app Comer Fora · M também por e-mail"; prévia "como o cliente recebe"; "Reativação" |
| Clientes | "Neste protótipo, use só dados fictícios"; "Cliente (fictício)" | "Esta base é do seu restaurante" (H5); primeiro nome + inicial |
| Configurações | "Endereço (fictício)"; "Excluir restaurante de teste"; "Faixa para testar" | "Endereço"; "Excluir restaurante"; "Faixa para ver como fica" |
| `CreateRestaurantButton` | "já tem 3 restaurantes de teste" | "já tem 3 restaurantes cadastrados" |
| Impresso (`KitPiece.tsx`) | "protótipo de case, não oficial" | mantém 1 linha "Protótipo de case · não é produto oficial do iFood" (D164) |
| Validar código | "· Só no teste: liberado hoje, fora do horário" | "· liberado hoje pelas ferramentas do avaliador" |
| Página do cliente | título "Comer Fora (protótipo)"; "Endereço fictício."; descrição "Restaurante fictício…" | título "{Restaurante} · Comer Fora"; sem a linha; descrição neutra (seed v4 + UPDATE da 0006) |
| Identificação | pré-preenchida (sobrenomes "Fictício/Teste…", DDD 00), "Gerar outros dados fictícios", "Aceito usar estes dados neste protótipo", "Nada é enviado neste protótipo" | §4.3 |
| `CheckinResult` | caixa "teste · Só no restaurante de teste" + "Testar como outro cliente (fictício)" | sai; o grupo de controle passa a aparecer só para o dono no feed da S5.1; "Sair" na Jornada |
| Convite (`TestAdvance`) | "Para testar: antecipar 1 dia" | sai (vai para os Bastidores) |
| Jornada | título "(protótipo)"; "Testar como outro cliente (fictício)" | "Sua jornada"; "Sair" e "Apagar meus dados"; "Seus convites" (§4.5) |
| MCP | descrição "reativação simulada" | "reativação (app e e-mail)" |
| Seed | sobrenomes "Fictício/Exemplo/Teste/Demonstração/Protótipo/Simulado"; endereço "Rua das Laranjeiras Fictícias"; descrição "Restaurante fictício…" | 6 sobrenomes comuns (mesma lista, mesmo tamanho → mesma sequência do gerador); "Rua Nonna Lucia, 120 – São Paulo – SP"; descrição sem a frase. `SEED_VERSION` 4 |
| Restaurante criado | `kind='teste'`, slug `teste-xxxxxxxx`, endereço "Rua Exemplo Fictícia, 100" | enum interno mantido (§13); slug pelo nome (`pizzaria-do-joao-3f2a`); endereço do assistente ou "Endereço não informado" |
| Rotas que saem | `api/parceiro/simular/*`, `api/cliente/convite/antecipar`, `api/cliente/trocar`, `/trocar-lado`, adaptador `delivery-import-simulated`, `fictitious-identity`, `TestGuide`, `TestAdvance`, `testNote` | o mecanismo `advance-invite.ts` fica, chamado só pelas Ferramentas do avaliador |
| Rodadas antigas de "Simular" | `simulation_runs.kind='botao'` em restaurantes de donos | `clearRun` no boot, uma vez (revisão técnica B4) |

### 4.3 Identificação e login do cliente (D154, D161, D165)
1. **Formulário** (bottom sheet "Entre para ativar seus benefícios"):
   - campos vazios: **Nome**, **Telefone** (máscara `(00) 90000-0000`), **E-mail**;
   - interruptores "**Convites por e-mail**" e "**Avisos no app**", ligados (D165). WhatsApp e Push saem da tela, porque não são enviados; nas linhas novas, `opt_whatsapp=false` e `opt_push=false`;
   - aceite obrigatório: "Aceito receber o código e os convites deste restaurante";
   - a linha fixa: "**Protótipo de case, não é o iFood. Seus dados são apagados em 7 dias.**";
   - botão "Enviar código".
2. **Código:** "Enviamos um código para a•••@g•••.com" → 6 dígitos → "Entrar". Também "Reenviar" (com limite) e "Trocar e-mail".
3. Ao confirmar: o cliente é criado ou reconhecido, o cookie é gravado e o check-in segue sozinho, como hoje depois da identificação.

**Regras:**
- **Identidade = e-mail** (`email_hmac`, finalidade `cliente-email:`).
- **Vínculo:**
  - e-mail já existe → mesmo cliente;
  - e-mail novo + telefone existente sem e-mail + mesmo nome → o e-mail é gravado nesse cliente (clientes de antes da S4);
  - qualquer outro caso → cliente novo (o telefone deixou de ser único).
- **Código:** 6 dígitos, 10 min, 5 tentativas, uso único. O código novo invalida o anterior do mesmo e-mail.
- **Limites:**
  - por e-mail: 3 em 15 min e 6 por dia;
  - por IP: 30 por hora (Wi-Fi do salão é compartilhado);
  - global: 500 por dia, com isenção para `PRESENTER_EMAILS`;
  - confirmar: 30 por hora por IP.
- **Cookie:** 180 dias, com finalidade nova (`cliente2:`). Os cookies antigos deixam de valer e o cliente entra de novo.
- **Retenção (D161):** a PII (nome, telefone, e-mail) é apagada **7 dias sem atividade** (último check-in ou login), de carona no `cleanup`. O cliente continua como linha anônima para as métricas. "Apagar meus dados" faz o mesmo na hora e limpa o cookie.
- **E2E:** padrão da D123: `e2e-cliente+N@exemplo.invalid` + cabeçalho com o token. O código volta na resposta, sem envio e sem limites. Um único teste passa pelo simulador do SES.
- **Saída de emergência:** flag `login_cliente_email` (ligada). Desligada, o formulário envia direto, sem código, e o cliente é criado com o e-mail não verificado.

**E-mail do código** (texto simples, sem logo):
- assunto "Seu código: 123456 · {Restaurante}";
- corpo: o código, a validade de 10 min, "Se não foi você, ignore este e-mail";
- rodapé "Protótipo de case · não é produto oficial do iFood".

### 4.4 Restaurante real e "Primeiros passos"
- "Cadastrar meu restaurante" cria o restaurante com slug pelo nome (depois do passo 2 do assistente). O enum interno continua `teste`.
- "Primeiros passos" aparece na Visão geral do restaurante criado. É uma checklist que se marca sozinha pelos eventos:
  1. Kit impresso e marcado "no salão";
  2. 1º check-in;
  3. 1º código validado;
  4. 1º plano aprovado.

  Cada item leva à tela certa. Um link discreto: "Avaliando o produto? Ferramentas do avaliador".
- "Ver minha página" (Portal, cabeçalho da Visão geral) abre `/r/<slug>` em nova aba.

### 4.5 Reativação entregue (D155, D163)
- Ao aprovar o plano, para cada convite real da reativação, é criada uma `customer_messages` (`kind='reativacao'`), e o cliente vê o convite em **Jornada › Seus convites**, com o selo "Novo" até abrir.
- **Depois do commit**, um e-mail sai para quem tem `opt_email` e um e-mail válido:
  - texto simples, com o convite escrito pelo plano (o mesmo texto que o revisor confere), a faixa, a validade, o link para a página do restaurante e o rodapé de protótipo;
  - teto de 200 e-mails por restaurante por dia;
  - não envia para `.invalid` nem para o simulador do SES.
- O **convite nascido na mesa** também gera uma mensagem (`kind='convite_mesa'`) e um e-mail na hora.
- O **grupo de controle** continua com o convite invisível: nenhuma mensagem, nenhum e-mail.
- Texto do dono: "Enviado para N clientes no app Comer Fora · M também por e-mail". `plan_sends.channel='app_email'` nas linhas novas.
- O público da reativação usa `optApp OR optEmail`.

### 4.6 Ferramentas do avaliador (`/bastidores/avaliador`, D153)
Exige a sessão do dono e mostra só os restaurantes dele.
- **Roteiro "Como testar sozinho"** (4 passos), que também aparece na página do link de avaliação.
- **"Avançar 1 dia":**
  - escolhe o restaurante e recua 1 dia os convites ativos e os check-ins de hoje dos clientes reais (sem `simulation_run_id`), usando `advance-invite.ts`;
  - se agora estiver fora da faixa, libera o convite só hoje;
  - o código e a tela Validar mostram "liberado hoje pelas ferramentas do avaliador".
- **"Ver como cliente reativado":** grava neste aparelho o cookie de um cliente do histórico da cópia do próprio dono que recebeu convite de reativação, e abre a Jornada. Serve à demo e à E2E da reativação.
- **"Como funciona"** (público) ganha:
  - o que é histórico gerado (seed) e seus parâmetros;
  - o que é real (login, e-mail, check-in, códigos, convites, IA);
  - o dado pessoal real e o risco (D154, D161, D165);
  - as Ferramentas do avaliador.

## 5. Telas, estados e textos
- **Identificação, formulário:**
  - estados: vazio, erro por campo ("Informe seu nome", "Use o formato (00) 90000-0000", "Informe um e-mail válido", "Marque o aceite para continuar"), enviando, limite ("Muitas tentativas. Tente de novo em N min");
  - envio indisponível: "Não conseguimos enviar o código agora. Tente de novo em instantes."
- **Identificação, código:**
  - estados: aguardando, incorreto ("Código incorreto · N tentativas restantes"), expirado ("O código venceu. Peça outro."), bloqueado, confirmando.
  - Foco no campo; `inputMode="numeric"`; `autocomplete="one-time-code"`.
- **Primeiros passos:** 4 itens com ícone de feito/pendente; todos feitos → some. Celular e computador.
- **Seus convites (Jornada):** lista com o selo "Novo"; vazio: "Quando um restaurante te convidar, o convite aparece aqui."
- **Ferramentas do avaliador:**
  - sem sessão do dono: "Entre no Portal para usar as ferramentas";
  - resultado do "Avançar": "Pronto: N convites avançados. Faça check-in de novo para receber o código."
- **Acessibilidade:** alvos ≥ 44 px, foco preso no sheet, Esc fecha, contraste AA, rótulos completos.

## 6. Técnica

### 6.1 Arquivos
- **Novos:**
  - `src/modules/salao/application/customer-login.ts` (pedir e confirmar código; vínculo; e-mail do código);
  - `src/modules/salao/application/customer-privacy.ts` (apagar meus dados; retenção de 7 dias);
  - `src/modules/salao/application/deliver-messages.ts` (mensagens no app + e-mails depois do commit);
  - `src/modules/salao/application/evaluator-tools.ts` ("Avançar 1 dia" por restaurante; "Ver como cliente reativado");
  - `src/modules/onboarding/application/first-steps.ts` (Primeiros passos derivados dos eventos);
  - rotas: `app/api/r/[slug]/identificacao/confirmar/route.ts`, `app/api/cliente/{sair,apagar}/route.ts`, `app/api/bastidores/avaliador/route.ts`;
  - páginas: `app/bastidores/avaliador/page.tsx`;
  - UI: `src/ui/cliente/LoginSheet.tsx` (substitui `IdentifySheet`), `src/ui/cliente/InviteInbox.tsx`, `src/ui/portal/FirstSteps.tsx`.
- **Alterados:**
  - `identify-customer.ts` (lógica de vínculo por e-mail, que vira a função interna `upsertCustomerIdentity`);
  - `customer-session.ts` (finalidade `cliente2:`);
  - `approve-plan.ts` (canal `app_email`; mensagens; e-mails depois do commit);
  - `do-checkin.ts` (mensagem do convite da mesa; sem `testNote`);
  - `contas/application/cleanup.ts` (PII de cliente com 7 dias; códigos de cliente com 1 dia);
  - `contas/application/{request-code,verify-code}.ts` (texto do e-mail; `owners.email_enc`);
  - `test-restaurants.ts` (slug pelo nome; sem endereço fictício);
  - `config/domain/flags.ts` (flags novas, §6.4);
  - os arquivos de tela do inventário (§4.2).
- **Removidos:** `TestGuide.tsx`, `TestAdvance.tsx`, `fictitious-identity.ts`, `delivery-import-simulated.ts`, `app/api/parceiro/simular/*`, `app/api/cliente/convite/antecipar`, `app/api/cliente/trocar`, `app/trocar-lado`.

### 6.2 Interfaces produzidas (assinaturas)
```ts
// salao/application/customer-login.ts
export const customerLoginInputSchema: z.ZodType<{ name: string; phone: string; email: string; optEmail: boolean; optApp: boolean; accept: true }>;
export function requestCustomerCode(db: Db, p: { restaurantId: string; restaurantName: string; input: CustomerLoginInput; ip: string; now: Date; sender: MailSender | null; env: LoginEnv; e2eToken?: string | null }): Promise<{ ok: true; hint: string; e2eCode?: string } | { ok: false; erro: "email_invalido" | "limite" | "envio_indisponivel" | "envio"; retryAfterSec?: number }>;
export function confirmCustomerCode(db: Db, p: { restaurantId: string; email: string; code: string; ip: string; now: Date }): Promise<{ ok: true; customerId: string; created: boolean } | { ok: false; erro: "email_invalido" | "formato" | "incorreto" | "expirado" | "bloqueado" | "sem_codigo" | "limite"; restantes?: number }>;
// salao/application/customer-privacy.ts
export function deleteCustomerData(db: Db, customerId: string): Promise<void>;
export function purgeStaleCustomerPii(db: Db, now: Date): Promise<number>; // 7 dias sem atividade
// salao/application/deliver-messages.ts
export function queueInviteMessages(tx: Executor, p: { restaurantId: string; inviteIds: string[]; kind: "convite_mesa" | "reativacao"; now: Date }): Promise<number>;
export function sendPendingInviteEmails(db: Db, p: { restaurantId: string; sender: MailSender | null; now: Date; limitPerDay?: number }): Promise<{ sent: number; skipped: number }>;
// salao/application/evaluator-tools.ts
export function advanceRestaurantOneDay(db: Db, p: { ownerId: string; restaurantId: string; now: Date }): Promise<{ ok: true; advanced: number } | { ok: false; erro: "nao_e_seu" | "nada_para_avancar" }>;
export function pickReactivatedCustomer(db: Db, p: { ownerId: string; now: Date }): Promise<string | null>;
// onboarding/application/first-steps.ts
export type FirstSteps = { kitNoSalao: boolean; primeiroCheckin: boolean; primeiroCodigo: boolean; primeiroPlano: boolean };
export function firstSteps(db: Db, restaurantId: string): Promise<FirstSteps>;
// shared/crypto.ts (feito na S4.1)
export function hmacCustomerEmail(normalizedEmail: string): string;
export function encryptEmail(email: string): string;
export function decryptEmail(enc: string | null | undefined): string | null;
```

### 6.3 Dados — migração `0006_s4_produto_real` (feita na S4.1, no branch)
- **Tabelas novas** (as da S6 entram já aqui, para ter uma migração só):
  - `customer_login_codes` (`email_hmac`, `code_hmac`, `restaurant_id`, `payload` jsonb sem PII em claro, `attempts`, `expires_at`, `used_at`);
  - `customer_messages` (`customer_id`, `restaurant_id`, `invite_id`, `kind` ∈ convite_mesa | reativacao | lembrete, `read_at`, `emailed_at`; único `(invite_id, kind)`);
  - `weekly_digests` (único `(restaurant_id, week_key)`; `status` ∈ reservado | enviado | falhou);
  - `digest_tokens` (hash; `plan_id`; uso único);
  - `waiter_tokens` (hash único; `revoked_at`).
- **Colunas novas:**
  - `customer_contacts`: `email_hmac` (único), `email_enc`, `email_hint`, `last_seen_at`;
  - `owners.email_enc`;
  - `restaurant_customers.opt_email` (padrão `true`);
  - `weekly_plans.agent_steps`.
- **Mudanças em restrições** (declaradas como não aditivas):
  - `customer_contacts.phone_hmac` perde o `UNIQUE` e ganha índice comum;
  - `kit_pieces_kind_check` aceita `porta_conta`.
- **Dados:**
  - UPDATE da descrição e do endereço das cópias da Cantina e do endereço padrão dos restaurantes criados;
  - troca dos 6 sobrenomes nos clientes existentes.
- `SEED_VERSION` 4.

### 6.4 Flags (`config/domain/flags.ts`)
- **Existentes:** `ab`, `revisor`, `aprende`, `insight_operacao`, `mcp`.
- **Novas:**
  - `login_cliente_email` (S4, emergência; ligada);
  - `painel_valor`, `copy_v2`, `explica_ia` (S5);
  - `resumo_email`, `agendador`, `modo_garcom`, `porta_conta` (S6, ligadas quando prontas);
  - `plano_agente` (S6; ligada só se ganhar na medida — D159).
- **Regra de corte:** a flag de um recurso que não fechar até domingo às 22h nasce desligada.

### 6.5 Segurança e privacidade
- **E-mail:** HMAC com finalidade própria + AES-256-GCM. A chave é derivada do `SESSION_SECRET` por HKDF (`email-enc:v1`) — §14, ajuste da S4.1, sem variável de ambiente nova.
- **Onde a PII nunca entra:** log, prompt, MCP, rastro e resposta de API (só a dica mascarada).
- Rotas de cliente com `rejectCrossSite` (JSON), limites e restaurante pelo slug.
- O código do cliente é guardado como HMAC amarrado ao e-mail (`hmacLoginCode`).
- As Ferramentas do avaliador exigem a sessão do dono e checam o dono de cada restaurante.
- **Riscos aceitos pelo candidato:** dado pessoal real de clientes (D154/D161, retenção de 7 dias) e consentimento ligado por padrão (D165).

### 6.6 Operação
- **E-mail:** SES de `sa-east-1` com o remetente da D135. Preflight antes do merge.
- **Aparelhos da demo:** logados na segunda de manhã, com endereços com "+".
- **Nada novo no Easypanel** (a chave vem por HKDF).

## 7. Testes
- **Unidade:**
  - `email-crypto.test.ts`: ida e volta, IV novo, adulteração → `null`, finalidade própria do HMAC (✅ na S4.1);
  - `customer-login` (domínio): normalização e máscara do e-mail; E2E só com o padrão `e2e-cliente+N@exemplo.invalid`;
  - `first-steps`: os 4 itens a partir de eventos;
  - simulador: o IC da semente 20261157 continua positivo com os sobrenomes novos (o teste da S3, sem alteração).
- **Integração:**
  - **login do cliente:** código certo → cliente criado e `optEmail/optApp` gravados; código errado → `restantes` 4…0 e depois `bloqueado`; expirado; código novo invalida o anterior; e-mail existente → mesmo cliente; telefone antigo + mesmo nome sem e-mail → vincula; telefone antigo + outro nome → cliente novo; limites por e-mail, IP e global (isenção do apresentador); `login_cliente_email` desligada → cliente sem código;
  - **privacidade:** "Apagar meus dados" remove o contato e mantém as métricas; a retenção apaga a PII com 7 dias e não toca o seed;
  - **mensagens:** reativação cria mensagem só para convidáveis; o grupo de controle não tem nada; e-mail só com `optEmail`, depois do commit; teto diário; `.invalid` e o simulador não contam; convite da mesa gera mensagem e e-mail;
  - **avaliador:** "Avançar 1 dia" só nos restaurantes do dono e só em clientes reais; "Ver como cliente reativado" devolve um cliente com mensagem de reativação na cópia do dono;
  - **migração 0006** sobre o banco da S3: cópias atualizadas, nenhum nome com os sobrenomes antigos (✅ parcial na S4.1: db/seed/copy-vitrine verdes).
- **Reescritos:** `teste-restaurante.test.ts` (vira `restaurante.test.ts`), `checkin.test.ts:181-197` (sem `testNote`), `salao/misc.test.ts:59` (sem `fictitious-identity`).
- **E2E (Playwright, local e produção):**
  - **ciclo completo:** dono cria restaurante → ativa → kit → "Ver minha página" → cliente entra por e-mail (padrão D123) → check-in → código → dono valida → Primeiros passos marcados → Ferramentas do avaliador "Avançar 1 dia" → check-in de novo → código do convite → validar mostra "liberado hoje pelas ferramentas do avaliador";
  - **reativação:** aprovar o plano na Cantina → "Ver como cliente reativado" → "Seus convites" com o selo "Novo";
  - **grupo de controle:** clientes em sequência até um sem convite. Nenhum texto sobre grupo de controle aparece para o cliente;
  - **selo:** só na Cantina; restaurante criado sem selo;
  - **varredura de textos:** nas rotas do produto (entrada, login, Visão geral, Plano, Kit, Clientes, Configurações, Validar, `/r/<slug>`, check-in, Jornada), sem "simulad", "fictíci", "de teste", "Para testar", "demonstração" nem "Só no teste", fora das exceções;
  - **SES:** 1 teste pelo simulador do SES;
  - **reescritos:** `volta.spec.ts` (inteiro), `cliente.spec.ts`, `dono.spec.ts`, `painel.spec.ts`, `entrada.spec.ts`.

## 8. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| A S4 não tem flag e troca a identidade do cliente | Sub-fatias verdes antes da próxima; E2E reescritas cedo; flag de emergência `login_cliente_email` |
| SES cai na demo ou na avaliação | Preflight; mensagem clara; flag de emergência; aparelhos logados antes; `PRESENTER_EMAILS` fora do limite global |
| Atrito do código por e-mail derruba leitura → check-in | Cookie de 180 dias; e-mail em segundos; funil mede "pediu código → confirmou" (S5.1) |
| Dado pessoal real + cara de iFood (anti-objetivo) | Linha de consentimento, 7 dias, "Apagar meus dados", criptografia, fora de log/prompt/MCP; declarado em "Como funciona"; risco aceito (D154, D161) |
| Reputação do remetente compartilhado (D135) | Formato validado, teto diário, sem `.invalid`/simulador, texto simples |
| Avaliador não acha "Avançar 1 dia" | Link em Primeiros passos e no roteiro da página do link de avaliação |
| Esconder que o histórico é gerado | Selo da Cantina (D162) + "Como funciona" + slide e entrevista |
| Dados antigos em produção ("Fictício", rodadas "Simular") | UPDATE na 0006 + `clearRun` das rodadas `botao` |

## 9. Fora de escopo da S4
WhatsApp/push real; login iFood real; o painel em R$, o feed, as landings e o "Por que" (S5); o resumo semanal, o garçom, o agente e o porta-conta (S6); renomear enums internos.

## 10. Perguntas respondidas pelo candidato (21/11, em ordem)
1. **Prazo:** S4+ até segunda 10h (não domingo 18h nem só limpeza).
2. **Valor ao dono:** painel em R$ + meta; atividade ao vivo + garçom; kit ampliado. Junto, a pergunta "sinto pouca inovação, resultado e técnica; seja crítico".
3. **Conversão:** página do QR, convite com agenda, landing (sem "traga um amigo").
4. **Apostas:** ciclo semanal por e-mail, plano como agente e "Por que esta oferta?" (kit ampliado só no porta-conta).
5. **Volta sem "Antecipar":** ferramenta nos Bastidores.
6. **Dados do restaurante:** pediu exemplo e sugeriu "vídeo com IA + sistema real só com seed" → confirmou "sistema real só com seed" e vídeo de telas reais.
7. **Identificação:** primeiro "campos vazios, digitar livre"; depois perguntou "como é o login do cliente? pelo e-mail identificaria?" e escolheu "login por nome, telefone e e-mail + código por e-mail".
8. **Reativação:** entregar no app do cliente.
9. **Atalhos:** só "Como funciona" na barra.
10. **Agente:** decidir por número.
11. **Ordem de corte:** a proposta.
12. **Depois da revisão de produto:** login completo no check-in (com consentimento e 7 dias); selo "Restaurante de exemplo"; tudo por e-mail; rodapé no impresso e no e-mail + barra sem "dados fictícios" (não aprovou consentimento desmarcado).
13. **Depois da revisão técnica:** 1 merge no fim; com exemplos, "por evento + agendador; provável que entregue antes de segunda 8:30".
14. **Fatiamento:** "precisa ser dividido de forma detalhada em fatias testáveis"; "a antiga S4 vai para a última fatia e as outras entram na frente".
15. "Não é pra começar a implementar nenhuma fatia ainda. Primeiro registrar tudo."
16. "Vamos planejar uma a uma quando formos fazer" → S5, S6 e S7 ganham planejamento próprio (com perguntas e os 2 revisores) na vez de cada uma; o detalhe da S4 é o deste documento.

## 11. Revisão independente do plano (21/11, 2 subagentes — D95)
**Produto** (bloqueante / importante / menor → destino):
- **B1** dado real numa página com cara de iFood, sem aviso → candidato → **D161**.
- **B2** resultado programado sem rótulo; "30 dias" errado → candidato → **D162**.
- **B3** avaliador sozinho (beco do grupo de controle, "Avançar" escondido, rótulo, roteiro) → **[C]**: roteiro na página do link e em Primeiros passos, rótulo neutro, "Ver como cliente reativado".
- **I1/I2** atrito e demo → candidato → **D161** (aparelhos logados antes).
- **I3** e-mails com link contra a D118 → candidato → **D163**.
- **I4** agente contra a D215 → registrado como **D166**.
- **I5** itens que eram do candidato → candidato → **D164, D165**.
- **Menores:** .ics de 1 evento, link "Veja o que seu cliente vê", 4 estados, FAQ → **[C]**.
- Cortar P6/P8 → mantidos no fim da ordem de corte (D160).

**Técnica:**
- **B1** sem destinatário para o resumo → `owners.email_enc` **[C]**.
- **B2** identidade do cliente → e-mail como chave, telefone não único, vínculo **[C]**.
- **B3** E2E inviáveis → padrão D123 + "Ver como cliente reativado" **[C]**.
- **B4** dados de produção → UPDATE + `clearRun` **[C]**.
- **B5** SES como ponto único → flag de emergência + aparelhos logados **[C]**.
- **I1–I8** → **[C]**: gateway com ferramentas, agendador robusto, aprovação por e-mail, consentimento/envio, contradições na espec. v3, topo em R$, juiz em pares, varredura pelo Playwright.
- **Menores** → **[C]**.
- Merge intermediário → candidato → **D167**. Cortar o agendador → candidato → **D168**.
- **Fato conferido:** a S3 levou ~4 h do plano aprovado à produção; o gargalo é a S4 sem flag, as E2E e o SES.

## 12. Ordem de implementação (S4)
1. **S4.1** (✅ no branch, `7b01c74`): 0006, criptografia, seed v4.
2. **S4.2:** login do cliente: caso de uso (TDD) → rotas → `LoginSheet` → Jornada (Sair/Apagar) → retenção → E2E do login.
3. **S4.3:** limpeza do inventário (§4.2) → Primeiros passos → slug pelo nome → Ferramentas do avaliador → "Como funciona" → varredura de textos → E2E reescritas.
4. **S4.4:** mensagens + e-mails depois do commit → "Seus convites" → textos do dono → E2E da reativação.

## 13. Itens [C] (D169)
- **E-mail do cliente:** HMAC `cliente-email:` + AES-256-GCM; PII apagada com 7 dias sem atividade.
- **Nome do cliente para o dono:** primeiro nome + inicial (aplicado na S5.1, junto com o feed).
- **Enums internos mantidos:** `kind='teste'`, `simulation_runs`, `channel='crm_simulado'` nas linhas antigas.
- **Slugs pelo nome.**
- **Interruptores:** "Convites por e-mail" + "Avisos no app"; WhatsApp/Push saem da tela.
- **Cookie:** finalidade `cliente2:` (força novo login).
- **Limites do login do cliente:** §4.3.
- **Teto de e-mails:** 200 por restaurante por dia.
- **Texto do e-mail do código:** §4.3.
- **"Ver como cliente reativado"** e o rótulo neutro do "Avançar".
- **`owners.email_enc`** (muda a D118; contas antigas e as do link do avaliador ficam sem resumo por e-mail, só com a prévia da S6).

## 14. Mudanças durante a implementação
- **21/11, S4.1** (antes do pedido "primeiro registrar tudo"; commit `7b01c74` no branch da sessão, fora da `main`):
  - a migração 0006 foi gerada com as tabelas de S4–S6;
  - criptografia e HMAC do e-mail com teste;
  - seed v4;
  - **ajuste [C]:** a chave do e-mail é **derivada do `SESSION_SECRET` por HKDF** (`email-enc:v1`), no lugar de uma variável `CUSTOMER_EMAIL_KEY`. Motivo: trocar variáveis no Easypanel exige substituir o ambiente inteiro (`updateAppEnv` destrutivo) perto do congelamento. Trade-off: girar o `SESSION_SECRET` invalida os e-mails guardados (aceitável: retenção de 7 dias).
  - Verificado: teste de unidade 3/3; integração db/seed/copy-vitrine 10/10; `tsc` e fronteiras limpos.
  - A execução ficou suspensa depois disso, a pedido do candidato.


---

## 15. Rodada própria da S4 (`planejar-fatia`, 21/11) — prevalece sobre as seções acima

## Decisões novas do candidato
| ID | Decisão | Alternativas recusadas |
|---|---|---|
| D171 | **Sem apagamento automático da PII do cliente.** Os dados ficam enquanto houver relação, como num CRM real (a base é do restaurante, H5). "Apagar meus dados" fica sempre disponível na Jornada. A linha do formulário passa a ser: "**Protótipo de case, não é o iFood. Você pode apagar seus dados quando quiser.**" Substitui a retenção de 7 dias da D161; o resto da D161 continua (login completo no check-in, aparelhos da demo logados antes). | Real + data final 31/12/2026 (recomendado); 30 dias depois da última visita; manter 7 dias |
| D172 | **O dono vê o grupo de controle já na S4.** A Visão geral ganha "Últimos check-ins de hoje" (lista curta, sem flag), e cada check-in do controle leva a marca "grupo de controle · sem convite (mede o efeito)". É a semente do feed da S5.1. O roteiro do avaliador ganha a dica "para testar outro cliente, saia e entre com outro e-mail (ex.: seu+2@gmail.com)". Para o cliente nada muda. | Ferramenta "novo cliente" sem e-mail nos Bastidores; só a dica no roteiro |

Explicação dada ao candidato antes da D171:
- apagar não é exigência do produto, é proteção de protótipo (o case proíbe "dados pessoais de ninguém"; LGPD, necessidade);
- um CRM real guarda o cliente enquanto há relação e consentimento;
- os 7 dias vinham do revisor, copiando a regra das contas de dono.

O candidato escolheu "sem apagar", aceitando o risco de dado pessoal real guardado sem prazo num protótipo. O risco fica declarado em "Como funciona" e preparado para a entrevista.

### Ajustes ao rascunho `docs/fatias/S4/planejamento.md`
- **§4.3** (login do cliente):
  - sai "Retenção (D161): a PII é apagada 7 dias sem atividade…";
  - entra: a PII fica até "Apagar meus dados" (D171);
  - `last_seen_at` continua sendo gravado (dado de atividade, útil para os segmentos);
  - a linha fixa do formulário fica com o texto novo da D171.
- **§4.4 / Visão geral:**
  - "Últimos check-ins de hoje" (D172): até 10 linhas;
  - cada linha: hora, primeiro nome + inicial, "1ª visita / volta", a marca do controle quando o cliente caiu nele, e "código validado" quando validou;
  - mesma consulta de ~3 s do painel;
  - estado vazio: "Nenhum check-in hoje ainda".
- **§4.6** (roteiro): + a dica do e-mail com "+".
- **§6.1:**
  - `customer-privacy.ts` fica só com `deleteCustomerData` (sai `purgeStaleCustomerPii`);
  - `cleanup.ts` só apaga códigos de cliente com mais de 1 dia;
  - novo `analytics/application/recent-checkins.ts` (consulta do dia em SP, restaurante da sessão);
  - novo `src/ui/painel/RecentCheckins.tsx`.
- **§6.5 / §8:** o risco "dado pessoal real sem prazo" é aceito pelo candidato (D171), mitigado por criptografia, HMAC, "Apagar meus dados" e fora de log, prompt e MCP.
- **§7 (testes):**
  - sai o teste de retenção de 7 dias;
  - entram: "Últimos check-ins" só do dia em SP e só do restaurante; marca do controle só para clientes do holdout; nome mascarado;
  - E2E: o check-in do cliente no grupo de controle aparece no painel do dono com a marca.
- **§13 [C]:** o nome do cliente para o dono passa a ser primeiro nome + inicial já na S4, porque a lista nova mostra nomes.
- **Itens [C] desta rodada:**
  - a página do cliente da Cantina não leva o selo "Restaurante de exemplo" (o selo é só no Portal; o fluxo do cliente é real);
  - no `/apresentacao`, a moldura do celular usa o mesmo cookie do aparelho da demo, que fica logado antes;
  - os e-mails do convite (mesa e reativação) são texto funcional e simples nesta fatia, e a copy fica para a S5.2.
- **Decisões a registrar:** D171 e D172 em `decisoes-e-tradeoffs.md`; D161 marcada como "ajustada por D171"; a especificação v3 (bloco do topo) ajustada; uma linha no log.

### Decisões do candidato depois da revisão independente
| ID | Decisão | Alternativas recusadas |
|---|---|---|
| D173 | **Formulário com o e-mail primeiro e telefone opcional.** Passo 1: e-mail + aceite → código. Passo 2, só para quem é novo: nome, telefone (opcional) e os interruptores "E-mail" e "Notificação no app". Quem volta digita só o e-mail e o código. Ajusta D154/D161 (os 3 campos de uma vez) | Sem telefone (recomendado); como decidido |
| D174 | **Link, telefone ou e-mail no texto do dono não vão por e-mail.** O convite com esse conteúdo vai só para o app, e o dono vê "textos com link ou contato não vão por e-mail". Na tela, o texto livre continua (D125) | Só texto da IA/modelo por e-mail; enviar como está |
| D175 | **Remetente dos e-mails aos clientes continua `msg.automato.pro`** (estende a D135). Texto simples, link de descadastro em todo e-mail, teto diário, nada para endereços de teste; risco com o candidato | Domínio novo neutro |
| D176 | **A Cantina pública é um restaurante normal** (a única diferença é o histórico do seed), com check-in liberado e sem aviso. Quem está logado como dono e clica em "Veja o que seu cliente vê" vai para a página da própria cópia. O roteiro manda usar "Ver minha página" | Só para ver (recomendado antes da explicação); normal sem ajuste |

### Revisão independente (21/11, 2 subagentes — D95)
Os dois leram o plano antes de a D171/D172 estar gravada. B3 (técnico) e B1/B2 (produto) já estavam cobertos por D171 e D172.

**Técnico:**
- **B1 (confirmado no código) → [C], corrigir no início da S4.2.** A 0006 tirou a unicidade do telefone, mas `identify-customer.ts:54` usa `onConflictDoNothing({ target: phoneHmac })`. O Postgres dá erro 42P10, e o branch está vermelho na identificação. Correção:
  - `upsertCustomerIdentity` com ON CONFLICT em `email_hmac`;
  - com a flag de emergência desligada, nunca casar cliente por e-mail sem código: cria cliente novo com `email_hmac` nulo;
  - suíte de integração inteira antes de seguir.
- **B2 → [C].** O simulador não grava `opt_email`:
  - `UPDATE restaurant_customers SET opt_email = opt_app` na 0006 (ainda não está na `main`, dá para editar e regenerar o snapshot);
  - `optEmail: c.optIn` em `simulacao/application/persist.ts`;
  - uma função única `hasOptIn` usada em `customers.ts:79`, `insights.ts:107` e `CustomersView`.
- **I1 → [C].** Consentimento por restaurante: na 1ª vez num restaurante novo, uma folha de 1 toque com o aceite daquele restaurante; `opt_email=false` até o aceite.
- **I2 → [C].** Sai a regra de vínculo com o telefone antigo. Os clientes antigos tinham dados fictícios, e a regra permitiria tomar outro cliente.
- **I3 → [C].** Duas confirmações ao mesmo tempo: código com `FOR UPDATE` + ON CONFLICT no `email_hmac` + apagar o cliente órfão (o padrão de `verify-code.ts`). E-mail que volta atualiza nome, telefone e interruptores só se o cliente mudar.
- **I4 → [C].** Envio depois do commit:
  - `customer_messages.email_status` (pendente / enviado / pulado / falhou) com índice parcial, na 0006;
  - reserva com `UPDATE … WHERE email_status='pendente' … FOR UPDATE SKIP LOCKED RETURNING`;
  - varredura por `plan_send_id` ou por cliente;
  - gancho com `after()` na rota do plano, na aprovação via MCP (`mcp/server.ts:83`) e na rota do check-in;
  - o "M também por e-mail" do dono = número enfileirado.
- **I5 → [C].** "Avançar 1 dia":
  - também nas cópias da Cantina (hoje `advance-invite.ts:23` exige `kind='teste'`), só em clientes reais;
  - age nos convites emitidos hoje;
  - uma transação por convite;
  - `liberatedToday` neutro na view;
  - `do-checkin.ts:73` passa a usar `anyTimeDay === hoje`;
  - E2E de produção: a conta e2e pode avançar no restaurante E2E fixo.
- **I6 → [C].** Completar a lista de remoção e de testes:
  - código: `entrar/page.tsx:15`, `simulate-test.ts`, `extract-menu.ts:21,30`, `cardapio/extrair/route.ts:19`, `Presenter.tsx:57`, `mcp/server.ts:84`, `Roteiro.tsx` (reescrito), `textos.ts:11`, `portal-context.ts:14`, `PlanManager.tsx:106,242,250`, `Step4Pacote.tsx:22`, `RestaurantView.tsx:107`, `Dashboard.tsx:61,133,156`, `BastidoresConfig.tsx:217`;
  - testes: `apresentacao.spec.ts:16`, `fumaca.spec.ts:4`, `componentes.spec.ts:5`, `helpers.ts:5` (barra), e todo POST direto a `/identificacao` (`cliente.spec.ts:26`, `dono.spec.ts:49,179,232`, `painel.spec.ts:46`, `volta.spec.ts:52`), que passa a usar o helper `loginCustomer()`;
  - documentos: `regras.md:16,34,56` e espec. 4.2 e 4.7 também mudam.
- **I7 → [C].** E2E de produção:
  - id largo no e-mail de teste (`e2e-cliente+<timestamp><n>@exemplo.invalid`);
  - simulador do SES com `success+<execução>@simulator.amazonses.com`, isento do limite por e-mail.
- **Menores → [C]:**
  - o nome no código de login vai criptografado (ou o pendente é apagado em "Apagar meus dados");
  - o check-in exige o contato (cookie de cliente apagado → login);
  - o check-in atualiza `last_seen_at`;
  - "Últimos check-ins" no payload de 3 s (`funil`), pelo índice `checkins_restaurant_at_idx`, sem seed, `LIMIT 10`;
  - uma função única de mascarar nome; "Cliente" quando apagado;
  - o controle só atrás de `requireStore`;
  - slug definido no passo 2 e congelado quando existe kit;
  - corrigir "SEED_VERSION recria as cópias": as cópias antigas dependem do UPDATE.

**Produto:**
- **B3 (Cantina pública) → candidato → D176.**
- **I1 → [C].** Link "Não quero mais receber · Apagar meus dados" em todo e-mail ao cliente (token assinado + confirmação por POST), mais o cabeçalho `List-Unsubscribe`.
- **I2 → candidato → D174.**
- **I3/I4 → candidato → D173.** Também [C]: `type="email"`, `autocomplete` certo, estado salvo em `sessionStorage`, "Não chegou? Veja o spam" e espera de 30 s no "Reenviar".
- **I5 → [C].** O aceite obrigatório cobre só o uso dos dados ("O restaurante vê seu primeiro nome e a inicial. Seus dados ficam guardados até você apagar."). Os interruptores são as únicas escolhas de marketing.
- **I6 → [C].** No passo do código, mostrar o e-mail inteiro + "Trocar e-mail".
- **I7 → [C].** "Primeiros passos": 1) "Kit pronto e marcado no salão (não precisa imprimir)"; 2) 1º check-in; 3) 1º código validado; 4) "1º cliente voltou com convite" (link para as Ferramentas do avaliador). Sai "1º plano aprovado".
- **I8 → [C].** "Ver como cliente reativado" avisa antes de trocar, marca a Jornada com "Cliente do histórico gerado" e oferece "Voltar ao meu login".
- **I9 → [C].** "Convite entregue a N clientes em Sua jornada · M também por e-mail"; "Plano pronto do restaurante de exemplo (escrito antes, sem IA ao vivo)".
- **M1/M2/M3 → [C].** Inventário completado (como I6 técnico + a coluna de opt-in em `CustomersView` vira E-mail/App). A varredura sem diferenciar maiúsculas, com `testar`, `\bdemo\b` e `protótipo` fora da barra e dos rodapés, e cobrindo `/apresentacao`. "Prévia nesta faixa".
- **M4 → [C]** (fidelidade a `referencias/app/13-jornada.png` e `14-notificacoes.png`):
  - "Seus convites" atrás do ícone de balão, com ponto vermelho e `aria-label`;
  - interruptores, "Sair" e "Apagar meus dados" atrás da engrenagem;
  - mantém "Comunicações de promoções" e "Notificação no app"; o interruptor novo é "E-mail".
- **M5 → [C].** Botão principal fixo no rodapé da folha; a linha de consentimento logo acima dele.

### Ordem de implementação
S4.1 (✅ no branch) → S4.2 login do cliente → S4.3 limpeza + Primeiros passos + "Últimos check-ins" + Ferramentas do avaliador → S4.4 reativação entregue. Cada sub-fatia fecha verde antes da próxima. A revisão e o merge acontecem depois da S6 (D167).


## 16. Mudanças durante a implementação (S4.2–S4.4, 21/11) — IA [C] (D178)
- **Nome e telefone opcionais no banco** (`customer_contacts.name/phone_*` anuláveis): o cliente é criado ao confirmar o código e completa o perfil no 2º passo (D173). A 0006 foi regenerada (ainda fora da `main`), também com `customer_messages.email_status` e `opt_email = opt_app`.
- **Sem pré-preenchimento de telefone**: o interruptor "WhatsApp/Push" sai da tela; "E-mail" e "Notificação no app" ficam (como `14-notificacoes.png`).
- **Retenção**: nenhum apagamento automático (D171); `cleanup` não mexe em clientes.
- **Assistente sem campo "Endereço"**: o endereço continua editável em Configurações (onde já existia); restaurante novo nasce sem endereço ("Endereço não informado").
- **Slug provisório** `restaurante-xxxxxxxx` até o passo 2; depois, nome + sufixo, congelado quando há kit.
- **"Seus convites" simplificado**: seção na Jornada com o selo "N novos" (não atrás do ícone de balão); "Sair" e "Apagar meus dados" atrás da engrenagem (como o print).
- **Sem cabeçalho `List-Unsubscribe`**: o adaptador do SES envia só assunto/texto/HTML; o link de descadastro vai no corpo de todo e-mail, com confirmação por POST.
- **A barra continua dentro dos bottom sheets** (é a barra de protótipo, mantida pela D164), com o texto novo.
- **Título da aba**: "Comer Fora no Salão" (sem "protótipo de case"); a meta description mantém "Protótipo de case. Não é produto oficial do iFood.".
- **Veredito "trocar"**: "vale trocar a oferta" (antes "vale testar outra oferta"); planos já gravados corrigidos na 0006.
- **Rótulos das regiões de código** únicos ("Benefício de 1ª visita · …", "Convite de hoje · …"): achado de acessibilidade na E2E da volta (dois códigos com o mesmo título).
- **`/api/parceiro/restaurantes` (excluir)** só aceita UUID (antes, um id inválido dava erro 500).
- **Ferramentas do avaliador** em `/api/avaliador/[acao]`, com sessão do dono; a conta do E2E pode avançar o restaurante E2E fixo.
- Verificado: unidade + integração 377/377; E2E local 70/70 (banco limpo); `tsc`, lint (só avisos antigos de `package.ts`) e fronteiras limpos.
