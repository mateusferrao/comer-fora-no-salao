# Auditoria de copy — copy-portal (S9, 22/11, skill copywriting; só leitura)

Base para a Parte B do planejamento. Decisões do candidato que prevalecem: D278–D281.

# Auditoria de copy do Portal "Comer Fora no Salão" (público: dono do restaurante)

Só leitura, nada foi alterado. Em cada tela, os caminhos absolutos estão no cabeçalho e as citações usam `Arquivo:linha`. As regras aplicadas vêm de `/tmp/skills-use-zUDuas/copywriting/SKILL.md` e `references/ai-tells.md`. Nenhum número foi inventado: onde falta um dado, aparece `[FALTA: ...]`.

## 0. Os 12 problemas mais graves

1. **O topo da Visão geral pode dizer "-R$ 50 a mais em margem".** O tipo do estado sai do resultado em visitas e o valor em reais tem o custo dos convites descontado. Os dois podem ter sinais diferentes (`analytics/domain/value.ts:23-24`, `incremental.ts:51`, `ValueHero.tsx:18,20`, `Dashboard.tsx:194`). É uma afirmação contraditória.
2. **O valor principal não aparece.** A margem causal já desconta o custo dos convites (`incremental.ts:39-51`), mas a tela não diz isso. O dono não sabe que o número é líquido.
3. **"convites com 1 semana completa" pode ser maior que "convites emitidos (30 dias)".** As janelas são diferentes: de 37 a 7 dias atrás contra de 29 dias atrás até hoje (`verdict.ts:19-23`, `insights.ts:97-101`). O mesmo par aparece na tabela do Plano (`PlanManager.tsx:478-479,488-489`).
4. **"o código" quer dizer duas coisas.** Pode ser o sistema ("O código calcula os números", `plano/page.tsx:32`; "O código separou N opções", `ExplainOffer.tsx:52`) ou o código de 6 letras que o garçom valida. Para o dono, isso confunde.
5. **"margem" no mesmo card quer dizer lucro e erro estatístico.** "o resultado está dentro da margem de erro" (`ValueHero.tsx:62`) aparece no card "Retorno em reais".
6. **"turno" tem dois sentidos.** É o bloco de funcionamento ("Dias do turno 1 de funcionamento", `Step2Salao.tsx:159`) e também almoço, tarde ou noite (`PlanManager.tsx:425`, `fact-labels.ts:10`).
7. **"Convite de volta" tem dois sentidos.** É o convite da mesa (`Step4Pacote.tsx:262`, `PlanManager.tsx:254`) e também a reativação ("Convite de volta (reativação) por e-mail", `NotifySettingsTab.tsx:123`).
8. **"assistente" tem três sentidos.** É o chat do Portal, a ativação em 5 passos ("Abandono por passo do assistente", `plataforma/page.tsx:61`) e o app de IA externo via MCP (`AgentSection.tsx:61`).
9. **Afirmação falsa no login e em Como funciona.** O texto diz "Guardamos apenas um código irreversível dele (HMAC)" (`LoginForm.tsx:163`) e "O e-mail do dono é guardado só como código (HMAC)" (`como-funciona/page.tsx:132`). Mas o e-mail do dono fica criptografado e é lido de novo (`verify-code.ts:28,50`; `layout.tsx:57` chama `decryptEmail`). "Usamos seu e-mail só para enviar o código" também contradiz o resumo semanal enviado por e-mail.
10. **A página de aprovar diz "clientes que sumiram".** Mas o público da reativação inclui "perto da recompensa" (`aprovar/[token]/page.tsx:56`, `plan-view.ts:136`).
11. **O e-mail mistura períodos.** Abre com "Resultado da semana passada (dd/mm a dd/mm)" e logo depois mostra o valor acumulado "até agora" (`digest-email.ts:31,51`).
12. **"Aprovar plano" esconde o que acontece depois.** Aprovar entrega convites a clientes (`PlanManager.tsx:143,373`), mas o botão não avisa.

---

## 1. Por tela

### 1.1 Login e e-mail do código
`/home/user/ifood-genai-2027/app/parceiro/entrar/LoginForm.tsx`, `/home/user/ifood-genai-2027/src/modules/contas/application/request-code.ts`

**Inventário:** "Portal do Parceiro" (94); "Gerencie sua loja de forma fácil e rápida" (95); "Avançar" (112); "Digite o código de 6 dígitos que enviamos para…" (118); dica "O código vale por 10 minutos. Confira também a caixa de spam." (130); "Entrar" (133); "Reenviar código" (142); "Usar outro e-mail" (153); rodapé (163). Assunto do e-mail: "Seu código de acesso: {code} · Comer Fora no Salão (protótipo de case)" (request-code:36).

**Problemas:**
- `:95` "Gerencie sua loja de forma fácil e rápida". Frase pronta, não passa no teste de troca (qualquer portal poderia usar). Proposta: "Veja quantos clientes voltaram no seu horário vazio e quanto isso rendeu."
- `:163` "Usamos seu e-mail só para enviar o código de acesso. Guardamos apenas um código irreversível dele (HMAC)." É afirmação falsa e tem jargão (HMAC). Proposta: "Usamos seu e-mail para o código de acesso e para o resumo semanal, se você ligar. Ele fica guardado criptografado. Contas sem acesso por 7 dias são apagadas."
- `:34` "Preencha os campos destacados para prosseguir." É genérico e a tela tem um campo só. Proposta: "Digite seu e-mail."
- `:112` "Avançar". CTA fraco. Proposta: "Receber código por e-mail".
- `:51/:53` "Se você recebeu um link de acesso junto com o case, pode usá-lo." É texto para o avaliador dentro do produto. Pode ficar, mas pede um link direto: "Usar o link de acesso".

### 1.2 Visão geral: cabeçalho e cartões laterais
`/home/user/ifood-genai-2027/app/parceiro/salao/page.tsx`, `/home/user/ifood-genai-2027/src/ui/painel/Dashboard.tsx`, `/home/user/ifood-genai-2027/src/ui/portal/FirstSteps.tsx`

**Inventário:** "Visão geral" (page:40); "{nome} · Seu salão cheio divulga seu horário vazio." (42); selo "Restaurante de exemplo · histórico gerado" + "Tudo aqui é editável e só você vê." (46-47); "Ver minha página (como o cliente vê; abre em nova aba)" (56-58); "Convites só no app desde dd/mm (e-mails aos clientes desligados…)" (63-65); "Continue a ativação" (75-78); "Cadastre o seu restaurante" (91-97). Dashboard: "Novos usuários do Comer Fora · últ. 30 dias" (72); "1º check-in da vida aqui, vindo de uma peça do kit." (74); "Validar código" (77); cartão do plano (212-221).

**Problemas:**
- `page:42` repete o slogan da landing. Não diz o que a tela mostra. Proposta: "{nome} · Quem voltou com convite e quanto isso rendeu."
- `Dashboard:72-74` "Novos usuários do Comer Fora" e "1º check-in da vida aqui". É métrica do iFood e o benefício para o dono não aparece; "da vida" soa estranho. Proposta: rótulo "Clientes que conheceram o Comer Fora no seu salão (30 dias)", nota "Primeiro check-in no app, feito pelo QR de uma peça do kit."
- `Dashboard:212,220` o botão "Revisar plano" é o mesmo em todos os estados. É CTA fraco. Proposta por estado: proposto → "Revisar e aprovar"; nenhum ou vencido → "Gerar o plano da semana"; aprovado → "Ver o plano".
- `Dashboard:212` "Vencido · gere o desta semana". Proposta: "O plano da semana passada venceu".
- `FirstSteps:7` "(não precisa imprimir para testar)" e `:10` CTA "Como ver a volta hoje", que leva a /bastidores/avaliador. São textos de avaliador dentro do produto. Proposta: tirar do Portal ou mostrar só com o selo de exemplo. Para o dono real: "1º cliente voltou com convite" sem CTA, ou "Ver quem tem convite ativo" → Clientes.
- `Dashboard:145` "Os números aparecem conforme os clientes fazem check-in." Funciona.

### 1.3 Visão geral: topo em R$ (ValueHero). A avaliação completa está na seção 4.
`/home/user/ifood-genai-2027/src/ui/painel/ValueHero.tsx`

