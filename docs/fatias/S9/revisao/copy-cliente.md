# Auditoria de copy — copy-cliente (S9, 22/11, skill copywriting; só leitura)

Base para a Parte B do planejamento. Decisões do candidato que prevalecem: D278–D281.

# Auditoria de copy: cliente, garçom, kit impresso e e-mails (Comer Fora no Salão)

Não alterei nenhum arquivo. Apliquei as regras de `SKILL.md` e `ai-tells.md`.

**Caminhos usados abaixo** (todos dentro de `/home/user/ifood-genai-2027/`):
- `RV` = `app/r/[slug]/RestaurantView.tsx`
- `CF` = `app/r/[slug]/checkin/CheckinFlow.tsx`
- `TX` = `src/ui/cliente/textos.ts`
- `RS` = `src/ui/cliente/RulesSheet.tsx`
- `LS` = `src/ui/cliente/LoginSheet.tsx`
- `CR` = `src/ui/cliente/CheckinResult.tsx`
- `IC` = `src/ui/cliente/InviteCard.tsx`
- `JV` = `app/app/jornada/JourneyView.tsx`
- `JL` = `src/ui/cliente/JourneyLogin.tsx`
- `MD` = `src/ui/cliente/MyData.tsx`
- `NP` = `src/ui/cliente/NotificationPrefs.tsx`
- `DP` = `app/cliente/descadastrar/page.tsx`
- `UN` = `app/cliente/descadastrar/Unsubscribe.tsx`
- `GP` = `app/garcom/page.tsx`
- `VC` = `src/ui/portal/ValidateCode.tsx`
- `VCD` = `src/modules/salao/application/validate-code.ts`
- `TPL` = `src/modules/kit/domain/templates.ts`
- `KP` = `src/ui/kit/KitPiece.tsx`
- `DM` = `src/modules/salao/application/deliver-messages.ts`
- `CL` = `src/modules/salao/application/customer-login.ts`
- `OF` = `src/modules/beneficios/domain/offers.ts`
- `SEED` = `src/db/seed/vitrine.ts`

---

## 0. Os problemas mais graves (o que muda os primeiros 10 segundos)

1. **O cliente chega a explicações do grupo de controle em um toque.**
   - A seta "Voltar" da página do QR (`RV:121-123`, `href="/"`) e o "Voltar ao início" do 404 (`app/not-found.tsx:11`) levam para `/`.
   - Em `/` aparece "O dono vê o retorno medido contra um grupo de controle" (`app/page.tsx:26`) ou, com `copy_v2`, "Por isso 1 em cada 10 clientes não recebe convite" (`src/ui/landing/OwnerLanding.tsx:17`, e também as linhas 12 e 37).
   - "Créditos das fotos" (`RV:109`) e o link "Como funciona" da barra de protótipo (`src/ui/components/PrototypeBar.tsx:53-55`, presente em todas as telas do cliente) abrem `/bastidores/como-funciona`. Lá está "9 em 10 recebem; 1 em 10 fica no grupo de controle" (`app/bastidores/como-funciona/page.tsx:55`).
2. **A página do QR fala em convite antes do check-in, e o próprio código diz que não deveria.** `TX:6`, exibido em `RV:92`, diz "Faça check-in e você pode ganhar um convite para voltar". O comentário em `RV:205` afirma que nada do convite aparece antes do check-in. A mesma frase vai impressa (`TPL:31`, usada em `KP:36` e `KP:96`). Ela aparece igual para os dois grupos, então não quebra o sorteio. Mas o "pode" já sinaliza que nem todos ganham, e o cliente do grupo de controle recebe uma promessa que nunca se cumpre.
3. **"Código" quer dizer duas coisas para o mesmo cliente, com minutos de diferença.** O código de 6 números do e-mail serve para entrar (`LS:201`, `CL:44`). O código de 6 letras e números serve para mostrar ao garçom (`TX:9`). O risco é o cliente mostrar o código errado ao garçom.
4. **O convite manda "voltar" em dias que podem incluir hoje, mas ele não vale no dia em que foi ganho.** A regra está em `decide-checkin.ts:81` (`issuedDay !== day`). Um convite ganho numa terça às 16h mostra "Volte Ter, Qua, Qui · 15h–18h" (`TX:34-40`). Nenhum texto avisa que só vale a partir do dia seguinte.
5. **O benefício de 1ª visita é prometido a todo check-in.**
   - Cartão do garçom: "Hoje, quem faz check-in ganha {beneficio}" (`TPL:34`).
   - Texto modelo do display: "Faça check-in e ganhe {beneficio}" (`TPL:43`).
   - Peças da Cantina de exemplo: "Fez check-in, ganhou sobremesa" e "Ganhe um doce no seu check-in" (`SEED:77-78`, `SEED:84`).
   - No login: "Ao continuar, você ativa: …" (`LS:176`), mostrado também a quem já usou a 1ª visita.
6. **O aviso de GPS diz "você não está no restaurante" para quem só negou a permissão de localização.** Os estados `negado`, `tempo_esgotado` e `sem_suporte` caem na mesma folha (`src/ui/cliente/gps.ts:14`, `CF:99-100`, `TX:7`).
7. **"na 6ª" no porta-conta pode ser lido como "sexta-feira"** (`TPL:18`).
8. **O e-mail de convite repete a mesma frase duas vezes.** A primeira linha (`DM:44`) e o texto do convite aprovado (`SEED:69`, ou o texto modelo em `src/modules/onboarding/application/package.ts:33`) começam com a mesma oração "Volte {horario} e ganhe/aproveite {oferta}".

