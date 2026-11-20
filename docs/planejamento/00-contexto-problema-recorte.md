# 00 — Contexto, problema, recorte e decisões macro

Status: ✅ decidido em 19/11/2026 (decisões detalhadas e posteriores estão em [especificacao.md](especificacao.md), que prevalece em caso de conflito), em conversa de brainstorming (perguntas uma a uma, com análise crítica de alternativas).

> Legenda: **[B]** briefing · **[P]** pesquisa pública (imprensa, números declarados pelo iFood) · **[O]** observado nos prints · **[H]** hipótese nossa · **[C]** decisão do assistente de IA, corrigível.

## 1. Contexto e porquê

Etapa eliminatória do estágio iFood GenAI 2027, trilha AI Builder. Prazo de entrega: **23/11**. Tempo: **~3 dias parciais**.
Entregáveis [B]: (1) solução num link, funcionando, que qualquer pessoa usa do começo ao fim; (2) **um slide do processo** cobrindo prompts, APIs e riscos; (3) material extra opcional.
Avaliação [B]: diagnóstico do problema · solução funcionando sem depender do candidato · profundidade (interface + lógica + dados + IA juntos) · visão de negócio · domínio (explicar escolhas e **mudar na hora**).
Sessão [B]: 2 min pessoal · **8 min case + demo ao vivo** · 10 min perguntas · 25 min conversa.
Regras [B]: só dados públicos ou de exemplo; **nada de dados internos do iFood nem dados pessoais reais**; números do briefing são fictícios.
Sessão marcada [e-mail 3]: **segunda, 23/11/2026, 17:00–18:00, via Meet**, até 1 hora, com foco em profundidade técnica, trade-offs e exemplos reais de projetos com IA. É o mesmo dia do prazo → janela real de construção: 19/11 (noite) a 23/11 (manhã), com congelamento de deploy antes da sessão.
Envio: e-mail 1 diz "responder este e-mail até 23/11"; e-mail 2 manda usar o formulário Greenhouse → **enviar pelos dois**.

Objetivo do usuário: passar na etapa com tranquilidade e impressionar, com foco forte em produto e técnica, documentando todo o processo e os trade-offs.

## 2. Problema escolhido

Opção 2 do case — **"Restaurante que ganha"**: *"faça o dono do restaurante entrar, divulgar no salão e ter mais retorno com isso."*

Leitura literal (seção que guia todo o escopo):
- "entrar" = **aderir ao Comer Fora** [H, declarada como interpretação].
- "divulgar no salão" pressupõe que o restaurante **tem salão** → restaurante sem salão fica fora por definição.
- "ter mais retorno **com isso**" = o retorno precisa vir da divulgação → exige **atribuição** (qual peça trouxe qual cliente).

Diagnóstico:
- [B] Só 20% dos restaurantes ativos divulgam o Comer Fora no salão; 75% dos 400 mil operam só delivery; 50% aceitaram compartilhar telefone no totem; o Retorno já oferece CRM, marketing, avaliações e Giftback.
- [P] O Comer Fora já tem reserva, fila, check-in que libera benefício, fidelidade com cartela de selos, ofertas de 1ª visita, dados de consumo para o restaurante, Toqan para Restaurantes e iFood IA.
- [O] No app, o Comer Fora fica **a 2 toques da home** (Home → Ver mais → "Pra facilitar seu dia a dia"). O check-in é validado por GPS e o próprio app admite imprecisão ("O GPS pode não ser preciso…").
- **Tese** [H]: a ferramenta de retorno já existe; o que falta é o **início do funil no salão**. O cliente sentado à mesa é anônimo para o restaurante, e o check-in só acontece se algo no salão disser a ele que o benefício existe. O produto transforma o salão em canal de captação: cliente anônimo → identificado (check-in) → alimenta a fidelidade/CRM que já existem → volta.
- Por que os 80% não divulgam: **não sabemos** (o briefing não diz). Hipótese declarada; o produto mede.

## 3. Para quem

- **Usuário principal: dono de restaurante parceiro iFood com salão**, esteja ou não no Comer Fora (hoje só delivery no iFood, ou já no Comer Fora sem divulgar).
- **Usuário secundário: cliente sentado no salão**, que chega pelo QR no celular, sem instalar nada.
- Garçom: não tem tela; recebe roteiro impresso.

## 4. Objetivos, não-objetivos, anti-objetivos

Objetivos:
1. Fluxo integral Entrar → Divulgar → Retorno atribuído, usável por qualquer avaliador sozinho.
2. IA em 3 papéis com função clara (estruturar, gerar, recomendar), com regras de dinheiro no código.
3. Métrica explícita e visível no produto.
4. Visual e usabilidade **idênticos ao iFood** (extensão do Portal do Parceiro e da área Comer Fora do app).
5. Processo documentado (prompts, APIs, riscos, decisões).