**Inventário:** título "Retorno em reais" (13).
- Positivo: "{R$} a mais em margem entre {n} convidados até agora" (18) + "Provavelmente entre … · estimativa com os valores que você declarou, comparada ao grupo de controle." (20).
- Negativo: "{R$} a menos em margem entre {n} convidados" (26) + "Reveja a oferta no plano da semana. …" (28).
- Antecipado e sem valores: "Nenhum convite usado ainda" ou "{n} convites usados (código validado pelo garçom)" (34), "≈ {R$} em consumo ({R$} de margem) · custo dos convites {R$}" (37), "Custo dos convites {R$}" (40), "Estimativa, não causal: parte dessas pessoas voltaria sem convite." (42), "Declare ticket médio e margem em Configurações para ver em reais." (45-49).
- O que falta: "Ainda não dá para afirmar o efeito: o resultado está dentro da margem de erro." (62); "Já há resultado contra o grupo de controle: declare os valores para vê-lo em reais." (63); "Para medir o efeito faltam {x} clientes do grupo de controle e {y} convidados com 14 dias completos." (68); "O efeito aparece quando as janelas de 14 dias fecharem." (68).

**Problemas:**
- `:18` "a mais em margem **entre** {n} convidados". "entre" colide com o "entre R$ X e R$ Y" da linha de baixo. O fato de já descontar o custo não aparece. "até agora" não tem data. Proposta: "R$ {cents} de margem a mais, já descontado o custo dos convites", com a linha "Somando os {nT} clientes que receberam convite desde [FALTA: data do 1º convite]".
- `:20` "Provavelmente entre {lo} e {hi}" sai como "entre -R$ 50 e R$ 650" quando lo < 0, embaixo de "a mais". É afirmação contraditória. Proposta de regra no código: só usar "a mais" quando `margin.lo > 0`. Senão, mostrar "Os convites trouxeram visitas a mais, mas em reais ainda pode dar de -R$ {|lo|} a +R$ {hi}." Texto do intervalo: "Pode ficar entre R$ {lo} e R$ {hi}. Conta feita com o ticket e a margem que você informou."
- `:26-28` "Reveja a oferta no plano da semana." é instrução sem link e o fato fica enterrado. Proposta: "Os convites custaram R$ {abs} a mais do que trouxeram de margem", com o link "Trocar a oferta no plano da semana".
- `:34` "(código validado pelo garçom)" é detalhe de mecanismo no título. Proposta: "{n} clientes voltaram com convite". A nota menor explica: "Conta só código validado pelo garçom."
- `:37` "≈ R$ X em consumo (R$ Y de margem) · custo dos convites R$ Z" põe três números e deixa a conta para o dono. Proposta: "≈ R$ {margem−custo} de margem depois de pagar os convites" e, embaixo, "Consumo estimado R$ X · margem R$ Y · custo dos convites R$ Z".
- `:42` "Estimativa, não causal" é jargão estatístico. Proposta: "Parte desses clientes voltaria mesmo sem convite. O valor confirmado aparece quando o grupo sem convite completar 14 dias."
- `:13` vs `:40` o título "Retorno em reais" mostra só custo no estado sem valores. O valor não chega ao dono. Proposta de título fixo: "Quanto os convites renderam".
- `:45` "Declare ticket médio e margem" usa o verbo "declarar", que soa burocrático, e é CTA fraco. Proposta: botão "Informar ticket e margem" e texto "Com esses dois valores, mostramos o resultado em reais."
- `:62` "dentro da margem de erro" colide com "margem" de lucro (termo inconsistente). Proposta: "Ainda não dá para dizer se os convites trouxeram gente a mais. A diferença para quem ficou sem convite ainda pode ser acaso."
- `:63` "Já há resultado…: declare os valores para vê-lo em reais" enterra o melhor estado em uma linha cinza. Proposta: passar para o título: "Já dá para medir o resultado. Informe ticket e margem para ver em reais."
- `:68` "faltam X clientes do grupo de controle e Y convidados com 14 dias completos" é jargão e o dono não tem o que fazer. Proposta: "Para medir, faltam {X} clientes sem convite e {Y} com convite acompanhados por 14 dias." Se quiser dar prazo: [FALTA: ritmo semanal de novos clientes para estimar a data].
- `:68` "quando as janelas de 14 dias fecharem" é jargão. Proposta: "quando os primeiros clientes completarem 14 dias desde o check-in".

### 1.4 Visão geral: metas, métrica de visitas, funil, "Hoje no salão", indicadores
`/home/user/ifood-genai-2027/src/ui/painel/SlotGoals.tsx`, `Dashboard.tsx`, `TodayFeed.tsx`, `/home/user/ifood-genai-2027/src/modules/analytics/domain/funnel.ts`, `/home/user/ifood-genai-2027/src/modules/analytics/application/today-feed.ts`, `/home/user/ifood-genai-2027/src/ui/painel/Operations.tsx`

**Inventário:**
- SlotGoals: "Metas desta semana" (12), "não causal" (14), "{n} convites usados · meta: {m} mesas a mais por semana" (20), "{e} de {t} convites emitidos nesta semana (teto)" (30).
- MetricHero: "Visitas registradas a mais por cliente convidado (14 dias)" (165), "{+0,12} visita por cliente" (172), "provavelmente entre … (cada cliente acompanhado por 14 dias depois do sorteio)" (174-176), STATE_TEXT (152-155), amostra (185), margem (190-195), "Visitas registradas = check-ins. Comparamos por sorteio com um grupo de controle (1 em 10)…" (197), "Como medimos" (199-205).
- Funil: "Funil do salão" (93), "Atualizado há N s" (96), períodos (106-108), "Peça/Todas" (125,130), "Do QR ao contato" / "Convite de volta (escala própria)" (236-237), linha extra (137). funnel.ts:38-43: "Leituras do QR", "Check-ins", "Deixaram contato", "Convites emitidos na mesa", "Voltaram com convite", "Códigos de convite validados".
- Cards: "Comparado ao grupo de controle" (299), "Visitas no horário vazio" (302), "Proteção contra migração (fora do horário vazio)" (307), controlText (283-289), "Indicadores antecipados · não causal" (314), "Convites usados por semana de emissão" (317), colunas "Semana/Emitidos/Usados" (325-331), "(em aberto)" (342), "Custo por convite emitido" (352), "Custo por cliente identificado" (356), "Custo × margem das visitas" (360), "Estimativa, … Últimos 30 dias." (364).
- TodayFeed: "Hoje no salão" (53), "Hoje: N leituras · N check-ins · N códigos validados" (56-57), vazio (64), selo (71), feedText (16-22), PIECE "Display mesa" (today-feed:27).
- Operations: "Alertas de operação" (29), "Versões das peças (A/B)" (40-41), statusText (13-16), "Promover vencedora" (89).