---

## 1. Por tela, e-mail e peça impressa

### A. Página do restaurante aberta pelo QR (`/r/[slug]`): primeira tela do cliente

**Inventário**

| Elemento | Texto | Local |
|---|---|---|
| Faixa vermelha (só com `copy_v2`) | "{Doce grátis}: {Panna cotta}" + "na sua 1ª visita" | `RV:217-218` |
| Passos | "Faça check-in" · "Receba o código" · "Diga o código ao garçom" | `RV:223` |
| Prova social | "{n} check-ins nos últimos 7 dias" | `RV:232` |
| Nome / dados / horário | `{name}`, "Italiana • $$$", "Aberto agora • Fecha às 23:30" | `RV:132-134`; `slots.ts:130,138` |
| Abas | "Benefícios" / "Sobre" | `RV:141-142` |
| Título | "Benefícios pra você" | `RV:57` |
| Cupom do benefício | título "Doce grátis"; subtítulo "Pra novos clientes · Panna cotta"; chips "Todos os dias", "Dia e Noite" | `OF:46,92`; `TX:42-44`; `RV:67-68` |
| Cupom da cartela | "Junte Selos e Ganhe" / "Pra clientes frequentes" + mesmos chips | `RV:77-83` |
| Linha do convite | `TX.linhaConvite` | `RV:92` |
| Sobre | "Sobre o restaurante", "Localização", "Endereço não informado", créditos das fotos | `RV:96,105-110` |
| Botão principal | "Fazer check-in e ativar o benefício" (`copy_v2`) / "Check-in" | `RV:149` |
| Folha de detalhes | "Benefícios pra você" / "Faça o check-in para ativar o benefício e aproveitar" / botão "Check-in" / "Foto ilustrativa" / "Recado do {name}" / "Ver detalhes e regras" | `RV:157-194` |

**Problemas**

| Texto atual | Local | Regra quebrada | Reescrita proposta |
|---|---|---|---|
| "Check-in" (botão sem `copy_v2` e botão da folha) | `RV:149`, `RV:161` | CTA fraco (substantivo, sem verbo, sem ganho) | "Fazer check-in" |
| "Fazer check-in e ativar o benefício" | `RV:149` | "ativar" é palavra da empresa; o cliente ganha um item | "Fazer check-in e ganhar {gain}" só para quem ainda não usou a 1ª visita. [FALTA: a página saber se o cliente já usou a 1ª visita]. Sem esse dado: "Fazer check-in" (a faixa já mostra a oferta) |
| "{title}: {itemName}" → "Doce grátis: Panna cotta" | `RV:217` | Dois-pontos fazendo revelação; nome do benefício diferente do resto do produto | "Panna cotta grátis na sua 1ª visita" (usar `gain`) |
| "Diga o código ao garçom" | `RV:223` | Termo inconsistente (em outros pontos: "informe", "mostre") | "Mostre o código ao garçom" |
| "Benefícios pra você" | `RV:57`, `RV:157` | Plural vago; "pra" convive com "para" no mesmo app | "O que você ganha aqui" |
| "Pra novos clientes · Panna cotta" | `OF:92` + `TX:43` | Jargão ("novos clientes" é visão do dono); a regra real é "1ª visita" | Título do cupom: "Panna cotta grátis"; subtítulo: "Na sua 1ª visita" |
| Chips "Todos os dias" + "Dia e Noite" | `RV:67-68`, `81-82`, `175-176` | "Dia e Noite" em maiúsculas de título e vago; dois chips para uma ideia só | Um chip: "Qualquer horário" (a regra em `RS:14` diz "em qualquer horário de funcionamento") |
| "Junte Selos e Ganhe" | `RV:77` | Maiúsculas de título; não diz o que se ganha | "Cartela: 6 selos, {recompensa}". Exemplo: "Cartela: 6 selos, Tiramisù grátis" |
| "Pra clientes frequentes" | `RV:78` | Não explica a mecânica | "1 selo por visita, até 1 por dia" |
| "Faça check-in e você pode ganhar um convite para voltar" | `TX:6` / `RV:92` | Risco para o grupo de controle (antes do check-in); "pode" deixa a promessa incerta; contradiz `RV:205` | Recomendo retirar antes do check-in. Se o produto mantiver (D223), use a forma verdadeira e neutra: "Depois do check-in, veja se a casa tem um convite para você voltar." [FALTA: decisão de produto] |
| "Faça o check-in para ativar o benefício e aproveitar" | `RV:158` | "e aproveitar" é enchimento no fim da frase | "Faça check-in, receba o código e mostre ao garçom para ganhar {gain}." |
| "Recado do {page.name}" | `RV:180` | Erro de concordância ("Recado do Cantina…") | "Recado da casa" |
| Aba "Sobre" mostra só o endereço; "Sobre o restaurante" fica na aba "Benefícios" | `RV:96`, `RV:103-114`, `RV:142` | Uma ideia por seção / confuso para o cliente | Mover a descrição para a aba "Sobre" ou trocar o nome da aba para "Endereço" |
| Seta Voltar → `/` | `RV:121-123` | Confuso (leva à página do dono) e expõe o grupo de controle | Destino `/app/jornada` ou o histórico do navegador |
| "Créditos das fotos" → `/bastidores/como-funciona` | `RV:109` | Expõe o grupo de controle | Âncora própria só com os créditos |