Não-objetivos: recriar o app inteiro (delivery, busca etc.); reserva e fila (já existem); antifraude; envio real de WhatsApp/push; login real; restaurante sem salão; estimativa de potencial de vendas; convite a clientes de delivery (território da opção 1).

Anti-objetivos (falha mesmo funcionando): virar "gerador de panfleto com IA" sem retorno medido; virar "chat com IA"; números inventados pela IA; parecer o Portal do Parceiro já existente sem diferencial; página que possa ser confundida com o iFood oficial e colete dados reais.

## 5. Abordagens consideradas (escolhidas pelo usuário)

| Decisão | Consideradas | Escolhida | Por quê |
|---|---|---|---|
| Opção do case | 1 primeira experiência · 2 restaurante · 3 grupo · 4 próprio | **2** | Mais âncoras no briefing; ciclo QR→painel demonstrável ao vivo; usuário e valor de negócio claros |
| Recorte | (a) já no CF sem divulgar · (b) só delivery · (c) os dois · **(a+) dono com salão, fluxo integral** | **(a+)** | Atende os 3 verbos; tira o que é frágil de (b) (estimativa inventada, convite de delivery) |
| Demo | só vitrine · vitrine + sandbox · login real | **Vitrine + sandbox por visitante** | Painel cheio na hora + "entrar" testável do zero, sem cadastro |
| Cardápio | foto/PDF · texto colado · só exemplos | **Foto/PDF + 3 exemplos prontos** | Maior "uau"; exemplos cobrem quem não tem cardápio à mão |
| Retorno no tempo da demo | só vitrine · botão simular · os dois | **Os dois** | Avaliador fecha o ciclo no restaurante que ele criou |
| Visual | extensão fiel + aviso · clone sem aviso · marca própria | **Clone total + aviso** | Pedido do usuário; proteções obrigatórias (seção 7) |
| QR | só divulga · prova de presença | **Só divulga e atribui** | Nenhum critério premia antifraude; regras reais já limitam abuso |
| GPS | simulado · bloqueante · **real e não bloqueante** | **Real, não bloqueante (igual ao app)** | Pedido do usuário; grava só o status |
| Stack | Next.js+Supabase · Python+React · Lovable/Bolt | **Next.js (TS) + Postgres na VPS do usuário (Easypanel)** | Um repo/deploy; sempre ligado; usuário já opera a VPS |
| Build/deploy | GitHub Actions + imagem · build na VPS | **Easypanel builda a cada push na `main`** (igual aos outros serviços do usuário) | Decisão do usuário; risco mitigado (seção 7) |
| Domínio | gerado `*.lyv8st.easypanel.host` · subdomínio do domínio próprio do candidato | **Gerado** | Zero DNS; neutro; não associa a empresa do candidato a página com cara de iFood |
| Acesso a modelos | AI SDK direto · OpenRouter | **OpenRouter** | Uma chave, troca e reserva entre modelos; taxa ~5,5% aceita |
| Escolha de modelo | escolher agora · **mini-avaliação medida** | **Mini-avaliação** | Decisão por número, não por opinião (Claude é um dos candidatos) |

## 6. Decisões operacionais (após revisão do construtor, 19/11)
- Referências do Portal: existem (5 imagens públicas enviadas no chat, hoje em pasta temporária da sessão). [C] No início da implementação, copiar para `referencias/`. Atualizado por D76: versionadas só no repositório privado, excluídas da cópia pública.
- Logotipo/ícones: o usuário escolheu "clone total + aviso" (a opção incluía o logo) → usar marca do iFood e do "ifood pra comer fora", sempre com a faixa de aviso.
- **Easypanel:** autorizado criar e alterar **apenas o projeto novo** (projeto, Postgres, serviço, ligação com GitHub, variáveis). Proibido tocar nos 33 serviços existentes. **OK geral para merges na `main` até 22/11**; avisar a cada deploy; nenhum deploy perto da sessão.
- **OpenRouter:** usuário tem conta; **orçamento total de US$ 10** (mini-avaliação + demo). Consequências: mini-avaliação enxuta (1 rodada por cardápio, prioridade à tarefa 1; modelos caros como Sonnet 5.5/DeepSeek V4 Pro só se o custo medido couber); limite de crédito da chave definido abaixo do orçamento, com reserva para a demo; vitrine com respostas prontas para não gastar a cada visita. A chave nunca é colada no chat: vai por formulário seguro de credencial nesta sessão (avaliação) e por variável de ambiente no Easypanel (app).