**Problemas:**
- `SlotGoals:20` "N convites usados · meta: M mesas a mais" compara convites com mesas na mesma barra de progresso (rótulo ambíguo). Proposta: "{n} de {m} mesas a mais nesta semana", com a nota "(cada convite usado conta como uma mesa)".
- `SlotGoals:14` "não causal" é jargão. Proposta: tirar, ou trocar por "conta convites usados, não prova efeito".
- `SlotGoals:30` "(teto)". Proposta: "{e} de {t} convites já entregues nesta semana (limite semanal)".
- `Dashboard:172` "+0,12 visita por cliente": ninguém visualiza 0,12 visita. Proposta, com conta direta diff×100: "+{12} visitas a cada 100 clientes convidados, em 14 dias".
- `Dashboard:165` "Visitas registradas a mais por cliente convidado (14 dias)". Proposta: "Visitas a mais de quem recebeu convite".
- `Dashboard:176,197` "sorteio", "grupo de controle" e "visitas registradas = check-ins" são jargão estatístico. Proposta: "1 em cada 10 clientes fica sem convite, por sorteio, para comparar. Contamos as visitas com check-in."
- `Dashboard:185` "Ainda não dá para afirmar: faltam N clientes do grupo de controle… acompanhe os indicadores antecipados." Repete o topo com números diferentes (só controle, sem convidados) e usa colon reveal. Proposta: mesmo texto da seção 1.3 (`:68`) e "Enquanto isso, veja os sinais iniciais abaixo."
- `Dashboard:193-194` "≈ entre R$ lo e R$ hi de margem a mais" pode mostrar lo negativo (mesmo bug do topo) e repete o topo. Proposta: remover a duplicata e deixar o R$ só no topo.
- `Dashboard:204` "Amostra insuficiente: menos de 30 clientes…". Proposta: "Poucos dados: menos de 30 clientes em um dos grupos".
- `funnel:40` "Deixaram contato" mede clientes cuja 1ª visita caiu no período (`funnel.ts:18`), não aceite de contato. É rótulo ambíguo. Proposta: "Clientes novos (1ª visita)".
- `funnel:42` "Voltaram com convite" conta códigos de convite gerados (`funnel.ts:23`). Fica ao lado de "Códigos de convite validados" e de "convites usados" do topo. Proposta: "Voltaram no horário do convite" e "Usaram o convite (garçom validou)".
- `Dashboard:237` "(escala própria)" é jargão. Proposta: "Convite de volta (barras em outra escala)", ou tirar.
- `Dashboard:106-108` a ordem "7 dias, 30 dias, Hoje" quebra a lógica. Proposta: "Hoje · 7 dias · 30 dias".
- `Dashboard:285` "Convidados vieram −0,03 visita fora do horário vazio" fala em visita negativa. Proposta: "Quem recebeu convite veio menos fora do horário vazio: parte do efeito é cliente que trocou de horário."
- `Dashboard:287` "Sem sinal de migração: … convidados e grupo de controle vieram igual" afirma igualdade quando o resultado é inconclusivo (afirmação sem prova). Proposta: "Não deu para ver diferença fora do horário vazio."
- `Dashboard:307` "Proteção contra migração" é jargão. Proposta: "O convite tirou cliente de outro horário?"
- `Dashboard:314` "Indicadores antecipados · não causal". Proposta: "Sinais iniciais (ainda não provam efeito)".
- `Dashboard:331,341` a coluna "Usados" mostra % enquanto "Emitidos" mostra contagem, e "(em aberto)" é jargão. Proposta: coluna "Usados em 7 dias" com "{used} ({pct})" e "(ainda contando)".
- `Dashboard:356` "Custo por cliente identificado" usa "identificado", que é jargão. Proposta: "Custo do benefício por cliente novo".
- `Dashboard:360` "Custo × margem das visitas": o "×" lê como multiplicação, mas é custo ÷ margem em %. Proposta: "Quanto da margem vai para benefícios".
- `Dashboard:352` "Custo por convite emitido" (custo dos usados ÷ emitidos). Proposta: "Custo médio por convite entregue".
- `TodayFeed:56` "{n} check-ins" não trata o singular e mostra "1 check-ins". Proposta: plural condicional.
- `today-feed:27` "Display mesa" contra "Display de mesa" no resto do Portal (termo inconsistente). Proposta: "Display de mesa".
- `TodayFeed:71` "grupo de controle · sem convite (mede o efeito)". Proposta: "sorteado sem convite (para comparar)".
- `Operations:15-16` "converte mais leituras em check-in" é jargão. Proposta: "A versão {X} leva mais gente do QR ao check-in".
- `Operations:41` "Decide só pela conversão… Amostra mínima: ~356 leituras por versão." Proposta: "Comparamos quantas leituras do QR viram check-in em cada versão. Precisamos de cerca de 356 leituras em cada uma."
- `Operations:89` "Promover vencedora" é CTA vago. Proposta: "Usar o texto da versão {X} nas duas".

### 1.5 Plano da semana
`/home/user/ifood-genai-2027/app/parceiro/salao/plano/page.tsx`, `/home/user/ifood-genai-2027/src/ui/painel/PlanManager.tsx`, `/home/user/ifood-genai-2027/src/ui/painel/DigestCard.tsx`, `/home/user/ifood-genai-2027/app/parceiro/salao/plano/historico/page.tsx`

**Inventário:** subtítulo "O código calcula os números e decide o que é válido; a IA escolhe … Você aprova." (page:32). Estado (PM:165). Selos ORIGIN (24). "Montado por agente de IA · N consultas · ver passos" (181). "Gerar plano da semana" (194). "O que aprendemos" (208), "Primeira semana: ainda não há o que comparar." (211), VERDICT "Manter/Trocar/Cedo demais" (20-22), "O veredito é do código, por indicadores antecipados; não é causal." (225). "Proposta para esta semana"/"Regra desta semana" (231). "Convite de volta · {slot}" (254). "Oferta" com dica "· melhor nota" (256-260). "Teto semanal de convites" (265). Linha de custo (269). "Teto sugerido pelo uso real" (271). "Texto do convite (aparece no 2º card do cliente)" (274). "Use {horario} e {oferta}…" (308-309). "Como o cliente lê" (314). "Por quê (da opção sugerida, não da que você escolheu): " (324). "Reativação" (339) e texto (343-344). "Oi, Ana! …" (349). Revisor (358). "Aprovar plano" (373). "Descartar" (381), "Por que descartar?" (387). "O que os seus dados dizem" (416). Legenda do mapa (425). Alerta (462). Tabela (473-480, 489). "Clientes acionáveis" (498). Mensagens (107, 134, 138, 143, 153).

**Problemas:**
- `page:32` "O código calcula…; a IA escolhe…" usa "o código" no sentido de sistema e colide com o código de validação. Proposta: "O sistema calcula custos e limites, a IA sugere a oferta de cada horário vazio e explica por quê. Nada vale sem a sua aprovação."
- `PM:24` "Plano pronto do restaurante de exemplo (escrito antes, sem IA ao vivo)" é longo e de avaliador. Proposta: "Plano de exemplo (sem IA)".
- `PM:181` "Montado por agente de IA · N consultas · ver passos". "agente" é jargão. Proposta: "A IA consultou seus números {N} vezes antes de sugerir · ver passos".
- `PM:165` "Aprovado via agente" contra "pelo assistente" e "pelo e-mail" (termo inconsistente). Proposta: "Aprovado por app de IA conectado".
- `PM:225` "O veredito é do código, por indicadores antecipados; não é causal." é jargão triplo. Proposta: "Manter ou trocar sai do uso dos convites na 1ª semana. Isso não prova que trouxeram clientes a mais."
- `PM:231` "Regra desta semana": "regra" é termo inconsistente com "plano". Proposta: "Plano em vigor nesta semana".
- `PM:260` "melhor nota" é jargão. Proposta: "· melhor custo-benefício".
- `PM:269` a linha "até 20 convites/semana ≈ 5 mesas (com o uso de 25% dos convites) · custo máximo R$ · esperado ≈ R$" junta 5 dados em uma linha. Proposta: duas linhas. "Até {cap} convites por semana ≈ {mesas} mesas a mais" e "Custo máximo R$ {max} · provável R$ {esp} (se {uso}% usarem)".
- `PM:274` "2º card do cliente" e `Step4:286` "(o cliente vê no 2º card)" são jargão de tela. Proposta: "Texto do convite (o cliente vê no app, logo depois do check-in)".
- `PM:308` "o sistema escreve o dia, o horário e a oferta" funciona. Pode ficar.
- `PM:343-344` "Vai para N clientes com opt-in (1 visita e sumiu: X; perto da recompensa: Y). Usa até N dos N convites livres desta semana em …; sobram N…" usa "opt-in", é denso e não diz por que vale a pena. Proposta: "Ao aprovar, {N} clientes que aceitaram receber avisos ganham o convite: {X} vieram uma vez e não voltaram, {Y} estão perto da recompensa." Depois, uma linha por horário: "{slot}: usa {use} dos {free} convites da semana, sobram {left} para a mesa."
- `PM:349` "Oi, Ana!": exclamação e nome fictício sem aviso. Proposta: "Prévia: Oi, {nome}. …".
- `PM:358` "Revisor (outro provedor de IA): conferindo os textos…" é jargão técnico. Proposta: "Uma segunda IA está conferindo os textos dos convites…"; "Revisor: atenção" → "Conferência: vale revisar".
- `PM:373` "Aprovar plano" é CTA que esconde a consequência. Proposta: "Aprovar e enviar convites", ou "Aprovar plano · envia {N} convites" quando houver reativação.
- `PM:143` "Plano aprovado · convite entregue a N clientes em Sua jornada · … · textos com link ou contato não vão por e-mail". "Sua jornada" é o nome da tela do cliente e a frase empilha três dados. Proposta: "Plano aprovado. {N} clientes receberam o convite no app ({M} também por e-mail)."
- `PM:134` "O revisor ainda está conferindo ou pediu ajustes nos convites. … se reescrever o convite, você assume o texto." Proposta: "A conferência dos textos ainda não terminou ou pediu ajuste. Veja os motivos acima ou escreva seu próprio texto."
- `PM:425` "Check-ins por dia e turno… (mede quem leu o QR, não a lotação)" é afirmação imprecisa: check-in não é leitura do QR. Proposta: "Check-ins por dia e turno nos últimos 30 dias. Mostra quem fez check-in, não o movimento total. Contorno: horários vazios que você marcou."
- `PM:473` "Resposta aos convites (convites reais; o efeito causal só no total do restaurante, na Visão geral)" é jargão. Proposta: "Uso dos convites por horário. O resultado em clientes a mais está na Visão geral."
- `PM:478-479,489` "Emitidos (30 dias)" e "Usados em 1 semana" com "25% de 12": o "12" usa outra janela e pode passar dos emitidos. Ver seção 4.
- `PM:498` "Clientes acionáveis" é jargão. Proposta: "Clientes para chamar de volta: {N} vieram uma vez e não voltaram · {M} perto da recompensa · Ver clientes".
- `PM:83-95` "Gerar o plano de novo? A proposta atual é substituída…" usa "proposta" no sentido de plano, o que conflita com as propostas do assistente. Proposta: "O plano sugerido atual é substituído por um novo."
- `PM:107` "Já estamos gerando um plano. Aguarde." Proposta: "O plano está sendo gerado. Leva alguns segundos."
- `DigestCard:37` e `NotifySettingsTab:58` "veja abaixo o e-mail que o dono recebe" falam do dono na terceira pessoa dentro da tela do dono. Proposta: "veja abaixo o e-mail do resumo".
- `DigestCard:48` "Enviar agora". Proposta: "Enviar para meu e-mail agora".
- `historico:47` "agente (MCP)". Proposta: "app de IA conectado".