**Pode ficar:** "{n} check-ins nos últimos 7 dias", porque o número é real e só aparece a partir de 5 (`queries.ts:55`). Os três passos também ficam, trocando só "Diga" por "Mostre".

---

### B. Folha "Detalhes e regras" (`RS`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Como usar" → "Você terá que fazer check-in depois" | `RS:29-31` | Confuso para o cliente: aparece justo antes de ele fazer o check-in | "1. Toque em Fazer check-in. 2. Entre com seu e-mail. 3. Mostre o código ao garçom." |
| "Após primeiro check-in, a cartela vence em 90 dias" | `RS:11` | Falta artigo; frase tropeça | "A cartela vale 90 dias a partir do 1º check-in." |
| "Cada cartela gera 1 recompensa" | `RS:12` | Não nomeia a recompensa | "Com 6 selos, você ganha {recompensa}." |
| "Recompensas válidas apenas pra consumo no local, na unidade {nome}" | `RS:13` | "pra" e "para" misturados | "Benefícios valem só para consumir aqui, na {nome}." |
| "Benefícios e recompensas valem depois que o garçom confirma o código" | `RS:15` | Bom. Só alinhar o termo | Manter |

O botão "Entendi" (`RS:24`) está adequado. Faltam no regulamento: 1 selo por dia (já coberto em `RS:10`) e a validade de 1 dia do código ("Cada código vale só no dia do check-in").

---

### C. Tela de check-in e aviso de GPS (`CF`, `TX:7-8`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Faça o check-in / e junte selos para ganhar!" | `CF:137-138` | Ponto de exclamação; "para ganhar" sem objeto; esconde a oferta principal | Cliente novo: "Faça check-in e ganhe {gain}". Cliente que volta: "Faltam {n} selos para {recompensa}". [FALTA: passar à tela se a 1ª visita já foi usada] |
| "Recompensas" | `CF:145` | Plural para um item só | "Sua cartela" |
| "6 selos - {itemName}" logo abaixo de "{itemName}" | `CF:150-151` | Repete o nome; hífen no lugar de pontuação | Linha única: "Com 6 selos: {recompensa}" (dois-pontos como rótulo, sem revelação) |
| Chip "Próxima recompensa" | `CF:153` | Redundante com o título | Remover; manter "Faltam N selos" |
| "Não conseguimos fazer seu check-in." | `CF:65` | Erro sem orientação | "Seu check-in não foi registrado. Confira a internet e toque em Tentar de novo." |
| "Ative os cookies para fazer check-in." | `CF:75` | Jargão leve | "Para fazer check-in, permita cookies neste navegador." |
| "Parece que você não está no restaurante!" | `TX:7` | Ponto de exclamação; tom de acusação; errado quando a permissão foi negada | Longe: "Você está no restaurante?". Permissão negada ou sem GPS: "Não conseguimos ver sua localização" |
| "O GPS pode não ser preciso. Se você já está no restaurante, confirme abaixo para tentarmos validar seu benefício novamente." | `TX:8` | Confuso: nada foi "validado" antes; "novamente" não faz sentido | Longe: "O GPS às vezes erra dentro do salão. Se você está na {nome}, confirme para continuar." Negado: "Tudo bem. Confirme que você está na {nome} para continuar." |
| "Confirmar localização" / "Fechar" | `CF:211`, `CF:200` | CTA sem a fala do cliente | "Estou no restaurante" / "Agora não" |
| "Verificando sua localização…" | `CF:92` | Bom | Manter |

---

### D. Login por e-mail no check-in (`LS`)

**Passo do e-mail**

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Entre para ativar seus benefícios" | `LS:283` | Plural; "ativar" é palavra da empresa | "Entre com seu e-mail" |
| "Ao continuar, você ativa: Doce grátis · Panna cotta e ganha 1 selo." | `LS:176` | Dois-pontos fazendo revelação; promete a 1ª visita a quem já usou (o cookie pode ter expirado) | "Depois de entrar, você recebe o código de {gain} e 1 selo." Mostrar só se a 1ª visita não foi usada. [FALTA: esse dado no passo de e-mail] |
| `TXT.consentimento` ("Aceito que {restaurante} veja meu nome, e-mail e telefone e registre minhas visitas. O assistente de IA do restaurante pode ver meu primeiro nome e minhas visitas, nunca meu contato.") | `TX:15` | Concordância quebra conforme o nome ("Aceito que Cantina…"); cita telefone que é opcional; texto longo dentro de uma caixa de seleção | "Aceito que o restaurante {nome} veja meu nome, e-mail e telefone (se eu informar) e registre minhas visitas. O assistente de IA da casa vê só meu primeiro nome e minhas visitas." |
| "Marque o aceite para continuar" | `LS:98` | "aceite" como substantivo é jargão | "Marque a caixa acima para continuar." |
| "Informe um e-mail válido" | `LS:97`, `LS:105` | Inconsistente com `JL:26` ("Digite um e-mail válido, como nome@exemplo.com.") | Usar uma forma só: "Digite um e-mail válido, como nome@exemplo.com." |
| "Protótipo de case, não é o iFood. Você pode apagar seus dados quando quiser." | `TX:12` | Aviso diferente da barra ("não é produto oficial do iFood", `src/shared/prototype.ts:2`); a barra já aparece repetida no topo da folha (`src/ui/components/BottomSheet.tsx:110-113`) | "Você pode apagar seus dados quando quiser, em Sua jornada." (a barra já carrega o aviso de protótipo) |
| "Enviar código" | `LS:287` | Razoável; dá para dizer o que chega | "Receber código por e-mail" |