## 7. Riscos e tratamento (visão macro)
| Risco | Tratamento |
|---|---|
| Página confundida com o iFood oficial (marca/página falsa) | Faixa fixa "Protótipo de case · não é produto oficial do iFood · use só dados fictícios"; `noindex`; domínio neutro; sem login real nem pagamento |
| Dados pessoais | Só dados fictícios (avisos nos campos); consentimento e opt-in por canal; GPS guarda só o status; fotos de cardápio não armazenadas |
| IA inventa número/promessa | Schema validado; texto do benefício vem das regras; checagem de números citados; dono aprova tudo |
| Prompt injection via texto do cardápio | Imagem tratada como dado; saída só por schema; IA sem ferramentas |
| Custo/abuso da IA | Limite por visitante/dia; limite de crédito na OpenRouter; vitrine com respostas prontas |
| Provedores com dados fora do Brasil (LGPD) | No case só dados de exemplo; em produção exigiria provedor adequado — código desacoplado permite trocar |
| Falha de provedor | Modelo reserva por tarefa via OpenRouter |
| VPS compartilhada / build na VPS | Limites de memória, health check, monitor, backup, sem deploy perto da sessão |
| Fraude de check-in | Regras reais (1 por dia, consumo mínimo); QR-prova-de-presença no roadmap |
| GPS impreciso | Validação não bloqueante, igual ao app |
| Rastros de IA no Langfuse Cloud (fora do Brasil) | Só dados fictícios e sem PII |
| Opt-in de comunicação ligado por padrão (fidelidade ao app) | Em produção, consentimento ativo (LGPD) |
| Build na VPS compartilhada | Deploy só com CI verde, mitigações de memória, congelamento às 15h de 23/11 |
| Demo ao vivo falhar | Vídeo gravado + vitrine sem dependência de IA ao vivo |

## Apêndice A — Pesquisa pública do Comer Fora (19/11)
Lançado em 29/04/2026 (Move+) com compra da Get In; piloto Campinas e Curitiba; objetivo declarado de reduzir ociosidade. iFood Move (16–17/09): 50+ cidades, investimento na Tagme (~3 mil restaurantes), Toqan para Restaurantes, iFood IA. Números declarados: "63% voltaram em menos de 1 mês"; "menos de 45% dos restaurantes oferecem reserva". Fontes: Mobile Time, InfoMoney, Exame, Bom Gourmet, Central do Varejo, Diário Induscom, 55content, StartSe (resumos via busca; páginas completas bloqueadas pela rede da sessão). Lacunas: por que não divulgam; quem paga o benefício; material oficial de salão.

## Apêndice B — Fatos dos prints
App (16 prints tirados pelo candidato): entrada do CF em "Ver mais"; home do CF (banner gradiente, cards por tipo de benefício, "Perto de você", "Acompanhe sua jornada"); mapa com chips; página do restaurante (abas Benefícios|Sobre, rodapé Avaliar/Check-in); detalhe do benefício em card ticket com "Recado do restaurante"; check-in com cartela 6 selos e regras (consumo mínimo, 1/dia, 90 dias, 1 recompensa, só no local); sheet de GPS; Jornada (Visitas/Reservas/Avaliações); notificações (WhatsApp, app, push); Avaliar (Comida/Serviço/Ambiente). Portal (imagens públicas 2021/2023): login, sidebar (Promoções, Desempenho…), funil "Conversão do cardápio", seletor D S T Q Q S S, painel lateral de edição. Prints contêm dados reais → só referência de layout.

## Apêndice C — Infraestrutura (consulta de leitura via conector Easypanel, 19/11)
VPS do candidato, compartilhada com serviços de produção dele: 2 núcleos, ~7,9 GB de RAM (~2,2 GB livres no momento), ~62 GB de disco livres. O app ficará num projeto novo e isolado; os serviços existentes não são tocados. Domínio público: subdomínio gerado pelo Easypanel.

## Apêndice D — Levantamento de modelos (agregadores, a confirmar)
Gemini 3.1 Flash-Lite ~0,25/1,50; Gemini 3.8 Flash ~0,75/3,75 (sobe dez/jan); DeepSeek flash ~0,30/1,20 pico; DeepSeek V4 Pro ~1,32/3,96; Kimi K3.1 Pro ~2/10; Kimi K2.6 ~0,95/4; Qwen3-VL-Plus ~0,20/1,60; Claude (oficial, cache 03/11) Haiku 5.5 0,10/0,50, Sonnet 5.5 2/10, Opus 5.5 4/20. DeepSeek/Qwen: "modo JSON" sem garantia de schema (fonte de terceiros). Dados de DeepSeek possivelmente na China (política antiga). OpenRouter: taxa ~5,5% em créditos, reserva entre modelos.