### 1.6 "Por que esta oferta?" e rótulos de fatos
`/home/user/ifood-genai-2027/src/ui/ia/ExplainOffer.tsx`, `/home/user/ifood-genai-2027/src/modules/textos/domain/fact-labels.ts`, `/home/user/ifood-genai-2027/src/modules/planos/domain/plan-facts.ts`

**Inventário:** "Por que esta oferta?" (34,36); "O código separou N opções para esta faixa" (52); colunas "Oferta / Custo por convite / Nota" (63-65); selos "maior nota · escolha da IA · sua escolha" (74); "Nota do código: quanto menor o custo perto do ticket médio, maior a nota." (84); "A IA escolheu …" / "Plano escrito antes" / "Escolhida pela maior nota do código" (89); (91-93); "Fatos usados" (100); "Regras" + "Passou nas regras: …" (118); "Revisor (outro modelo)" (123); "Como a IA decidiu" (129-160). Rótulos: "Faixa A: quanto fica vazia" / "…: mesas a mais…" / "…: turno" (10); "Faixa A: convites usados em até 1 semana" (12); "Faixa A: convites com 1 semana completa" (14); "Faixa A: convites emitidos (30 dias)" (16). Modelos de texto: plan-facts:12-14, 19-22.

**Problemas:**
- `ExplainOffer:52` "O código separou … para esta faixa" junta "código" e "faixa". Proposta: "O sistema achou {N} ofertas possíveis para {slotLabel}".
- `:65,84` "Nota" e "Nota do código: quanto menor o custo perto do ticket médio, maior a nota." O dono não sabe se nota alta é boa. Proposta: coluna "Custo-benefício" e nota "Quanto menor o custo comparado ao ticket médio, melhor."
- `:93` "A IA não escolheu a maior nota: ela casa o item com o horário (por exemplo, sobremesa à tarde)." Generaliza o motivo como se valesse para esta escolha (afirmação sem prova). Proposta: "A IA não escolheu a opção mais barata. O motivo está na justificativa acima."
- `:118` "Passou nas regras: sem números inventados, item e horário certos, convite com dia e horário." Funciona. Pode ficar.
- `:123` "Revisor (outro modelo)". Proposta: "Conferência por uma segunda IA".
- `fact-labels:10-16` "Faixa A" é um apelido que o dono nunca vê. Em todo o resto o horário aparece como "ter a qui · 15h–18h" (termo inconsistente). Proposta: trocar o apelido pelo `slotLabel` no rótulo, por exemplo "ter a qui · 15h–18h: convites usados na 1ª semana".
- `fact-labels:12` "convites usados em até 1 semana" mostra um percentual ("23%") mas parece contagem (rótulo ambíguo). Proposta: "% dos convites usados na 1ª semana".
- `fact-labels:14` "convites com 1 semana completa". Proposta: "convites entregues entre 37 e 7 dias atrás (base do %)".
- `fact-labels:29` chaves sem rótulo caem no nome cru: `segmento_sumiu` vira "segmento sumiu", `turno_pouco_1` vira "turno pouco 1", `desconto_maximo_pct`, `convites_teto_A`. Elas aparecem em "Fatos usados" se a justificativa citar, e no MCP. Proposta: "Clientes que vieram 1 vez e sumiram", "Perto da recompensa", "Frequentes", "Horário com poucos check-ins (não marcado como vazio)", "Desconto máximo permitido", "{slot}: teto semanal".
- `plan-facts:14` "Ainda há poucos convites com uma semana em {horario} para julgar esta oferta." Proposta: "Ainda é cedo para julgar a oferta de {horario}: poucos convites completaram uma semana."
- `plan-facts:22` "Esta é a oferta válida com a melhor relação entre o que o cliente ganha e o custo para você." Funciona e é verificável pela nota. Pode ficar.

### 1.7 E-mail do resumo semanal, "Revisar e aprovar" e "Parar"
`/home/user/ifood-genai-2027/src/modules/planos/domain/digest-email.ts`, `/home/user/ifood-genai-2027/app/parceiro/aprovar/[token]/page.tsx`, `ApproveDigest.tsx`, `/home/user/ifood-genai-2027/app/parceiro/resumo/parar/page.tsx`, `StopDigest.tsx`

**Inventário:** assunto "{r}: seu plano da semana está pronto para aprovar" / "{r}: sua semana em números" (43); "Resultado da semana passada (dd/mm a dd/mm)" (51); stats (44); linhas do topo (31-38); "Plano proposto para esta semana:" (47); "Revisar e aprovar: url" / "Abrir no Portal" (49); "Não quero mais receber este resumo" (58). Página: "Plano da semana · {r}" (40), "Gerado em … · Estado: …" (42), "{gain} · teto N convites · custo máximo R$" (50), "Convite: “…”" (52), "Ao aprovar, N clientes que sumiram recebem um convite para voltar." (56), "Aprovar plano" (ApproveDigest:42), "Ajustar no Portal"/"Ver no Portal" (67).

**Problemas:**
- `digest:51` + `31` "Resultado da semana passada" seguido de "R$ … até agora" mistura semana e acumulado (afirmação ambígua). Proposta: separar os blocos. "Semana passada (dd/mm a dd/mm): …" e "Desde [FALTA: data do 1º convite]: R$ … de margem a mais, já descontado o custo dos convites."
- `digest:43` o assunto não traz o valor (benefício enterrado). Proposta, quando o estado for positivo e lo > 0: "{r}: R$ {X} de margem a mais com os convites · plano para aprovar". Nos outros casos, manter.
- `digest:37` "Estimativa, não causal" é jargão no e-mail. Proposta: "Parte desses clientes voltaria mesmo sem convite."
- `digest:36` "(código validado pelo garçom)" repetido. Proposta: "{n} clientes voltaram com convite".
- `aprovar:56` "N clientes que sumiram" é afirmação incorreta, porque o público inclui "perto da recompensa". Proposta: "Ao aprovar, {N} clientes recebem um convite para voltar: quem veio uma vez e sumiu e quem está perto da recompensa."
- `aprovar:42` "Estado: Esperando aprovação". Proposta: "Situação: esperando sua aprovação".
- `ApproveDigest:42` "Aprovar plano". Proposta: "Aprovar e enviar convites".
- `ApproveDigest:35` "Convite entregue a N clientes em Sua jornada" usa nome de tela do cliente. Proposta: "{N} clientes receberam o convite no app."
- `aprovar:18-19` "O revisor automático …". Proposta: "A conferência automática dos textos …".
- `StopDigest:30` e `parar:18` repetem "Este link não vale" e não dizem o que fazer. Proposta: "Este link venceu. Desligue o resumo no Portal, em Configurações › Avisos e automação", com link.