**Passo do código**

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Digite o código" / "Enviamos um código de 6 números para {email}" | `LS:198-202` | Mesmo termo do código do garçom | "Digite o código de acesso" / "Enviamos 6 números para {email}. Vale por 10 minutos." (`LOGIN_CODE_TTL_MIN = 10`) |
| "Entrar" | `LS:207` | CTA genérico; o passo seguinte é o check-in ou o perfil | "Confirmar código" |
| "Não deu certo. Confira o código." | `LS:135` | Vago | "Esse código não funcionou. Confira os 6 números ou peça outro." |
| "Muitas tentativas. Espere alguns minutos." (`LS:128`) vs "Muitas tentativas. Espere alguns minutos e tente de novo." (`LS:104`) | — | Inconsistente | Usar uma forma |

**Passo do perfil (cliente novo)**

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Comunicações de promoções" | `LS:179` | Linguagem corporativa; o produto chama isso de convite | "Convites da {nome}" |
| "Receba os convites e benefícios de {restaurantName}" | `LS:180` | Vago | "Escolha como a casa pode te avisar." |
| Interruptor "Convites de volta no app" + dica "Sem e-mail e sem esta opção, você não recebe convites para voltar" | `LS:183` (repetido em `NP:69-70`) | Afirmação falsa: o convite da mesa aparece no app de qualquer jeito (`email-prefs.ts:4`); este interruptor só libera os convites mandados depois (reativação). Também fala de convite antes do check-in | Rótulo: "Convites para outras datas". Dica: "Deixa a {nome} te mandar convites para voltar depois desta visita." |
| Interruptores já vêm ligados (`optEmail: true, optApp: true`) | `LS:41` | Não é copy, mas é consentimento de marketing pré-marcado (LGPD) | [FALTA: decisão jurídica] |
| "Informe seu nome" | `LS:145` | Inconsistente com `MD:24` | "Escreva seu nome (pelo menos 2 letras)." |
| "Continuar" | `LS:235` | Este toque já dispara o check-in (`CF:224-227`) | "Fazer check-in" |

**Passo do consentimento (cliente já logado, restaurante novo)**

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Olá, {firstName}!" | `LS:263` | Ponto de exclamação | "Olá, {firstName}" |
| "Aceitar e fazer check-in" | `LS:267` | Bom (verbo + resultado) | Manter |

---

### E. Resultado do check-in e cartão do convite (`CR`, `IC`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Check-in feito!" (4 variações) | `CR:12-15` | Ponto de exclamação | "Check-in feito" |
| "Você ganhou 1 selo." (1ª visita) | `CR:12` | Valor não comunicado: o principal é o código do benefício, que aparece abaixo da cartela | "Mostre o código abaixo ao garçom e ganhe {gain}. Você também ganhou 1 selo." |
| "Você ganhou mais 1 selo." | `CR:13-14` | Errado quando a cartela recomeça (`stamp-card.ts:21-24`); não comemora a cartela completa | Cartela completa: "Cartela completa. Mostre o código ao garçom e ganhe {recompensa}." |
| "Você voltou no horário do seu convite." | `CR:15` | Não diz o que fazer | "Seu convite vale agora. Mostre o código ao garçom e ganhe {gain}." |
| Rótulos "Benefício de 1ª visita" / "Seu convite" / "Recompensa da cartela" + título "Doce grátis · Panna cotta" | `CR:48-52`; `do-checkin.ts:136-139` | O garçom vê o mesmo benefício como "Panna cotta grátis" (`VCD:44`) | Título do cupom = `gain` ("Panna cotta grátis") em todo lugar |
| "Informe este código ao garçom" | `TX:9` | Termo inconsistente | "Mostre este código ao garçom" |
| "Vale só hoje" | `TX:10` | Bom | Manter |
| "Ver minha jornada" | `CR:64` | "minha" aqui, "Sua" no resto | "Ver Sua jornada", ou "Ver meus convites e visitas" (ver item 2) |
| Cabeçalhos "Seu convite" / "Seu convite vale hoje" / "Seu convite continua valendo" | `IC:6` | Bons | Manter |
| "Volte Ter, Qua, Qui · 15h–18h e ganhe Cannoli grátis" | `TX:34-40` / `IC:12` | Confuso: não vale no mesmo dia (`decide-checkin.ts:81`); quando `usar_hoje`, o cliente já está no restaurante e lê "Volte" | Novo: "A partir de amanhã: {dias}, {horas}. Ganhe {gain}." [FALTA: calcular a próxima janela válida, já disponível em `nextValidWindow`]. Usar hoje: "Hoje: {gain}. Mostre o código acima ao garçom." |
| "Válido até {dd/mm}" | `IC:15` | Inconsistente ("Vale até" no e-mail, `DM:52`) | "Vale até {dd/mm}" |
| Recado do convite renderizado | `IC:19` + `SEED:69` | Repete a frase do cabeçalho; "ganhe {oferta}: o doce da casa…" é revelação por dois-pontos | Texto da Cantina: "O doce da casa combina com o seu café." Texto modelo "Volte {horario} e aproveite {oferta}." (`package.ts:33`, `generate-plan.ts:35`): não mostrar (`null`), porque só duplica o cabeçalho |
| `TX.comoUsarConvite` "…faça check-in aqui no app e o código do benefício aparece para mostrar ao garçom." | `TX:17-18` | "app" (é página web); frase longa e passiva | "Volte nesses dias e horários, faça check-in de novo e mostre o código ao garçom." |
| "Liberado hoje pelas ferramentas do avaliador." | `IC:23` | Jargão interno (só no cenário do avaliador) | Aceitável no protótipo; nunca em produção |
| "Adicionar à agenda" | `IC:31` | Bom | Manter |
| "Você já fez check-in hoje" / "Volte outro dia para ganhar mais um selo." | `CR:16` | Bom | Manter |
| "O benefício de 1ª visita vale só no primeiro check-in." | `TX:16` | Correto, mas seco | "A Panna cotta grátis vale só na 1ª visita, e você já usou." |

---

### F. Jornada, entrar pela Jornada, conta, dados e notificações (`JV`, `JL`, `MD`, `NP`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Olá, Visitante" | `JV:64` | Aceitável | "Olá" (sem nome) |
| "Já fez check-in em algum restaurante? Entre para ver seus convites e seus dados." | `JV:71` | Bom (pergunta na voz do leitor) | Manter |
| Indicadores "Visitas" / "Reservas" 0 / "Avaliações" 0 | `JV:127-129` | Afirmação sem prova: zeros fixos de recursos que não existem | Mostrar só "Visitas" |
| "Seus convites" + "N novos" + "{restaurante} te convidou para voltar" / "convite da sua visita" + "Ver" | `JV:99-113` | "Ver" é CTA fraco; dois tipos de convite que o cliente não distingue | "Ver convite"; usar "Convite da sua visita de {dd/mm}" e "Convite para voltar" |
| "Convite ativo" acima do cartão | `JV:170` | Repete "Seus convites" mais acima | Remover o rótulo (o cartão já diz "Seu convite") |
| "Seu convite vale hoje até {18h} · {restaurante}" | `JV:89` | Bom | Manter |
| "Explorar restaurantes ›" | `JV:122` | Leva sempre à Cantina de exemplo | [FALTA: lista real] ou "Ver a Cantina de exemplo" |
| "Ao fazer check-in, suas visitas serão registradas aqui" | `JV:140` | Voz passiva | "Suas visitas aparecem aqui depois do 1º check-in." |
| "Seu nome, telefone e e-mail serão apagados. Suas visitas continuam só como números anônimos dos restaurantes." | `JV:192` | Voz passiva; não avisa da perda de convites e códigos | "Vamos apagar seu nome, telefone e e-mail. Você para de receber convites. Os restaurantes continuam vendo só a contagem de visitas, sem saber que eram suas." |
| "Gerenciar notificações" / "Seus dados" / "Sair" / "Apagar meus dados" | `JV:205-216` | Bons | Manter |
| "Ainda não há cadastro de cliente com este e-mail. Faça o check-in num restaurante para se cadastrar." | `JL:51` | Leve jargão ("cadastro") | "Este e-mail ainda não fez check-in. Seu cadastro nasce no 1º check-in num restaurante." |
| "Trocar e-mail ou pedir outro código" | `JL:92` | Bom | Manter |
| "(é o do seu login; para trocar, entre com outro e-mail)" | `MD:68` | Confuso: entrar com outro e-mail cria ou abre outra conta, não troca o e-mail | "Este é o e-mail com que você entra. [FALTA: fluxo para trocar o e-mail]" |
| "Dados salvos ✓" | `MD:78` | Símbolo decorativo | "Dados salvos." |
| "Os restaurantes em que você aceitou participar veem seu nome, telefone e e-mail." | `MD:70` | Bom e preciso | Manter |
| Dica de "Convites": "Inclui o convite para voltar" | `NP:55` | Tautologia | "Avisos de convite novo por e-mail" |
| "Para ligar de novo, entre em Sua jornada" | `NP:27` | Bom | Manter |

---

### G. Página de descadastro (`DP`, `UN`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Preferências de e-mail" (título) | `DP:23` | Não diz de qual restaurante | "E-mails da {restaurante}" |
| "Este link não vale mais. Use a engrenagem em Sua jornada." | `DP:27`, `UN:34` | No `UN`, aparece para qualquer erro, inclusive falha de rede (afirmação errada) | Erro de rede: "Não conseguimos salvar agora. Tente de novo." Token inválido: manter |
| "Parar todos os e-mails deste restaurante" | `UN:30` | Bom (verbo + resultado) | Manter |
| "Pronto: você não recebe mais e-mails deste restaurante." | `UN:21` | Dois-pontos usado como rótulo; aceitável | "Pronto. A {restaurante} não vai mais te mandar e-mails." |
| "Você continua vendo os convites em Sua jornada, no app." | `DP:31` | "no app" | "Seus convites continuam em Sua jornada." |

---

### H. Tela do garçom (`/garcom`; `GP`, `VC`, `VCD`)