### 1.8 Ativação (5 passos e "Seu salão" por frase)
`/home/user/ifood-genai-2027/app/parceiro/salao/ativar/[passo]/page.tsx`, `/home/user/ifood-genai-2027/src/ui/portal/wizard/*.tsx`

**Inventário:** passos "Cardápio · Seu salão · Revisão do cardápio · Pacote proposto · Resumo e ativar" (passo:26). Título "Ativar Comer Fora no salão" (101). Passo 1: 65-66, 71, 73, 86, 101, 112, 121-124. Passo 2: 135-136, frase (SalonSentence 47-49, 60, 64, 73, 79-80, 83), campos 142-149, "Horário de funcionamento" (156), "Dias do turno N de funcionamento" (159), "+ Adicionar turno" (172), "Horários vazios" + "Faixas em que sobra mesa. O convite de volta vai trazer clientes para elas." (177-178), "Quanto fica vazio?" (187), "Quantas mesas a mais…?" (209) + dica (12), "Retorno (opcional)" (239), dicas (240,249), "Continuar" (263). Passo 3: 70-72, 131, 171, 173. Passo 4: 165, 207-209, 211, 213, 217-221, 228-231, 262-274, 282, 286, 306, 320, 326, 330-331, 344, 355-358, 386, 409. Passo 5: 96-97, 123, 130, 165-167, 180, 183, 74-81.

**Problemas:**
- `Step2:136` "Enquanto a IA lê o cardápio…" aparece também no modo "Digitar o cardápio", em que nenhuma IA lê nada (afirmação falsa nesse modo). Proposta: condicional. No modo manual: "Conte como é o seu salão e quais horários ficam vazios."
- `Step2:159,164,172` "turno" de funcionamento conflita com turno = almoço/tarde/noite. Proposta: "Dias do período {N}", "+ Adicionar outro período", "Remover período".
- `Step2:178` "Faixas em que sobra mesa. O convite de volta vai trazer clientes para elas." Usa "faixa" e "vai trazer" é promessa (afirmação sem prova). Proposta: "Horários em que sobra mesa. O convite de volta chama clientes para esses horários."
- `Step2:239-249` "Retorno (opcional)" e "Estimativa sua; usada só para calcular retorno." enterram o valor. Proposta de dica: "Sem ticket e margem, o painel mostra visitas, mas não reais." Legenda: "Para ver o resultado em reais (opcional)".
- `Step2:12` TABLES_HINT "…quantos convites mandar…": convite não é mandado, é entregue na mesa. Proposta: "…quantos convites entregar…". O resto da frase pode ficar.
- `SalonSentence:64` "Ler a frase". Proposta: "Preencher com a frase". O botão `:83` "Preencher o formulário" pode virar "Usar estes dados".
- `Step3:173` "Faixa de preço (sugerida)" colide com "faixa" de horário. Proposta: "Nível de preço (sugerido)".
- `Step4:165` vs `:209` "o código calcula" / "o sistema propõe" / "calculados pelas regras" trocam sinônimos para a mesma coisa. Proposta: um termo só, "o sistema".
- `Step4:213` "Usamos a opção de maior nota e um texto modelo." Proposta: "Usamos a oferta com melhor custo-benefício e um texto padrão."
- `Step4:217` "Benefício de 1ª visita (o “agora”)": o apelido interno "agora" aparece para o dono. Proposta: "Benefício de 1ª visita".
- `Step4:221` "por cliente identificado". Proposta: "por cliente novo".
- `Step4:274` "Por que esta" é um título truncado e diverge do link "Por que esta oferta?". Proposta: "Por que esta oferta".
- `Step4:330` "custo {máximo|estimado} ≈ R$": "máximo ≈" se contradiz. Proposta: "custo máximo R$ {x}/semana" (sem ≈) ou "custo estimado ≈ R$ {x}".
- `Step4:344` "Ofertas válidas calculadas pelo código (item do cardápio, custo dentro do teto, tipo permitido)." Proposta: "Ofertas possíveis com o seu cardápio e dentro do limite de custo."
- `Step4:409` "Revisar e ativar" funciona. Mas falta mostrar o custo total da semana antes de ativar. Proposta: no passo 5, "Custo máximo por semana: R$ {soma dos tetos × custo}", que é calculável.
- `Step5:74` "Comer Fora no salão ativo!" usa exclamação. Proposta: "Comer Fora no salão ativado".
- `Step5:165-167` "…quem foi sorteado para receber o convite (9 em cada 10)…". Aqui "sorteado" é quem recebe, enquanto a landing e a Visão geral usam "sorteado" para quem fica sem (termo inconsistente). Proposta: "9 em cada 10 clientes veem este convite. Os outros ficam sem convite, por sorteio, para medir o resultado."
- `Step5:183` "Ativar Comer Fora no salão" funciona como CTA de verbo + objeto.

### 1.9 Assistente do salão (copiloto)
`/home/user/ifood-genai-2027/src/ui/portal/copiloto/Copilot.tsx`, `ProposalCard.tsx`, `/home/user/ifood-genai-2027/src/modules/agente/domain/proposals.ts`, `/home/user/ifood-genai-2027/src/modules/agente/application/proposals.ts`, `copilot-turn.ts`, `/home/user/ifood-genai-2027/app/parceiro/salao/layout.tsx`

**Inventário:** botão "Assistente" (347); "Assistente do salão" (218); "Peça uma mudança ou tire uma dúvida." (220); exemplos (238); "Consultando os dados do restaurante…" (275); placeholder (315); "Enviar" (318); aviso (322); "Nova conversa" (225). Cartão: "O que muda/Antes/Depois" (97-99), "Aplicar" (127), "Editar no formulário" (130), "Descartar" (133), "Não dá para fazer assim" (52), "Aplicado. Veja em Configurações › X." (23), "Proposta vencida (vale 30 minutos)…" (122). Chips em layout:26-32,43. Servidor: copilot-turn:141,156,175,191,196; proposals.ts (domínio) 121-126, 140, 150, 153-156, 214, 227, 252-253, 273.

**Problemas:**
- `copilot-turn:156` "O assistente está desligado na aba “IA do restaurante”." O interruptor que desliga o assistente se chama "Usar agente de IA no plano da semana" (`ConfigManager:671`) e só aparece com a flag global. O dono não encontra o que procura (termo inconsistente). Proposta: renomear o interruptor para "Usar IA que consulta seus números (plano da semana e Assistente do salão)", ou separar os dois controles.
- `Copilot:322` "Nomes de clientes podem ser enviados; contatos não." Está na voz passiva e não diz para onde vão. Proposta: "A IA recebe o primeiro nome dos clientes, nunca telefone ou e-mail. Nada muda sem o seu clique."
- `Copilot:275` "Consultando os dados do restaurante…" funciona.
- `ProposalCard:127` "Aplicar" funciona porque o aria-label traz o título. Pode ficar.
- `proposals.ts:156` "custo máximo de até R$ X" é redundante. Proposta: "custo máximo de R$ X por semana".
- `proposals.ts:153` "Trocar a oferta do convite de {slot}" vira, no banner de Configurações (`configuracoes/page.tsx:46`), "✓ Atualizado pelo assistente: Trocar a oferta…": verbo no imperativo depois de "Atualizado". Proposta: guardar um título no passado ("Oferta do convite de {slot} trocada").
- `proposals.ts:214` "Parar o convite de {slot}" e "Convite neste horário: Ligado/Desligado" funcionam.
- `copilot-turn:141` "Não consegui responder agora. Você pode fazer a mesma mudança direto nas Configurações:" funciona, porque os dois-pontos abrem a lista de atalhos.
- `proposals (app):90` "Algum valor está fora dos limites (ex.: margem até 95%, resumo entre 06:00 e 22:00 …, teto até 999)." é lista genérica. Proposta: devolver o limite específico do campo que falhou.

### 1.10 Configurações (todas as abas)
`/home/user/ifood-genai-2027/app/parceiro/salao/configuracoes/page.tsx`, `/home/user/ifood-genai-2027/src/ui/portal/ConfigManager.tsx`, `NotifySettingsTab.tsx`, `AgentSection.tsx`, `OfferEditor.tsx`

**Inventário:** subtítulo (page:42); abas (157-165); "Agora: {gain}" (180); "Salvo · nova versão em vigor" (107); ERR (47-59); okWithWarnings (63-67); "Adicionar horário vazio" (212-213); "Desativar este horário vazio? Ele para de receber convites…" (315-316); "Convite de volta" (333); "Texto do convite (2º card)" (337); MenuTab (410-411, 437, 450); "Excluir apaga este restaurante…" (565). IA do restaurante: 632-698, 703, 721, 738, 749. Avisos: 45, 48-49, 84-86, 93-103, 112-126, OFF_HINT 17. Integrações: 61, 64-65, 70-76, 80-82, 117-130, 165-168, 172-173, 195.

**Problemas:**
- `ConfigManager:157` aba "Benefício agora" contra o título "Benefício de 1ª visita (o “agora”)". O "agora" é jargão interno. Proposta: aba "Benefício de 1ª visita".
- `:180` "Agora: <strong>{gain}</strong>" usa "Agora" como "atualmente" justo na aba do "agora", e também na aba Cartela (rótulo ambíguo). Proposta: "Valendo hoje: {gain}".
- `:48` "Escreva o texto (sem e-mail, telefone, HTML)…" usa "HTML", que é jargão. Proposta: "…sem e-mail, telefone ou sinais como < >".
- `:67` "vale a oferta da regra" e `KitManager:326` "o benefício que vale é o da regra": "regra" é jargão. Proposta: "vale a oferta escolhida acima".
- `:316` "Ele para de receber convites": horário não recebe convite. Proposta: "Os clientes deixam de ganhar convite para este horário. Os convites já entregues continuam valendo."
- `:337` "(2º card)". Proposta: "(o cliente vê no app)".
- `:647,698` dois botões de salvar ("Salvar tom" e "Salvar fatos e preferências") no mesmo bloco, e "Ver como fica" usa o que não foi salvo. Proposta: um só "Salvar preferências da IA" e a nota "A prévia usa o que está escrito, mesmo sem salvar."
- `:703` "Prévia nesta faixa". Proposta: "Prévia no horário".
- `:738` "Depois (com o tom)", mas a prévia usa tom, fatos e termos a evitar (rótulo impreciso). Proposta: "Depois (com suas preferências)".
- `:671` "Usar agente de IA no plano da semana" / "O agente consulta os números do sistema antes de escolher." Não diz o benefício nem o custo (Como funciona diz cerca de 14 s e 6× mais caro). Proposta: "IA consulta seus números antes de sugerir o plano", com dica "Demora mais para gerar. Também liga o Assistente do salão." Se for o caso: [FALTA: confirmar se o mesmo interruptor deve desligar o Assistente].
- `Notify:17` OFF_HINT "O envio automático ainda não está ligado." "ainda" sugere que vai ligar sozinho e não diz quem liga. Proposta: "O envio automático está desligado nesta demonstração. Veja a prévia do e-mail em Plano da semana."
- `Notify:123` "Convite de volta (reativação) por e-mail" conflita com "Convite de volta" da mesa. Proposta: "Convite para quem sumiu (reativação) por e-mail".
- `AgentSection:61` "Conectar um assistente de IA (MCP)" usa "assistente", que já é o nome do chat do Portal. Proposta: "Conectar outro app de IA (Claude e similares)".
- `AgentSection:70-76` lista só 3 capacidades e diz "não vê nome, telefone nem e-mail de clientes". Com as flags `clientes`/`edicao`, o app conectado também propõe e aplica mudanças e vê primeiro nome + inicial (`catalog.ts:45-58`; `como-funciona:129`). É afirmação incompleta ou falsa conforme a flag. Proposta: montar a lista pelas flags. Quando `clientes` estiver ligada: "Vê o primeiro nome e a inicial dos clientes, nunca telefone ou e-mail."
- `AgentSection:195` "quem tiver o token pode aprovar o plano" fica incompleto com a edição ligada. Proposta: "…pode aprovar o plano e mudar ofertas e cardápio".

### 1.11 Kit de divulgação e impressão
`/home/user/ifood-genai-2027/app/parceiro/salao/kit/page.tsx`, `/home/user/ifood-genai-2027/src/ui/kit/*.tsx`, `/home/user/ifood-genai-2027/src/modules/kit/domain/templates.ts`, `/home/user/ifood-genai-2027/app/parceiro/imprimir/[variantId]/page.tsx`

**Inventário:** cabeçalho (kit:36-44); "Seu kit ainda não foi gerado." / "Gerar meu kit" (67,82); "Gerando seu kit: a IA escreve…; o código confere as regras…" (92); selos de origem (15); "No salão/Aprovada/Rascunho" (138); nota de travado (155); "Criar nova versão X" (181); "Editar/Imprimir versão X" (185,189); "Abrir este QR" (192); "Aprovar peça" (201); "Está no salão" (204); cartão do garçom (219); porta-conta (248, 290); "Recado do restaurante" (394-396); editor (363, 373, 376, 323-327); revisor (417).

**Problemas:**
- `kit:41-42` "Cada QR identifica a peça e a versão (… cartão do garçom, porta-conta)". O cartão do garçom não tem QR (`KitPiece.tsx:49`) (afirmação falsa). Proposta: tirar "cartão do garçom" da lista.
- `kit:36-44` dois parágrafos de mecanismo e nenhum de ação (benefício enterrado). Proposta de abertura: "Imprima o display e o cartaz, coloque nas mesas e marque “Está no salão”. Cada versão tem o próprio QR: o painel mostra qual traz mais check-ins." O detalhe vai para um "Como os QRs contam" recolhido.
- `KitManager:92` "o código confere as regras". Proposta: "o sistema confere os textos".
- `KitManager:192` "Abrir este QR". Proposta: "Testar este QR como cliente".
- `KitManager:219` "(… para não contaminar o grupo de controle)" é jargão. Proposta: "Fala só do benefício de 1ª visita. O convite não aparece para não atrapalhar a comparação com quem fica sem convite."
- `KitManager:324` "Não dá para usar este texto (dados pessoais, HTML, referência desconhecida ou longo demais)." é genérico, ao contrário das mensagens exatas do convite. Proposta: usar `reasonMessage` como em `ConfigManager:96`.
- `KitManager:326` "— o benefício que vale é o da regra" tem travessão em copy curta e jargão. Proposta: "Salvo. Atenção: o texto cita número ou promessa. O cliente ganha o benefício configurado, não o do texto."
- `KitManager:363` "Use {beneficio} e {recompensa}…". Pode ficar (o dono precisa disso), mas vale um exemplo: "Ex.: Ganhe {beneficio} no 1º check-in".
- `templates.ts:45` recado padrão "Obrigado por estar aqui. Boa refeição!" usa exclamação. Proposta: "Obrigado pela visita. Boa refeição."
- `KitManager:417` "Revisor: ajustar antes de imprimir". Proposta: "Conferência: ajuste o texto antes de imprimir".

### 1.12 Validar código e Link do garçom
`/home/user/ifood-genai-2027/app/parceiro/salao/validar/page.tsx`, `/home/user/ifood-genai-2027/src/ui/portal/ValidateCode.tsx`, `WaiterLinkCard.tsx`, `/home/user/ifood-genai-2027/src/modules/salao/application/validate-code.ts`

**Problemas:**
- `validar:29` "Em produção, esta tela abriria num "modo salão" com PIN…" é nota de avaliador para o dono. Proposta: tirar do Portal, ou trocar por "Benefício, convite e recompensa só valem depois de validados aqui."
- `validate-code:48` "· liberado hoje pelas ferramentas do avaliador" também é de avaliador, mas só aparece quando a ferramenta foi usada. Pode ficar.
- `ValidateCode:134` "Confirmar". Proposta: "Confirmar e liberar o benefício".
- `WaiterLinkCard:116` "Revogar". Proposta: "Desligar link". No confirm `:33`: "Desligar o link do garçom?"

### 1.13 Clientes
`/home/user/ifood-genai-2027/src/ui/painel/CustomersView.tsx`, `/home/user/ifood-genai-2027/app/parceiro/salao/clientes/page.tsx`

- `:62` "com opt-in: N" e a coluna `:25` "Opt-in" com "nenhum" usam jargão. Proposta: "aceitam avisos: N", coluna "Aceita avisos" e "não".
- `:8-9` "Alvo da reativação." usa "alvo" e não diz como agir. Proposta: "Recebem convite para voltar quando você aprova o plano da semana."
- `:24` "Peça de origem". Proposta: "Chegou pelo QR do…".