Primeiros 10 segundos do garçom: "Link do garçom" / "Validar código · {restaurante}" / subtítulo / "Código do cliente" / "Consultar".

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| Sobretítulo "Link do garçom" | `GP:18` | Nome interno do recurso | Remover, ou "{restaurante}" |
| "Digite o código que o cliente mostra no app. O sistema reconhece se é 1ª visita, convite ou recompensa." | `GP:20` | "O sistema" (empresa como sujeito); "app" | "Digite o código que o cliente mostrar. A tela diz na hora se é 1ª visita, convite ou cartela completa." |
| Placeholder "Digite o código do cliente" | `VC:87` | Repete o rótulo | "Ex.: K7MP3Q" |
| "Consultar" | `VC:97` | CTA fraco | "Conferir código" |
| "Confirmar" | `VC:134` | CTA sem objeto; o garçom não sabe que é irreversível | "Confirmar e entregar" |
| "Código validado ✓ às {hh:mm}" | `VC:139` | Símbolo decorativo; não diz o que fazer | "Confirmado às {hh:mm}. Pode entregar: {title}." |
| "Este código já foi usado às {hh:mm}." | `VC:142` | Bom | Manter |
| "Código não encontrado. Confira as letras e números com o cliente." | `VC:9` | Bom. Sugiro acrescentar "Peça o código do benefício, não o do e-mail." (por causa do problema 3 da seção 0) | Manter + acréscimo |
| "Este código venceu: ele vale só no dia em que foi gerado." | `VC:10` | Dois-pontos; "gerado" é técnico | "Este código é de outro dia. Cada código vale só no dia do check-in." |
| Linha "Condições": "1ª visita · vale hoje" / "Convite · válido {Ter, Qua · 15h–18h} · até {dd/mm} · liberado hoje pelas ferramentas do avaliador" | `VCD:45-50` | Repete o selo; expõe jargão do avaliador | "Vale hoje" / "Convite de {dias} {horas}, até {dd/mm}" |
| Falha de rede sem mensagem | `VC:27` (o `fetch` não tem `catch`; o botão fica carregando) | Estado de erro ausente | "Sem conexão. Confira a internet e tente de novo." |
| "Este link do garçom não vale mais. Peça um novo ao responsável." | `GP:26`, `VC:29` | Bom | Manter |
| Cliente do grupo de controle pergunta "cadê meu convite?" | — | Falta um roteiro para o garçom | [FALTA: resposta-padrão aprovada que não revele o sorteio] |

O garçom não vê `OUTRO_RESTAURANTE` em lugar nenhum (`app/api/garcom/codigos/[acao]/route.ts:36,41`), então "Troque de loja" não aparece para ele.

---

### I. Kit impresso