### 1.14 Casca do Portal
`/home/user/ifood-genai-2027/src/ui/portal/StoreBox.tsx`, `PortalNav.tsx`, `CreateRestaurantButton.tsx`

- "loja" (StoreBox:33,36,40,53; "Trocar loja", "+ Nova loja", "Loja aberta") contra "restaurante" no resto (termo inconsistente). Faz sentido se a intenção é imitar o Portal real. Proposta: "Trocar restaurante" e "+ Novo restaurante", mantendo "Loja aberta/fechada" se for o padrão do Portal real.
- `CreateRestaurantButton:29` "Muitos restaurantes criados hoje a partir desta rede." usa "rede", que é ambíguo (rede de lojas ou de internet). Proposta: "…a partir desta conexão de internet".

### 1.15 Bastidores (lidos por avaliadores)
`/home/user/ifood-genai-2027/app/bastidores/como-funciona/page.tsx`, `qualidade/page.tsx`, `plataforma/page.tsx`, `avaliador/page.tsx`, `/home/user/ifood-genai-2027/src/ui/Roteiro.tsx`

- `como-funciona:132` "O e-mail do dono é guardado só como código (HMAC) + uma dica mascarada" é falso, porque também é guardado criptografado. Proposta: "O e-mail do dono fica guardado como código (HMAC) para o login e criptografado (AES-256-GCM) para o resumo semanal."
- `como-funciona:25-26` "A ideia: o salão cheio divulga o horário vazio." é colon reveal. Proposta: "O salão cheio divulga o horário vazio: o cliente que já está na mesa…"
- `:59` "A prova estatística fica para um piloto com ~50 restaurantes." é afirmação sem prova. [FALTA: cálculo de poder que justifique ~50.]
- `:66` "O painel "mede" o que foi programado: é isso que mostramos." Proposta: "O painel recupera o efeito programado, o que mostra que a medida funciona; não mostra efeito real."
- `:91` "é o comportamento honesto com pouco tempo de uso" é frase com cara de sabedoria. Proposta: cortar.
- `:120-124` os rótulos "H1 — …" a "H5 — …" usam 5 travessões (o limite em texto longo é 1-2). Proposta: "H1 (falta material): …".
- `:129` e `:133` repetem a regra "primeiro nome + inicial". `:129` tem mais de 80 palavras.
- `:133` cita "D262/D268", códigos internos. Proposta: cortar.
- O título da seção ("Dados pessoais, IA e segurança") não bate com o conteúdo (agendador, MCP, agente). Proposta: dividir em "Dados pessoais" e "Automação e IA".
- `qualidade:65` mostra códigos crus (`textoConvite:numero`). Proposta: passar por `guardNote()`.
- `qualidade:28` "Números agregados, sem os testes automáticos." é ambíguo. Proposta: "Fora as chamadas dos testes automáticos."
- `qualidade:115` "Aplicadas por porta". Proposta: "Aplicadas por canal".
- `plataforma:61` "Abandono por passo do assistente" chama a ativação de "assistente". Proposta: "Abandono por passo da ativação".
- `Roteiro:20` cita "Últimos check-ins de hoje", mas com `painel_valor` o bloco se chama "Hoje no salão" (`TodayFeed:53`). Proposta: usar o nome condicional.

---

## 2. Mapa de terminologia (conflitos e termo recomendado)

| Conceito | Variantes encontradas | Conflito | Recomendação |
|---|---|---|---|
| Janela com mesa sobrando | "horário vazio" (nav, Config, wizard), "faixa" (ExplainOffer:52, fact-labels "Faixa A", ConfigManager:703, Step2:178, landing "por faixa"), "Horário" (PM:476), "turno" (heatmap PM:425; fact-labels:10) | "faixa" também é "Faixa de preço" (Step3:173); "turno" também é período de funcionamento (Step2:159,172) | **horário vazio**. Tirar "faixa" e "Faixa A" do Portal (usar o `slotLabel`). **turno** só para almoço/tarde/noite. Funcionamento vira **período**. "Faixa de preço" vira "Nível de preço". |
| O que o cliente ganha | "Benefício agora", "Benefício de 1ª visita (o “agora”)", "benefício na hora", "oferta", "recompensa", "Agora: {gain}" (Config:180) | "agora" é jargão e colide com "atualmente" | **benefício de 1ª visita**, **convite de volta**, **recompensa da cartela**. **Oferta** = o que vale dentro de cada um (item + tipo). |
| Convite | "Convite de volta" (mesa), "Convite de volta (reativação)" (Notify:123), "Reativação" (PM:339), "convite de reativação" | o mesmo nome para os dois fluxos | **convite de volta** = mesa; **convite para quem sumiu** (reativação) |
| Uso do convite | "convites usados (código validado pelo garçom)", "Voltaram com convite" (= código gerado), "Códigos de convite validados", "Usados em 1 semana" | três rótulos e três janelas | **voltou com convite** = código validado; "voltou no horário" para código gerado; sempre com o período |
| Comparação | "grupo de controle", "sorteio", "sorteado" (Step5:165 = recebe; landing = não recebe), "holdout", "convite invisível", "contaminar" | "sorteado" aponta para os dois grupos | Rótulo: **grupo sem convite** (1 em 10, por sorteio). "grupo de controle" só em "Como medimos". |
| Plano e propostas | "Pacote proposto", "Plano da semana", "Proposta para esta semana", "Regra desta semana", "a regra" | "proposta" também nomeia os cartões do assistente | **pacote** = só a ativação; **plano da semana**; **proposta** = só cartão do assistente; "regra" vira "o que está valendo" |
| IA conversacional | "Assistente", "Assistente do salão", "copiloto" (Bastidores), "agente", "agente de IA", "agente (MCP)", "assistente de IA (MCP)", "assistente" = ativação (plataforma:61) | três sentidos para "assistente" | **Assistente do salão** = chat do Portal; **app de IA conectado** = MCP; **ativação** = o passo a passo; "agente" fora do Portal |
| O software | "o código", "o sistema", "as regras" | "código" também é o código de 6 letras | **o sistema** |
| Margem | "margem" (lucro), "margem de erro" (ValueHero:62) | duas no mesmo card | "margem" só para lucro; o resto como "pode ser acaso" |
| Tela do cliente | "2º card", "Sua jornada", "app" | jargão de tela | "o app do cliente" |
| Loja | "loja" (StoreBox) e "restaurante" | inconsistente | "restaurante" (ou "loja" em toda a casca, se o objetivo for imitar o Portal) |
| Peças | "Display de mesa" e "Display mesa" (today-feed:27) | — | "Display de mesa" |

---

## 3. Avaliação específica do topo da "Visão geral" e dos rótulos

**Teste dos 5 segundos (o dono entende o que ganhou?):**

| Estado (`Topline.kind`) | O que aparece em destaque | Passa? | Por quê |
|---|---|---|---|
| `causal_positivo` | "R$ X a mais em margem entre N convidados até agora" | Parcial | O número existe, mas "entre N convidados" confunde, não diz que o custo já foi descontado, "até agora" não tem data e o intervalo pode ter mínimo negativo embaixo de "a mais". |
| `causal_negativo` | "R$ X a menos em margem entre N convidados" | Parcial | Diz a perda, mas "Reveja a oferta" não tem link nem diz que é perda líquida. |
| `antecipado` | "N convites usados (código validado pelo garçom)" + "≈ R$ consumo (R$ margem) · custo R$" | Não | São 3 valores e o dono precisa subtrair; "não causal" é jargão; não existe uma linha de "ganhei X". |
| `sem_valores` | "N convites usados…" + "Custo dos convites R$" | Não | O título promete "Retorno em reais" e mostra só custo. Quando já há resultado causal, o resultado fica escondido atrás de "declare os valores". |