**Display de mesa e cartaz** (`KP:10-47`; textos em `TPL:43-45` e `SEED:77-85`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| A: "Faça check-in e ganhe {beneficio}" | `TPL:43` | Afirmação sem prova: vale só na 1ª visita | "Na 1ª visita, ganhe {beneficio}" |
| B: "Ganhe {beneficio} no seu check-in" | `TPL:44` | Mesmo problema | "{beneficio} no seu 1º check-in" |
| Cantina: "Fez check-in, ganhou sobremesa" / "Ganhe um doce no seu check-in" / "Faça check-in e ganhe um doce" | `SEED:77-78,84` | Mesmo problema; a primeira é esperteza encenada | "Sobremesa por conta da casa no 1º check-in" (`SEED:85`, já correta) |
| "Leia o QR, faça check-in no app e mostre o código ao garçom." | `TPL:43` | "app" sugere baixar algo; "check-in" aparece de 3 a 4 vezes na mesma peça | "Aponte a câmera, entre com seu e-mail e mostre o código ao garçom." [FALTA: confirmar se no produto real o check-in roda no navegador ou exige o app do iFood] |
| "Junte selos a cada visita e ganhe {recompensa}." | `TPL:44` | Não diz quantos selos | "Cada visita vale 1 selo. Com 6, {recompensa}." |
| Ação: "Aponte a câmera para o QR" / "Leia o QR e faça check-in" | `TPL:43-44` | Bons | Manter |
| Linha fixa `INVITE_LINE` | `KP:36` | Ver problema 2 da seção 0 | Retirar, ou usar a forma neutra proposta em A |
| Rodapé "Comer Fora · versão {A} · Protótipo…" | `KP:42` | Expõe o teste A/B ao cliente | Só uma letra discreta ("A") ou nada |
| Recado modelo "Obrigado por estar aqui. Boa refeição!" / recado da Cantina "Massa fresca feita todo dia. Boa visita!" | `TPL:45`, `SEED:41` | Ponto de exclamação | "Obrigado por estar aqui. Boa refeição." / "Massa fresca feita todo dia." |
| Prompt da IA do kit | `src/modules/ia/tasks/kit.ts:19-30` | Não proíbe exclamação, travessão nem as muletas da lista; não exige "1ª visita" | Acrescentar essas regras (o guard em `src/modules/ia/guardrails/index.ts` também não verifica isso) |

**Porta-conta** (`KP:73-106`; `TPL:16-20`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Antes de pagar, faça check-in" | `TPL:17` | Bom, mas o benefício precisa ser servido | Manter. [FALTA: dá para usar a 1ª visita depois de pedir a conta?] |
| "Na 1ª visita: {beneficio}. A cada visita, um selo: na 6ª, {recompensa}." | `TPL:18` | "6ª" lido como sexta-feira; dois dois-pontos encadeados; fragmento | "Na 1ª visita você ganha {beneficio}. Cada visita vale 1 selo, e com 6 selos você ganha {recompensa}." (90 caracteres no limite; [FALTA: medir com o benefício já renderizado]) |

**Cartão do garçom** (`KP:50-67`; `TPL:34-39`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Hoje, quem faz check-in ganha {beneficio}. Peça o código ao cliente e valide no Portal." | `TPL:34` | "Hoje" e "quem faz check-in" prometem demais (a regra é a 1ª visita); "Portal" é jargão | "Na 1ª visita, quem faz check-in pelo QR da mesa ganha {beneficio}. Peça o código ao cliente e digite no link do garçom." |
| Rodapé "Validar: Portal do Parceiro › Comer Fora no salão › Validar código" | `KP:63` | Contradiz a frase quando o link do garçom está ligado (`TPL:38` troca só a frase); "salão" minúsculo | Rodapé condicional: "Validar: abra o link do garçom no celular" |
| "Roteiro do garçom" | `KP:57` | Promete uma fala, mas a frase é instrução | Incluir a fala: "Diga: 'Faz o check-in pelo QR, na 1ª visita a {beneficio} é por nossa conta.'" (limite de 2 frases: pode substituir a primeira) |

**QR impresso do link do garçom.** "Link do garçom · aponte a câmera para validar códigos" (`src/ui/portal/WaiterLinkCard.tsx:62`) está bom.

---

### J. E-mails

**1. Código de acesso do cliente** (`CL:39-58`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| Assunto "Seu código: {123456} · {restaurante}" | `CL:42` | Bom (o código no assunto ajuda); só diferenciar do código do garçom | "Seu código de acesso: {123456}" |
| "Seu código para entrar no Comer Fora no Salão e fazer check-in em {restaurante} é: {code}" | `CL:41,44` | Marca "Comer Fora no Salão" (o cliente só vê "Comer Fora"); "em Cantina…" depende do gênero do nome | "Use este código para entrar e fazer check-in no restaurante {nome}: {code}" |
| "Ele vale por 10 minutos e só pode ser usado uma vez. Se não foi você que pediu, ignore este e-mail." | `CL:46` | Bom | Manter. Acrescentar "Não mostre este código ao garçom." |

**2. Convite** (`DM:40-68`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| Assunto v1 "Seu convite: {gain} · {restaurante}" | `DM:43` | Aceitável (dois-pontos como rótulo) | — |
| Assunto v2 "{restaurante} guardou {Cannoli grátis} para você" | `DM:43` | "guardou Cannoli grátis" soa truncado; não diz quando | "{gain} na {restaurante}, {dias} das {horas}" ou "Seu convite da {restaurante}: {gain}" |
| Linha 1 v1 "{restaurante} te convida para voltar {quando}: {gain}." | `DM:44` | Revelação por dois-pontos | "A {restaurante} te convida para voltar {quando} e ganhar {gain}." |
| Linha 1 v2 "Volte {quando} e ganhe {gain}." + recado "Volte {quando} e ganhe {oferta}: o doce da casa…" | `DM:44,50` + `SEED:69` | Frase duplicada; revelação por dois-pontos | Não repetir o recado quando ele começa igual à linha 1 (ou reescrever o recado da Cantina como em E) |
| Sem contexto de por que recebeu | — | Falta confiança e valor | "Você fez check-in na {restaurante} em {dd/mm}." (o dado existe: `issuedDay`) |
| "…faça check-in no app e mostre ao garçom o código do benefício." | `DM:52` | "app" | "Ao chegar, faça check-in pelo link abaixo e mostre o código ao garçom." [FALTA: link direto para `/r/{slug}`] |
| "Ver o convite" | `DM:54` | CTA aceitável | "Ver meu convite" |
| "Preferências de e-mail · Descadastrar" + rodapé de protótipo | `DM:56-57` | Bom | Manter |

**3. Lembrete** (`DM:71-93`)

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| Assunto "{restaurante} · hoje vale seu convite" | `DM:73` | Bom | Ou "Hoje, das {15h} às {18h}: {gain} na {restaurante}" |
| "{restaurante} · hoje vale seu convite: {gain}, das 15h às 18h. Faça check-in no salão para receber o código." | `DM:74` | Repete o assunto; dois-pontos; "no salão" é jargão do produto | "Seu {gain} vale hoje, das {15h} às {18h}, na {restaurante}. Ao chegar, faça check-in e mostre o código ao garçom." [FALTA: endereço] |

**4. Arquivo de agenda (.ics) e erro do link** (`src/modules/salao/domain/ics.ts:48-50`; `app/api/convite/agenda/route.ts:17`)
- O `.ics` está bom. Sugiro só trocar "no app" por "pelo link".
- "Convite não encontrado." é um texto puro sem saída. Proposta: "Este convite já foi usado ou venceu. Veja seus convites em {url}/app/jornada."

---

### K. Componentes compartilhados

| Texto atual | Local | Problema | Reescrita |
|---|---|---|---|
| "Protótipo de case · não é produto oficial do iFood" | `src/ui/components/PrototypeBar.tsx:6`; `src/shared/prototype.ts:2` | Bom. Mas o link "Como funciona" (`PrototypeBar.tsx:53`) expõe o grupo de controle nas telas do cliente | Nas rotas `/r`, `/app` e `/cliente`, apontar para uma página "Sobre este protótipo" que não fale do sorteio |
| "Página não encontrada" / "O endereço pode estar errado ou a página ainda não existe neste protótipo." / "Voltar ao início" | `app/not-found.tsx:8-14` | QR de restaurante desativado cai aqui e "início" é a página do dono | Para `/r/*`: "Este restaurante não está mais no Comer Fora." + "Ver Sua jornada" [FALTA: 404 próprio da rota] |

---

## 2. Consistência de termos entre as superfícies

| Conceito | Variantes encontradas | Proposta única |
|---|---|---|
| Benefício de agora | "Doce grátis · Panna cotta" (`CR:51`, `LS:176`), "Doce grátis: Panna cotta" (`RV:217`), "Pra novos clientes" (`OF:92`), "Panna cotta grátis" (garçom `VCD:44`, kit `{beneficio}`), "benefício de 1ª visita", "ativar o benefício", "seus benefícios" (plural) | "{gain} na 1ª visita" ("Panna cotta grátis na 1ª visita"); verbo "ganhar", nunca "ativar" |
| Código | Acesso por e-mail (6 números) vs. do garçom (6 letras e números), ambos "código" | "código de acesso" (e-mail) vs. "código do benefício" (garçom) |
| O que o cliente faz com o código | "Informe" (`TX:9`), "Diga" (`RV:223`), "mostre" (`DM:52`, `TPL:43`, `ics.ts:50`), "Peça o código ao cliente" (garçom) | "Mostre o código ao garçom" |
| Convite | "convite para voltar", "Convites de volta no app", "Comunicações de promoções", "convite da sua visita", "te convidou para voltar", "Convite ativo", "Seu convite" | "convite" (da visita) e "convite para outras datas" (reativação); nunca "promoções" |
| Validade | "Vale só hoje", "vale hoje", "Válido até", "Vale até" | "Vale só hoje" / "Vale até {dd/mm}" |
| Onde o cliente está | "no app", "aqui no app", "no salão", "na página" | "pelo QR" / "nesta página". [FALTA: definir se existe app] |
| Jornada | "Sua jornada" (`DP:38`, título da página), "minha jornada" (`CR:64`), "Jornada" | "Sua jornada" em todos os pontos |
| Marca | "Comer Fora" (telas), "Comer Fora no Salão" (e-mails `CL:41-42`), "Comer Fora no salão" (`KP:63`) | "Comer Fora" para o cliente; "Comer Fora no Salão" só para o dono |
| Aviso de protótipo | "Protótipo de case · não é produto oficial do iFood" vs "Protótipo de case, não é o iFood." (`TX:12`) | A primeira forma |
| Registro de "para" | "pra" (`RV:57,78`, `OF:92`, `RS:13`) vs "para" no resto | Escolher um. Sugiro "para" no corpo do texto |
| Check-in / visita | Coerente: "check-in" é a ação, "visita" é a contagem | Manter |
| Cartela / selo / recompensa | "Recompensas", "Recompensa da cartela", "Próxima recompensa", "Junte Selos e Ganhe" | "cartela", "selo", e a recompensa sempre pelo nome ("Tiramisù grátis") |

Nenhuma ocorrência de "cupom" ou "voucher" no código.

---

## 3. Vazamento de conceitos internos e risco para o grupo de controle

- **Expõem o sorteio ou o grupo de controle a partir de telas do cliente:**
  - `RV:121-123` → `/` (`app/page.tsx:26` ou `OwnerLanding.tsx:12,17,37`)
  - `app/not-found.tsx:11` → `/`
  - `RV:109` → `/bastidores/como-funciona`
  - `PrototypeBar.tsx:53` → `/bastidores/como-funciona`
- **Falam de convite antes do check-in** (os dois grupos veem igual, então o sorteio não quebra, mas o texto contradiz `RV:205` e a espec. 3.5):
  - `TX:6` em `RV:92`
  - `TPL:31` em `KP:36` e `KP:96`
  - `LS:183` (dica "você não recebe convites para voltar")
- **Jargão interno visível:**
  - "ferramentas do avaliador" (`IC:23`, `VCD:48`, `JV:76`)
  - "versão A/B" no impresso (`KP:42`)
  - "Portal" no cartão do garçom (`TPL:34`, `KP:63`)
  - "salão" no e-mail (`DM:74`)
  - "assistente de IA" no consentimento (`TX:15`): é transparência necessária, então fica, mas com texto mais curto
- **Ponto positivo:** as telas de resultado, a Jornada e os e-mails nunca mencionam "faixa", "teto", "sorteio" ou "holdout". O grupo de controle recebe exatamente a mesma tela de quem não tem convite (`src/modules/salao/application/views.ts:2-3`).

---

## 4. Linhas que já funcionam e devem ficar

- "Faça check-in" · "Receba o código" (`RV:223`)
- "{n} check-ins nos últimos 7 dias" (`RV:232`)
- "Benefícios e recompensas valem depois que o garçom confirma o código" (`RS:15`)
- "Vale só hoje" (`TX:10`)
- "Seu convite vale hoje" / "Seu convite continua valendo" (`IC:6`)
- "Adicionar à agenda" (`IC:31`)
- "Não chegou? Veja a caixa de spam." (`LS:213`)
- "O código venceu. Peça outro." (`LS:131`)
- "Aceitar e fazer check-in" (`LS:267`)
- "Você já fez check-in hoje" / "Volte outro dia para ganhar mais um selo." (`CR:16`)
- "Já fez check-in em algum restaurante? Entre para ver seus convites e seus dados." (`JV:71`)
- "Os restaurantes em que você aceitou participar veem seu nome, telefone e e-mail." (`MD:70`)
- "Parar todos os e-mails deste restaurante" (`UN:30`)
- "Para ligar de novo, entre em Sua jornada" (`NP:27`)
- "Código não encontrado. Confira as letras e números com o cliente." (`VC:9`)
- "Este código já foi usado às {hh:mm}." (`VC:142`)
- "Este link do garçom não vale mais. Peça um novo ao responsável." (`GP:26`)
- "Antes de pagar, faça check-in" (`TPL:17`)
- "Sobremesa por conta da casa no 1º check-in" (`SEED:85`)
- Assunto "Seu código: {123456}" e o parágrafo de validade e segurança do e-mail de código (`CL:46`)