**Topo recomendado (um título para os 4 estados): "Quanto os convites renderam".**
- Positivo (só se `margin.lo > 0`): "R$ {cents} de margem a mais, já descontado o custo dos convites." Linha 2: "{nT} clientes com convite, comparados com quem ficou sem. Pode ficar entre R$ {lo} e R$ {hi}." Linha 3: "Conta feita com o ticket e a margem que você informou."
- Positivo em visitas, mas com `lo ≤ 0` em R$: "Os convites trouxeram visitas a mais. Em reais, ainda não dá para garantir lucro: pode ficar entre -R$ {|lo|} e R$ {hi}."
- Negativo: "Os convites custaram R$ {abs} a mais do que trouxeram de margem." Botão: "Trocar a oferta no plano da semana".
- Antecipado: "{usados} clientes voltaram com convite." Linha 2: "≈ R$ {margem − custo} de margem depois de pagar os convites (consumo R$ X · margem R$ Y · convites R$ Z)." Linha 3: "Parte deles voltaria mesmo sem convite. O valor confirmado aparece quando o grupo sem convite completar 14 dias."
- Sem valores: "{usados} clientes voltaram com convite. Os convites custaram R$ {custo}." Botão: "Informar ticket e margem para ver em reais". Se `motivo === "causal"`, o título vira: "Já dá para medir o resultado. Informe ticket e margem para ver em reais."
- Zero usados: "Nenhum cliente voltou com convite ainda." Linha 2: "O primeiro resultado aparece quando um convidado voltar no horário vazio e o garçom validar o código."

**Pares de rótulos ambíguos:**
1. **"convites com 1 semana completa" (`fact-labels:14`) contra "convites emitidos (30 dias)" (`:16`), e na tabela do Plano "Usados em 1 semana: 25% de 12" contra "Emitidos (30 dias): 8" (`PlanManager:478-479,488-489`).** `issued7d` conta de 37 a 7 dias atrás (`verdict.ts:19-23`). `issued30d` conta de 29 dias atrás até hoje (`insights.ts:97`). Se a emissão caiu nas últimas semanas (teto reduzido, horário desativado), o primeiro passa do segundo. Proposta de rótulo: "Usados na 1ª semana: 3 de 12 (25%)", com a nota "Base: convites entregues entre dd/mm e dd/mm, que já tiveram 7 dias para ser usados." Outra saída: "Emitidos em 30 dias (até hoje)". O melhor é alinhar as janelas no código ou mostrar as datas das duas.
2. **"convites usados em até 1 semana" (`fact-labels:12`)** mostra percentual. Proposta: "% usados na 1ª semana".
3. **"convites usados" no topo (desde sempre), em "Metas desta semana" (semana atual), na tabela de coortes (por semana de emissão, coluna em %) e no funil "Códigos de convite validados" (período escolhido).** O mesmo rótulo aparece com 4 janelas e só algumas trazem o período. Proposta: sempre com o período ("desde dd/mm", "nesta semana", "nos últimos 7/30 dias").
4. **"Voltaram com convite" contra "Códigos de convite validados" (`funnel.ts:42-43`).** O primeiro não exige validação. Proposta: "Voltaram no horário do convite" e "Usaram o convite".
5. **"Deixaram contato" (`funnel.ts:40`)** mede clientes novos. Proposta: "Clientes novos (1ª visita)".
6. **"N convites usados · meta: M mesas" (`SlotGoals:20`)** mistura unidades. Proposta: "{n} de {m} mesas a mais (1 convite usado = 1 mesa)".
7. **"Custo × margem das visitas" (`Dashboard:360`)** é na verdade uma razão. Proposta: "Quanto da margem vai para benefícios".
8. **"+0,12 visita por cliente" (`Dashboard:172`).** Proposta: "+12 visitas a cada 100 convidados".
9. **ValueHero (R$) e MetricHero (R$ de novo em `Dashboard:193-194`)** mostram o mesmo resultado duas vezes com frases diferentes. Proposta: deixar o R$ só no topo.

---

## 4. Linhas que já funcionam e devem ficar

- `/home/user/ifood-genai-2027/app/parceiro/salao/page.tsx:94`: "Envie a foto do cardápio, diga quais horários ficam vazios e receba um pacote pronto: benefício na hora, convite de volta para o horário vazio e kit para imprimir." Também o CTA "Cadastrar meu restaurante" (:97).
- `/home/user/ifood-genai-2027/src/ui/portal/wizard/Step1Cardapio.tsx:66`: "O cardápio do salão costuma ter itens e preços diferentes do delivery." Também "Prefere digitar? Digitar o cardápio" (:121-124).
- `/home/user/ifood-genai-2027/src/ui/portal/wizard/SalonSentence.tsx:49`: "O que você não disser continua como está; número que não está na frase nunca é inventado."
- `/home/user/ifood-genai-2027/src/ui/portal/wizard/Step2Salao.tsx:12` (e `ConfigManager.tsx:17`): "4 mesas ≈ 16 convites por semana, depois ajustado pelo uso real". Só trocar "mandar" por "entregar".
- `/home/user/ifood-genai-2027/src/ui/portal/wizard/Step5Resumo.tsx:75-81`: a lista "Próximos passos" e os CTAs "Ver meu kit" / "Ver minha página".
- `/home/user/ifood-genai-2027/app/parceiro/salao/validar/page.tsx:22`: "Digite o código que o cliente mostra no app. O sistema reconhece se é 1ª visita, convite ou recompensa." Também as recusas em `ValidateCode.tsx:9-11` e "O código tem 6 letras e números." (:42).
- `/home/user/ifood-genai-2027/src/ui/portal/WaiterLinkCard.tsx:76` e `:25`: "Abre só esta tela de validar, sem o resto do Portal e sem login…" e "O link atual é desligado: todos os celulares da equipe precisam ler o QR novo."
- `/home/user/ifood-genai-2027/src/modules/ia/guardrails/messages.ts:21,24,32`: "Está com N caracteres; o limite é 160. Tire N.", "Tire e-mail, telefone ou CPF: o convite vai para muitos clientes." Específicas e dizem o que fazer.
- `/home/user/ifood-genai-2027/src/modules/agente/domain/proposals.ts:150,178`: "Convites já emitidos continuam com a oferta antiga." e "Não existe “pausar só hoje”: volte quando quiser."
- `/home/user/ifood-genai-2027/src/modules/agente/application/copilot-turn.ts:191`: "Faltou informação para montar a mudança (o prato, o horário ou o tipo da oferta). Diga o que trocar e pelo quê."
- `/home/user/ifood-genai-2027/src/ui/portal/copiloto/Copilot.tsx:322`: só o trecho "Aqui, nada muda sem o seu clique."
- `/home/user/ifood-genai-2027/src/modules/analytics/domain/operations.ts:59,61`: "Teto atingido em …: os N convites desta semana acabaram." e "Confira se a equipe está validando no Portal."
- `/home/user/ifood-genai-2027/src/ui/painel/CustomersView.tsx:11`: "Não recebem reativação, para não trocar o horário de quem já vem." Também `clientes/page.tsx:25` "Esta base é do seu restaurante."
- `/home/user/ifood-genai-2027/src/ui/portal/NotifySettingsTab.tsx:85,103,115`: "O link vale uma vez, só para o plano daquela semana.", "O plano espera sua aprovação no Portal." e "Só para quem aceitou receber e-mails. No app, o convite aparece sempre."
- `/home/user/ifood-genai-2027/src/ui/portal/ConfigManager.tsx:632,674`: "Como a IA escreve para o seu restaurante" e "Seus textos aprovados viram exemplo de estilo só para este restaurante."
- `/home/user/ifood-genai-2027/src/ui/kit/KitManager.tsx:155,248`: a nota de versão travada e a descrição do porta-conta.
- `/home/user/ifood-genai-2027/app/parceiro/salao/kit/page.tsx:42`: "imprima o mesmo display para todas as mesas" (sem o erro do cartão do garçom).
- `/home/user/ifood-genai-2027/app/parceiro/aprovar/[token]/page.tsx:18`: "…Abra este link de novo em alguns minutos." E a estrutura "Ao aprovar, N clientes … recebem um convite para voltar" (:56), corrigindo quem recebe.
- `/home/user/ifood-genai-2027/app/parceiro/resumo/parar/page.tsx:17`: "O plano da semana continua no Portal. Você pode religar o resumo em Configurações › Avisos e automação."
- `/home/user/ifood-genai-2027/src/modules/contas/application/request-code.ts:36-42`: o e-mail do código (assunto com o código, validade e aviso de protótipo). E a dica `LoginForm.tsx:130`.
- `/home/user/ifood-genai-2027/src/modules/planos/domain/plan-facts.ts:22`: "Esta é a oferta válida com a melhor relação entre o que o cliente ganha e o custo para você."
- `/home/user/ifood-genai-2027/app/bastidores/como-funciona/page.tsx:150`: "Mede a volta a qualquer restaurante do programa, sem método publicado; não é resultado deste protótipo." Também a tabela "Já existe × Novo" (:103-109) e "Conta de bolso [hipótese]" em `plataforma/page.tsx:89`.