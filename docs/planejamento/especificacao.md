# Especificação — "Comer Fora no Salão"

Status: ✅ **v3 — replanejamento "produto real e valor ao dono" em 21/11/2026** (D151–D169, fatias S4–S6; detalhes em [../fatias/S4/planejamento.md](../fatias/S4/planejamento.md)). Antes: **v2 — replanejamento de produto em 20/11/2026** (diferenciação; decisões D201–D224), revisada por um builder check e 2 revisões independentes (técnica e produto). A v1 foi fechada em 19/11, depois de brainstorming e 5 rodadas de revisão independente (ver [revisoes.md](revisoes.md)); os ajustes técnicos da S0 são D77–D100. Este documento é a **fonte única** para a construção. A parte [00](00-contexto-problema-recorte.md) guarda o contexto, o recorte e as alternativas descartadas.

Legenda: **[B]** briefing · **[P]** pesquisa pública · **[O]** observado nos prints do app/Portal · **[H]** hipótese declarada · **[C]** decisão do assistente de IA, aberta a correção.

> **O que mudou na v2:** o momento de valor do dono passou a ser **encher o horário vazio**. Agora o cliente ganha **algo na hora e um convite de volta** para o horário vazio. P7 virou o **plano da semana**, com análise de dados pelo código e IA que escolhe e explica. A métrica principal passou a ser **visitas e margem incrementais contra o holdout**, com intervalo. A ativação agora **propõe um pacote** (sistema propõe, dono aprova). Mudanças de escopo: **Avaliar** saiu, **Clientes** virou segmentos acionáveis e o **MCP** voltou, por último na fila.

> **O que mudou na v3 (21/11) — prevalece sobre o texto abaixo onde conflitar:**
> - **Produto real (D152, D156):** saem das telas "teste", "simulado", "demonstração", "Simular 30 dias", "Antecipar 1 dia", "Importar do delivery" e o motivo do grupo de controle ao cliente (3.1, 3.2, 3.6, 3.8 ficam só para o seed e os Bastidores). A Cantina leva o selo "Restaurante de exemplo · histórico gerado" (D162). Restaurante criado = real, com "Primeiros passos". "Avançar 1 dia" e o roteiro vão para Bastidores › Ferramentas do avaliador (D153).
> - **Barra (D164):** "Protótipo de case · não é produto oficial do iFood"; só o link "Como funciona". Impresso e e-mail levam 1 linha de rodapé igual.
> - **Cliente (3.5, 4.2, 4.6 — D154, D161, D165, D171, D173):** entra pelo e-mail real + código de 6 dígitos; quem é novo informa nome, telefone (opcional) e os interruptores "E-mail" e "Notificação no app" (ligados); linha "Protótipo de case, não é o iFood. Você pode apagar seus dados quando quiser."; "Sair" e "Apagar meus dados"; sem apagamento automático; e-mail como identidade (HMAC `cliente-email:`) e criptografado (AES-256-GCM, chave por HKDF do `SESSION_SECRET`); telefone deixa de ser único. O pré-preenchimento fictício sai. O dono vê o grupo de controle em "Últimos check-ins de hoje" (D172). A Cantina pública é um restaurante normal; o dono logado vai à própria cópia (D176). E-mails aos clientes: só com consentimento, descadastro em todos, texto do dono com link ou contato não vai por e-mail (D174), remetente `msg.automato.pro` (D175).
> - **Reativação e e-mails (3.7, D155, D163, D168):** a reativação é entregue no app (Jornada › Seus convites) e por e-mail a quem consentiu; convite por e-mail ao nascer; resumo semanal do dono com "Revisar e aprovar" (POST, `via: email`) toda segunda 08:30 e lembrete no dia do convite.
> - **Valor e conversão (S5):** topo da Visão geral em R$ ("R$ X a mais em margem entre N convidados até agora", 4 estados), meta por faixa, feed "Hoje no salão"; landing e página do QR reescritas com a skill de copywriting; convite com "Adicionar à agenda" (.ics); "Por que esta oferta?" no plano e no pacote.
> - **S5 detalhada (21/11, D179–D185 — [../fatias/S5/planejamento.md](../fatias/S5/planejamento.md)):**
>   - **Topo em R$ (3.6):** 2 camadas, causal + antecipada "convites usados · consumo · margem · custo", rotulada não causal.
>   - **Metas e feed:** "Metas desta semana" por faixa e "Hoje no salão".
>   - **Página do QR (3.5):** topo de conversão + abas do app.
>   - **Landing:** prova só com o 63% real (Diário do Rio, 12/11/2026) e FAQ.
>   - **Convite:** `.ics` no 1º dia em que o código pode nascer.
>   - **IA:** "Por que esta oferta?" em 2 camadas.
> - **IA que opera (S6):** plano como agente com ferramentas só de leitura (decidido por número — D159, D166), modo garçom por link, porta-conta no kit.
> - **S6 detalhada (21/11, D187–D200 — [../fatias/S6/planejamento.md](../fatias/S6/planejamento.md)):** agendador gera o plano e manda o resumo no dia/hora do dono, com "Revisar e aprovar" por link; lembrete 1 por convite, X h antes; link do garçom com QR; agente com cadeia de reserva e linha visível; porta-conta DL; **sistema configurável**: "Avisos e automação" e "IA do restaurante" (instruções opcionais e seguras, pratos fora das ofertas, cardápio manual) para o dono e "Gerenciar notificações" para o cliente.
> - **S8 — Copiloto do salão (21/11, D260–D271 — [../fatias/S8/planejamento.md](../fatias/S8/planejamento.md)):** reabre a D211. Painel "Assistente do salão" no Portal: o pedido do dono vira cartão "antes → depois" com impacto do código e só vale com o clique (D261); "IA nunca escreve número" também no chat (D264); modelo vê nome e atributos de clientes, nunca contato (D262); onboarding preenche "Seu salão" por frase (D265); catálogo único de ferramentas para copiloto e MCP, com MCP vendo clientes sem contato e editando por propor + aplicar (D267–D269); 60 s na demo, no bloco do plano (D263); tudo por flag, corte domingo 22h (D270). Roda antes da S7.
> - **Fatias e cronograma (seção 7):** S4 (produto real e identidade), S5 (valor e conversão), S6 (IA que opera), 1 merge no fim (D167) com meta antes de 23/11 08:30; corte por flag domingo 22h; S7 = entregáveis (slide, vídeo de telas reais — D157, repositório público, preparação), segunda 10h–15h.

---

## 1. Resumo

- **Desafio** (opção 2 do case): fazer o dono do restaurante **entrar** no Comer Fora, **divulgar no salão** e **ter mais retorno com isso**.
- **Para quem:**
  - Dono de restaurante parceiro iFood **com salão**, esteja ou não no Comer Fora.
  - Usuário secundário: o cliente sentado no salão.
  - Garçom: valida os códigos.
- **Diagnóstico:**
  - Só 20% dos restaurantes ativos divulgam o Comer Fora no salão [B].
  - O cliente que já está na mesa é **anônimo** para o restaurante.
  - No app, o Comer Fora fica a 2 toques da home [O].
  - O Comer Fora já tem [P][O]:
    - check-in que ativa o benefício;
    - cartela de selos;
    - benefícios de 1ª visita e cashback configurados em "trilhas de marketing" no Portal;
    - benefício restrito por dia e turno (print: "Ter, Qua · Noturno");
    - histórico do cliente e resultados de campanha;
    - o Toqan (chat de IA do Portal, voltado ao delivery).
  - O objetivo declarado do Comer Fora é **reduzir ociosidade** [P].
- **Tese** [H]: o **salão cheio** é a mídia mais barata e mais segmentada que o restaurante tem, e hoje não é usada. O produto liga as duas pontas: o cliente do horário cheio vira, ali na mesa, um **convite para o horário vazio**, e o resultado é **medido contra um grupo de controle**.
- **Promessa (uma linha) [C]:** **"Seu salão cheio divulga seu horário vazio."**
- **O que já existe e o que é novo** (o produto usa o que existe e declara isso; a novidade é a faixa da direita):

| Já existe no Comer Fora [P][O] | Novo neste produto |
|---|---|
| Benefício de 1ª visita, cartela, cashback, benefício por dia/turno | **Convite de volta nascido na mesa** para o horário vazio, com teto e custo controlados |
| Configurar trilha de marketing no Portal | **Ativação proposta**: foto do cardápio → pacote pronto (benefício + convite + 1º plano) → kit para imprimir |
| Check-in no app | **Peças físicas com QR por peça e versão** (atribuição, A/B) |
| Resultados de campanha, histórico do cliente | **Plano da semana**: insights calculados por código + IA que escolhe a oferta e explica + **"o que aprendemos"** |
| (não encontrado em fontes públicas) | **Incremento medido com holdout**, com intervalo honesto; validação registrada do código pelo garçom |
| Toqan (assistente de IA do Portal, voltado ao delivery) | **Copiloto do salão (S8):** pedidos viram **propostas conferidas pelo código** e aplicadas com 1 clique do dono, sobre o **mesmo catálogo de ferramentas** que o MCP expõe a agentes externos |

- **Por que os 80% não divulgam:** não sabemos. Declaramos hipóteses e o produto mede cada uma:

| Hipótese | Funcionalidade que testa | Como mede |
|---|---|---|
| H1 — falta material de divulgação | Kit gerado pela IA a partir do cardápio | % de restaurantes ativados com peça marcada "no salão" e com leituras |
| H2 — o dono não vê retorno | Convite + plano da semana + holdout | Visitas e margem incrementais contra o holdout |
| H3 — a equipe não engaja | Cartão do garçom + validação do código | Check-ins sem código validado, por turno |
| H4 — o custo do benefício assusta | Pacote proposto com teto, custo estimado e regras | Custo por cliente identificado; custo × margem; ajustes do dono no pacote |
| H5 — o dono desconfia de divulgar o iFood no próprio salão (dados do cliente, dependência) [H] | Painel deixa claro que a base é do restaurante; kit e recado com a marca do restaurante | Taxa de ativação e abandono por passo do assistente |

H5 se apoia em fontes indiretas: a Abrasel levou ao Cade questões sobre o iFood (Mercado&Consumo, 01/10/2025) e o iFood afirma que, no Comer Fora, "os dados ficam com o restaurante" (Central do Varejo). A ligação com "não divulgar no salão" é inferência nossa.

## 2. Métricas (árvore)

- **Para o iFood (topo):** **novos usuários do Comer Fora vindos do salão**, isto é, clientes cujo 1º check-in da vida veio de uma peça. Liga à meta de 2,5 → 5 mi de usuários ativos [B]. Em produção, o QR abriria o app por deep link/login iFood.
- **Para o iFood (adoção):** % de restaurantes divulgando (≥ 1 peça com leitura na semana). É o "20%" do briefing.
- **Principal do dono:** **visitas e margem incrementais**: grupo convidado × holdout, em todos os horários, por **intenção de tratar** (3.3).
  - **Medida:** "visitas registradas" = check-ins. O holdout pode voltar sem fazer check-in; a limitação é declarada em "Como funciona" e preparada para a entrevista.
  - **Janela W = 14 dias** após o sorteio (data do convite real ou fantasma). Só entram clientes com a janela **fechada**; a visita do sorteio não conta.
  - **Estimador (Welch, aproximação normal):** `diff = x̄_conv − x̄_hold` (visitas por cliente em W); `se = √(s²c/nc + s²h/nh)` (variância amostral com n−1); IC 95% = `diff ± 1,96·se`.
  - **4 estados:**
    - `amostra_insuficiente`: algum grupo com n < 30;
    - `inconclusivo`: o IC contém 0, ou se = 0 ("ainda não dá para afirmar");
    - `positivo`;
    - `negativo`.
  - **Margem incremental (estimativa)** = `diff · nc · ticket · margem% − Δcusto`, com `Δcusto = custo_conv − custo_hold · nc/nh`. O "agora", que os dois grupos recebem, se cancela. O IC da margem é a transformação linear do IC de `diff`. Sem ticket e margem declarados, o painel mostra só visitas.
  - **Indicadores antecipados**, sempre visíveis e rotulados "não causal": convites usados (% por coorte), visitas no horário vazio, custo por visita gerada.
- **Secundárias:**
  - visitas no **horário vazio**, convidado × holdout;
  - uso dos convites **por coorte de emissão** (semana ISO de emissão em SP → % usados; coortes com janela aberta aparecem como "em aberto");
  - conversão leitura → check-in por peça e versão;
  - check-in → código validado;
  - taxa de ativação e tempo até ativar.
- **Proteção:**
  - **migração** = visitas **fora dos horários vazios**, convidado × holdout, com o mesmo estimador. Se caírem, o convite está só trocando o cliente de horário;
  - **custo por cliente identificado** (o "algo agora" é o preço da identificação);
  - **custo × margem**.
  - Rótulos: "estimativa", "com base nos valores que você declarou".
- **Qualidade da IA:** % de saídas aceitas sem edição (pacote, plano, kit); bloqueios por regra e pelo revisor; uso do modelo reserva; custo e latência.
- Não exibir **taxa** de opt-in, porque o opt-in vem ligado por padrão. Contagens de clientes com opt-in por segmento podem aparecer.
- Ponto de partida público citado: "63% voltam em menos de 1 mês" [P, número do próprio iFood, método desconhecido].

---

## 3. Produto

### 3.1 Superfícies, navegação e princípios (P1)
- **Produto primeiro.** Entrada curta com a **barra de protótipo**, **1 botão principal** "Sou dono: abrir Portal (demo)" (cai no painel da vitrine com o banner "Crie o seu restaurante") e **1 secundário** "Sou cliente: ver restaurante".
- **Portal do Parceiro (dono):** clone do Portal, com item novo na sidebar **"Comer Fora no salão"** (selo "Novo").
  - **Login por e-mail real + código de 6 dígitos** enviado pelo AWS SES, em tela igual ao portal/01 (D118). O e-mail fica guardado só como HMAC + dica mascarada.
  - **Link privado do avaliador**, enviado com a entrega, que abre uma conta própria sem e-mail (D126).
  - **Cada conta ganha a própria cópia da vitrine**, com 60 dias de dados e editável (D119). "Criar meu restaurante" cria um restaurante de teste dentro da conta.
- **App do cliente:** clone da área Comer Fora do app. No computador, coluna central de ~420 px.
- **Modo apresentação** (escondido, para a demo): Portal (≥ 1100 px) e app numa moldura de celular (390 px), ligados ao vivo; zoom de 125%; aviso "Novo check-in · Display mesa A" e pulso no funil.
- **Bastidores** (fora do Portal do dono): Qualidade da IA · **Visão da plataforma** (pública e agregada: restaurantes ativados, % divulgando, novos usuários vindos do salão, abandono por passo, custo de IA por restaurante — D144) · Configurações do protótipo (senha: prompts globais, flags, resetar demo — D138, D139) · Como este protótipo funciona.
- **"Antecipar convite em 1 dia"** (só em restaurante de teste — D140, D141): fica no 2º card e na Jornada; recua 1 dia a visita e o convite para permitir a volta no mesmo dia e, se agora estiver fora da faixa, libera o convite fora do horário só naquele dia (rótulo "Só no teste"). No restaurante de teste, quando o 2º card não aparece, a tela diz o motivo (grupo de controle ou teto — D143).
- **Tom por restaurante** (D138): o dono ajusta o estilo dos textos da IA do próprio restaurante em Configurações; regras, números e guardrails não mudam.
- **Tudo responsivo:** Portal e app funcionam no celular e no computador. No celular, o Portal tem sidebar em gaveta e tabelas com rolagem lateral; edição e impressão do kit continuam disponíveis.
- **Barra de protótipo** única e fixa, com o texto "Protótipo de case · não é produto oficial do iFood · dados fictícios":
  - texto sempre completo;
  - a partir de 640 px, 1 linha com ≤ 28 px; abaixo disso, até 2 linhas e ≤ 44 px;
  - links "Trocar de lado" e "Como funciona" só quando os destinos existirem, com alvo mínimo de 24 px (D92);
  - `noindex` (meta e cabeçalho) desde o 1º deploy (D87).
- **Simulação declarada** em 3 níveis:
  - a barra;
  - selo "simulado" só nas ações com efeito externo falso (importar do delivery, envio de reativação, simular 30 dias);
  - ícone discreto nas linhas simuladas.
- **Página "Como este protótipo funciona":**
  - **O que é real:** IA ao vivo no restaurante de teste, GPS, check-ins, códigos, convites, banco, regras, insights, funil.
  - **O que é simulado:** dados de pessoas e restaurantes, importar do delivery, envio de WhatsApp/push, simular 30 dias, coordenada do restaurante, extrações em cache dos exemplos.
  - **Os parâmetros da simulação**, entre eles o efeito do convite (ver 3.8).
  - **As limitações da medida:** "visitas registradas" são check-ins; incremento por restaurante tem amostra pequena (4 estados); prova estatística fica para o piloto.
  - A tabela **"já existe × novo"** (seção 1).

### 3.2 Entrar — ativação proposta (P2)
Ordem pensada para a latência da IA. O passo 4 é o momento "uau" da demo.
1. **Cardápio do salão:**
   - entradas: foto/PDF, um dos 3 exemplos ou **"Importar do delivery" (simulado)**;
   - "Importar do delivery" tem o link "Por quê?", que explica: "não integramos com o iFood porque o case proíbe usar dados reais/internos; em produção, viria do cardápio de delivery do Portal";
   - texto curto: o cardápio do salão costuma ter itens e preços diferentes do delivery;
   - a IA começa a ler em segundo plano.
2. **Seu salão** (enquanto a IA lê):
   - nº de mesas;
   - clientes de salão por semana (estimativa);
   - **horário de funcionamento**;
   - **horários vazios** (obrigatório): faixas que o dono escolhe, com dias (D S T Q Q S S) + início/fim, dentro do horário de funcionamento; cada faixa ganha um id. Para cada faixa, "quanto está vazio" (**muito / um pouco**, define a prioridade) e **quantas mesas a mais quer por semana**;
   - **ticket médio por pessoa (R$)** e **margem aproximada (%)**, **opcionais**, com o rótulo "estimativa sua; usada só para calcular retorno". Sem eles, o painel mostra visitas, não margem.
3. **Revisão do cardápio:** tabela editável (categoria, item, preço); culinária e faixa de preço sugeridas; edições registradas.
4. **Pacote proposto** (sistema propõe, dono aprova):
   - **Benefício de 1ª visita** ("algo agora"): tipo e item do cardápio propostos pelo código, preferindo o menor custo por cliente identificado (ex.: doce ou cortesia). O texto vem das regras.
   - **Convite de volta** para cada horário vazio: o código monta **2–3 ofertas validadas** do cardápio; a **IA escolhe uma por horário**, casando item e turno, e escreve o texto do convite e a justificativa, citando fatos por referência.
   - **Teto semanal de convites** por horário, derivado das mesas desejadas (3.3).
   - **Custo máximo por semana** = teto × custo unitário do item, com custo do item = preço × (1 − margem). Sem margem declarada, usa o preço, rotulado "custo máximo".
   - O teto aparece em linguagem do dono: "até 8 convites/semana ≈ 2 mesas".
   - É o **1º plano da semana** (3.7). Como ainda não há eventos, a IA usa **fatos declarados**: intensidade, mesas desejadas, ticket, margem e categorias do cardápio.
   - O dono **aprova** ou **ajusta** cada item: troca entre as candidatas, muda o item ou o teto dentro das regras. Os ajustes ficam registrados.
5. **Resumo e ativar:** prévia de como o cliente vê o "agora" e o convite → "Ativar Comer Fora no salão" → "Gerar meu kit".
- Quem já está no Comer Fora pula o passo 1 (o "já existe" é usado como está).
- Assistente retomável pela metade. Abandono por passo registrado (H5).
- Estados:
  - "lendo seu cardápio…" com etapas ("23 itens encontrados");
  - "isso não parece um cardápio";
  - PDF com várias páginas (até 5);
  - leitura parcial;
  - falha → modelo reserva → "digitar ou usar exemplo";
  - limite atingido → oferecer exemplo/vitrine;
  - pacote sem IA → candidata de maior pontuação e texto modelo, com rótulo.

### 3.3 Benefício agora, convite de volta, cartela e códigos (P3)
- **Benefício de 1ª visita ("algo agora"):**
  - taxonomia real [O]: Leve 2, pague 1 · Desconto · Doce grátis · Entrada grátis · Ganhe cortesia;
  - **o item vem do cardápio extraído** (ex.: "Doce grátis" lista só sobremesas);
  - **vale em qualquer horário de funcionamento**, porque sem isso o QR no pico não oferece nada; a restrição de horário passa para o convite;
  - **divergência registrada:** o app real permite restringir o benefício por dia e turno [O].
- **Horário vazio (faixa):** dias + início/fim, com id estável, dentro do horário de funcionamento; a prioridade vem da intensidade declarada.
- **Convite de volta:**
  - **Oferta:** um item do cardápio, com os mesmos tipos da taxonomia.
  - **Congelado na emissão:** o convite guarda **a faixa** (a de maior prioridade com teto livre naquele momento) e a **validade** (até o fim do dia, em SP, 30 dias após a emissão). Mudar o plano depois **não** altera convites já emitidos.
  - **O código do convite nasce na volta:** só no check-in **de volta, dentro da faixa e num dia diferente** do da emissão. Vale **aquele dia**, uso único. Fora da faixa, o check-in mostra um lembrete do convite.
  - **No máximo 1 convite ativo** (real ou fantasma) por cliente por restaurante [C].
- **Sorteio do grupo (intenção de tratar + convite fantasma):**
  1. No check-in de um cliente identificado, o código verifica, **sem olhar o grupo**: há plano ativo, o cliente não tem convite ativo (real ou fantasma) e há teto livre numa faixa.
  2. Se passar, e o cliente ainda não tiver grupo, o sistema sorteia e **grava** o grupo uma única vez: **90% convidável, 10% holdout** (hash determinístico de cliente + restaurante).
  3. Convidável → **convite real**: aparece ao cliente e consome teto. Holdout → **convite fantasma**: invisível, com a mesma faixa e as mesmas datas, e **não consome teto**.
  4. A janela da métrica (W = 14 dias) começa na data do convite, real ou fantasma. O cliente do holdout fica no holdout; rotação só em produção (roadmap).
- **Teto:**
  - contado por faixa e por **semana ISO em SP** (segunda 00:00 a domingo 23:59);
  - reservado de forma atômica: dois check-ins simultâneos não estouram;
  - valor inicial = mesas a mais desejadas × 4 [C: supõe ~25% de uso];
  - recalibrado no plano seguinte por `teto = ceil(mesas / clamp(uso_observado, 0,1, 1))`, usando só coortes com ≥ 7 dias;
  - esgotou → o cliente recebe só o "agora" e o selo, e o painel avisa "teto atingido".
- **Reativação (plano da semana):** gera convites pela mesma regra (real para convidáveis, fantasma para o holdout), consome teto e pula quem já tem convite ativo. Usa **até 50% do teto livre** de cada faixa (D142); a cota é decidida antes do sorteio do grupo (sem vaga, pula nos dois grupos). Uma função pura única serve ao produto e ao simulador.
- **Cartela de selos sempre ativa** (igual ao app [O]): 6 selos, recompensa escolhida do cardápio, **1 check-in por dia**, validade de 90 dias após o 1º check-in, uso só no local.
- **Regras no código (com testes):**
  - desconto com teto de 50%;
  - consumo mínimo opcional, com alerta se passar de 2× o preço médio;
  - **1 benefício de 1ª visita por cliente por restaurante**;
  - convite com faixa e validade congeladas, teto por semana ISO e no máximo 1 ativo por cliente;
  - ofertas candidatas só com itens do cardápio, custo dentro do teto e tipo permitido;
  - benefício, convite e plano **versionados** (mudanças não quebram a atribuição);
  - benefício e convite como **tipo polimórfico**: cada tipo tem contrato próprio para validar, descrever e estimar custo.
- **Códigos (um sistema só):** código **único por cliente e item**, uso único, único por restaurante (nova tentativa em caso de colisão). São 3 tipos, e **todos valem o dia em que nascem**:
  - 1ª visita: nasce no 1º check-in; uma emissão por cliente, sem reemissão;
  - convite: nasce no check-in de volta, dentro da faixa;
  - recompensa da cartela: nasce no 6º selo.

  Na tela aparece "Informe este código ao garçom". O selo conta no check-in; **benefício, convite e recompensa só valem depois da validação**.
- **Validar código** (uma tela do Portal, pensada para o celular ou tablet do salão):
  - o garçom digita o código;
  - o sistema **reconhece o tipo** e mostra o cliente (fictício), o item e as condições (ex.: "Convite · válido Ter, Qua · 15h–18h · até 20/12");
  - botão "Confirmar".
  - Estados: código inválido, expirado, já usado, de outro restaurante. Como o código do convite só nasce dentro da faixa, "fora do horário" acontece na emissão do código, não na validação.
  - [Roadmap] "modo salão": link ou PIN que abre só esta tela, sem expor o resto do Portal no tablet do salão.

### 3.4 Kit de divulgação (P4)
- **Peças:**
  - Display de mesa (meia A4) e cartaz (A4): **um único modelo visual em 2 tamanhos**, com QR.
  - Cartão do garçom (1/4 de A4, sem QR): roteiro **≤ 2 frases** só sobre o **"agora"**, mais "peça o código ao cliente e valide no Portal". Não menciona o convite, para não contaminar o holdout. O texto vem de modelo com campos preenchidos pelo código [C].
  - **"Recado do restaurante":** aparece no card do benefício no app, como no real [O].
- **A/B:** display e cartaz em **2 versões cada**, cada versão com QR próprio.
  - Decide **só pela conversão leitura→check-in entre versões da mesma peça**.
  - No painel: "Sem vencedora ainda · faltam ~N leituras" até a amostra mínima (≈ 355 por versão para detectar 30%→40%, α 5%, poder 80%).
  - "Promover vencedora" só com amostra suficiente.
  - Visão de futuro: aprendizado agregado da plataforma por culinária.
- **Geração:**
  - a IA escreve só as **chamadas** (título, subtítulo, frase de ação), citando pratos por referência;
  - o "agora" entra por referência (`{beneficio}`), com texto escrito pelo código; o convite aparece só como chamada genérica ("e você pode ganhar um convite para voltar"), sem oferta específica;
  - visual fixo, só com o logo padrão do iFood (D81) e a marca do restaurante em destaque (H5), sem fotos.
- **Revisão e aprovação:**
  - regras fixas: se falhar, gera de novo;
  - revisor assíncrono, com selo "revisando…" / "✓ Revisado" / "⚠ Atenção"; problema grave bloqueia aprovação e impressão;
  - o dono edita, regenera um campo ou aprova (edições registradas).
- **Impressão:** página de impressão por peça no tamanho certo + "Salvar como PDF" pelo navegador; prévia; QR com ≥ 3 cm.
- **QR:** `/r/<slug>?p=<token>`. A peça passa a "no salão" quando o dono marca. O QR de uma versão que perdeu continua funcionando.
- **Leituras:** registradas por **beacon no navegador** (não pelo GET), ignorando prefetch e robôs de prévia de link; mesmo aparelho em 30 min conta como 1.

### 3.5 Fluxo do cliente (P5)
1. **QR → página do restaurante** (clone [O]):
   - foto de banco livre, nome, culinária, faixa de preço;
   - **aberto/fechado só informativo**;
   - distância só com GPS permitido;
   - abas **Benefícios | Sobre**;
   - rodapé **[Check-in]** em largura total [C: o app tem [Avaliar] ao lado; Avaliar está fora deste protótipo, divergência registrada].
   - Na aba Benefícios: card ticket do "agora" (com o Recado) + cartela + a linha "**Faça check-in e você pode ganhar um convite para voltar**". Nenhuma oferta nem horário aparece antes do check-in, para não contaminar o holdout.
   - Na aba Sobre: descrição gerada do cardápio + endereço fictício.
2. **Toque em Check-in:**
   - tela da cartela com "Fazer check-in" e "Ver detalhes e regras";
   - **GPS pedido no toque**, com distância calculada **no navegador**;
   - se longe, negado, sem suporte ou tempo esgotado (~8 s) → sheet igual ao app: "Parece que você não está no restaurante!… [Fechar] [Confirmar localização]". Não bloqueia.
   - Só o status vai ao servidor (perto · longe · negado · confirmado manualmente).
3. **Identificação** (só na 1ª visita no aparelho):
   - nome e telefone **pré-preenchidos com dados fictícios**, com "gerar outros" e o aviso "use só dados fictícios";
   - `autocomplete="off"`;
   - opções WhatsApp · Notificação no app · Push **ligadas por padrão** (igual ao app);
   - aceite obrigatório.
4. **Regras no servidor → resultados:**
   - **1ª visita:** "agora" ativado + **código** + selo 1/6. Em seguida aparece um **2º card**: "Seu convite: volte Ter, Qua · 15h–18h e ganhe {item} · até dd/mm", se o cliente for elegível.
   - **Volta dentro da faixa do convite, em outro dia,** com convite ativo: selo n/6 + **código do convite** (vale hoje).
   - **Volta fora da faixa:** selo n/6 + lembrete do convite ativo ("vale Ter, Qua · 15h–18h · até dd/mm").
   - Já fez check-in hoje.
   - Benefício de 1ª visita já usado.
   - 6/6: recompensa com código.
   - **Holdout (convite fantasma) ou teto esgotado:** igual à 1ª visita, sem o 2º card e sem menção a convite.
5. **Jornada:** "Seus restaurantes" com visitas, selos e **convites ativos** (só a aba Visitas funcional; Reservas e Avaliações estáticas).
- O cliente é reconhecido pelo hash do telefone + cookie do aparelho; os cookies de dono e de cliente são separados.

### 3.6 Painel do dono (P6)
Abas: **Visão geral · Plano da semana · Kit · Clientes · Configurações**, mais a tela **Validar código** [C: 5 abas; o plano é o diferencial e ganha aba própria].
- **Visão geral** (atualiza a cada ~3 s), em hierarquia:
  1. **Métrica principal:** visitas e margem incrementais, com intervalo ou "amostra insuficiente"; ao lado, **novos usuários do Comer Fora** e o atalho "Validar código".
  2. **Plano da semana:** estado (proposto, aprovado ou vencido) e botão "Revisar plano".
  3. **Funil** em barras vermelhas (padrão "Conversão do cardápio" do Portal [O]): Leituras do QR → Check-ins → Deixaram contato → Convites emitidos → Voltaram com convite → Códigos de convite validados. Ao lado, "códigos de 1ª visita validados" (H3).
     - Convites do funil = só os emitidos na mesa; os da reativação aparecem à parte. Percentual só entre etapas em que uma é subconjunto da anterior. "Voltaram com convite" = código de convite emitido; "Códigos de convite validados" = desses, os validados (D145).
     - Períodos Hoje/7/30 dias **só no funil**.
     - Filtro por peça/versão.
  4. **Cartões**, em 2 grupos: "comparado ao grupo de controle" (visitas no horário vazio e proteção contra migração, com intervalo e os 4 estados) e "indicadores antecipados · não causal" (convites usados por coorte, custo por convite emitido, custo por cliente identificado, custo × margem).
  5. Tabela por peça/versão com o status do A/B (recolhida).
- **Restaurante de teste vazio:** passo a passo "imprimir → abrir como cliente → simular" + botões **"Simular 30 dias"** e "Limpar simulação".
- **Kit:** peças, versões, status "no salão", selos do revisor.
- **Clientes** (segmentos acionáveis, não lista de CRM):
  - **1 visita e sumiu** (alvo da reativação), **perto da recompensa**, **com convite ativo** e **frequentes** (só informativo: **não** são alvo de deslocamento, para não fabricar migração);
  - contagem por segmento e lista curta com nome fictício, telefone mascarado, peça de origem e opt-in;
  - aviso "esta base é do seu restaurante" (H5).
- **Configurações:** benefício agora, faixas vazias, regra do convite (ofertas, teto), cartela, ticket e margem declarados (opcionais), token do MCP.
- Textos:
  - "Leituras do QR", "Deixaram contato", "Sem vencedora ainda · faltam ~N leituras";
  - "Amostra insuficiente · ainda não dá para afirmar";
  - "Voltaram com convite", com a dica "visita com código de convite validado".

### 3.7 Plano da semana — análise de dados + IA (P7)
O diferencial do produto. A divisão é fixa: **o código decide tudo que é número e dinheiro; a IA escolhe entre opções válidas e convence**.
1. **O código calcula os insights** (fatos com chaves estáveis, dos últimos 30 dias):
   1. **Check-ins por turno × movimento declarado:** mapa dia × turno; aponta turnos com poucos check-ins que o dono não marcou como vazios. Nunca chamar de "ocupação": check-in mede só quem leu o QR.
   2. **Resposta aos convites:** por horário e oferta — emitidos, usados (por coorte), custo por visita gerada, incremento contra o holdout com intervalo.
   3. **Clientes acionáveis:** tamanho e opt-in dos segmentos (3.6).
   4. **Operação do salão** (flag): conversão por peça/versão (A/B); turnos com check-ins sem código validado (H3). Entra como alerta.
   5. **Veredito por oferta (código):** para cada oferta da semana anterior, `manter | trocar | cedo_demais`, decidido por indicadores antecipados (% de convites usados em 7 dias por coorte, custo por visita gerada), com limiares fixos no código [C]. **Não** é causal. O incremento contra o holdout só aparece no total do restaurante (seção 2).
2. **O código gera as candidatas** para cada horário vazio:
   - **2–3 ofertas validadas** (item do cardápio de categoria compatível, custo dentro do teto, tipo permitido), cada uma com pontuação;
   - teto da semana (recalibrado pelo uso real) e custo máximo;
   - público da reativação: "1 visita e sumiu" e "perto da recompensa", com opt-in. O holdout recebe convite fantasma, pela regra de 3.3.
3. **A IA**, para cada horário:
   - escolhe 1 oferta entre as candidatas, casando item e turno (ex.: sobremesa à tarde, porção no happy hour);
   - escreve o texto do convite na voz do restaurante e a **justificativa** para o dono, citando fatos **por referência** (`{fato:…}`, `{prato:…}`, `{horario:…}`, `{oferta}`);
   - prioriza os horários;
   - escreve **"O que aprendemos"**: **explica o veredito do código** de cada oferta da semana anterior, em linguagem do dono, citando os indicadores por referência. Não muda o veredito.

   A IA nunca cria oferta fora das candidatas, nunca muda veredito e nunca escreve número.

   **Contrato da tarefa 3** (schema montado por chamada):
   - `escolhas[]`, cada uma com:
     - `slotId` ∈ faixas;
     - `candidataId` ∈ candidatas daquela faixa (conferido no guard);
     - `textoConvite`: ≤ 160 caracteres, só `{prato:id}`, `{horario:slotId}`, `{oferta}`;
     - `justificativa`: ≤ 400 caracteres, com `{fato:chave}`.
   - `ordem`: permutação das faixas.
   - `aprendemos[]`, com `ofertaKey` e texto (≤ 300 caracteres).
4. **Dono:** aprova, ajusta (troca de candidata, teto dentro das regras) ou descarta com motivo. Ajustes ficam registrados (qualidade da IA; H4).
5. **Ao aprovar:**
   - a regra do convite na mesa ganha nova versão;
   - a **reativação** é registrada como envio pelo CRM do Comer Fora (**simulado**): convites reais para os convidáveis com opt-in e fantasmas para o holdout;
   - prévia estilo WhatsApp "enviado para N clientes (simulado)";
   - histórico de planos.
6. **Modo sem IA:** em cada horário, a candidata de maior pontuação com texto modelo, rotulado.
7. **Quando gera:**
   - na ativação, o 1º plano (com fatos declarados);
   - depois, no botão "Gerar plano da semana", com estado `gerando` por restaurante (clique duplo não gera 2 chamadas);
   - o resultado fica guardado;
   - idempotência em Ativar, Aprovar plano e Confirmar código;
   - a aprovação também pode vir **por agente (MCP)**, com o token do dono (4.3), e fica registrada como "aprovado via agente".
8. **Alertas** (insight 4 e regras): "teto atingido", "peça B converte 2× menos", "sábado à noite: 30% dos códigos sem validação".

### 3.8 Simulação
- **Mesmas regras do produto:** o simulador chama as **mesmas funções puras** do domínio (`decideCheckin`, sorteio do grupo, teto, códigos) com relógio falso, em ordem cronológica, em memória, e grava em lote com `simulation_run_id`. Nada de agregados montados à mão.
- **Modelo por agente:**
  - os clientes chegam por perfil de turno, concentrados no pico;
  - cada cliente tem uma taxa de volta;
  - quem tem convite ativo tem a taxa **na faixa vazia** multiplicada pelo efeito e perde uma fração disso no pico (migração);
  - os códigos são validados com probabilidade p.
- **Efeito como parâmetro declarado** (mostrado em "Como funciona"): **+0,20 visita por cliente em 14 dias** para convidados × holdout, com **25% do extra vindo de migração** [C]. O painel "mede" o que foi programado, e isso é dito.
- **Vitrine:** **60 dias** de histórico, com ~200 clientes novos identificados por semana (D104), dimensionada para o incremento total sair **positivo, com IC acima de zero**. Inclui 2 planos semanais (anterior e atual), para que "o que aprendemos" tenha conteúdo. Um teste garante que, com a semente da vitrine, o IC 95% fica acima de zero e contém o efeito programado.
- **"Simular 30 dias"** no restaurante de teste pode mostrar `amostra_insuficiente` ou `inconclusivo`. Isso está assumido no roteiro: é o comportamento honesto com pouco tempo de dados.
- **Coortes:** convites emitidos perto do fim aparecem como "em aberto".
- **Gerador único**, usado pelo seed da vitrine e pelo botão. "Limpar" remove exatamente aquela rodada.
- O A/B tende a "sem vencedora ainda" — assumido.

---

## 4. Técnica

### 4.1 Arquitetura (T1) — monólito modular por domínio
- **Next.js (App Router, TypeScript)**, um deploy. Módulos:
  - `onboarding` (inclui o pacote proposto);
  - `beneficios` (agora, convite, cartela, códigos);
  - `kit`;
  - `salao` (leituras, check-in, clientes, validação);
  - `analytics` (insights, incremento, funil);
  - `planos` (candidatas, plano da semana, reativação);
  - `ia` (plataforma);
  - `config`;
  - `mcp` (adaptador).
- **Regra de dependência:** telas/rotas → casos de uso → domínio. O domínio não conhece Next, banco nem IA. Fronteiras verificadas por lint no CI.
- **Portas e adaptadores só nos 5 pontos de variação real:**
  - IA (OpenRouter);
  - fonte do cardápio (foto/PDF · exemplo · importar-simulado);
  - canal de reativação (simulado);
  - relógio (`Clock`);
  - repositório do agregado principal.
- **Pontos de extensão:**
  - tipos de benefício/convite (estratégia);
  - geradores de insight (registro "eventos → fatos");
  - geradores de candidatas (registro "fatos → ofertas | nada");
  - tarefas de IA (registro: prompt + schema + guardrails + modelo);
  - **API em primeiro lugar**: as telas usam rotas com contratos, e o **MCP expõe as mesmas operações**.
- **Fora de propósito:** filas/eventos, framework de injeção de dependência, CQRS (ficam no roadmap de escala).

### 4.2 Modelo de dados (T2)
- **Contas e restaurantes:** `owners` · `restaurants` · `idle_slots`.
  - `restaurants`: vitrine|teste, horários de funcionamento, ticket médio e margem % (opcionais), coordenada fictícia, status, `activated_at`.
  - `idle_slots`: id estável, dias, início, fim, intensidade, mesas desejadas, ativo.
- **Cardápio e ofertas:** `menus` + `menu_items` · `benefits` + `benefit_versions` · `stamp_card_configs`.
  - Em `benefit_versions`: tipo, params em JSON validados por contrato e `role: agora|convite|recompensa`.
- **Kit:** `kit_pieces` + `piece_variants` (token do QR, textos, status do revisor).
- **Clientes:**
  - `customers`: a pessoa, global;
  - `customer_contacts`: PII (hash HMAC do telefone + 4 últimos dígitos); apagar = 1 linha;
  - `restaurant_customers`: 1ª visita, selos, canais e **grupo do experimento** (`convidavel|holdout`, gravado uma única vez com `WHERE arm IS NULL`).
- **Eventos** (append-only, com chave de idempotência e índices por restaurante e data):
  - `scans`: variante, aparelho;
  - `checkins`: variante, versão do benefício, dia e turno em SP, status de GPS;
  - `codes`: tipo `primeira_visita|convite|recompensa`, cliente, item, validade, status, `validado_em`;
  - `invites`, com:
    - cliente e versão da regra;
    - `slot_id` e janela congelados;
    - `arm` (`convidado|holdout`);
    - status `ativo|usado|expirado|suprimido` (fantasma = `holdout` + `suprimido`);
    - `emitido_em`, `expira_em`;
    - origem `mesa|reativacao`;
    - índice único parcial "1 ativo por cliente por restaurante";
  - `invite_quota`: restaurante, `slot_id`, semana ISO, teto, usados (reserva atômica com `UPDATE … WHERE usados < teto`);
  - `stamps`.
- **Planos e IA:**
  - `weekly_plans`: semana, fatos, candidatas, escolha, textos, "o que aprendemos", decisão, versão;
  - `plan_sends` + membros: reativação simulada;
  - `owner_edits`: sugestão × versão final;
  - `ai_calls`: tarefa, modelo real, versão do prompt, tokens, custo, latência, resultado dos guardrails, veredito do revisor.
- **Config e proteção:** `app_config` + `app_config_versions` (prompts por tarefa e flags; versões imutáveis + ponteiro atual) · `rate_limits` · `mcp_tokens` (hash, revogável) · `restaurants.ai_tone` (tom por restaurante) · `invites.test_valid_day` (Antecipar no teste).
- Regras gerais:
  - datas em UTC + coluna do dia em `America/Sao_Paulo`;
  - toda linha com o restaurante dono, e isolamento por restaurante na camada de dados;
  - `simulation_run_id` nas tabelas de eventos e planos;
  - migrações versionadas (Drizzle);
  - seed idempotente, com datas relativas a `now()`.
- Saem da v1: `reviews`, `recommendations`, `campaigns`. `redemptions` vira `codes`.

### 4.3 Rotas (T3)
- **auth:** pedir código por e-mail, conferir código, link do avaliador, sair, trocar loja, criar/excluir restaurante de teste (D118, D126).
- **menu:** extrair, salvar revisão.
- **onboarding:** salão, **gerar pacote**, aprovar/ajustar pacote, ativar.
- **kit:** gerar, editar, regenerar campo, aprovar, marcar no salão.
- **públicas:** página, beacon de leitura, check-in, identificação.
- **códigos:** consultar, confirmar.
- **painel:** métricas, funil, segmentos.
- **plano:** gerar, aprovar, ajustar, descartar.
- **simulação:** simular, limpar.
- **bastidores:** config, qualidade da IA, resetar demo, novo cliente fictício.
- `/api/health` (com o SHA do commit).
- **`/api/mcp`** (flag, último na fila): servidor MCP sem estado, via HTTP e só POST, com o SDK oficial (nome e versão conferidos na implementação).
  - Ferramentas sobre as mesmas operações: ler insights, gerar plano, ver plano e **aprovar plano** (D219).
  - Autenticação por `Authorization: Bearer`, com o **token do dono vinculado a 1 restaurante**; comparação em tempo constante; nenhuma ferramenta recebe `restaurantId`.
  - Mesmos limites de uso; checagem de `Origin`; respostas só com agregados, nunca PII.
  - Aprovação registrada como "via agente".

Todas as rotas são validadas com Zod, têm limite de uso e tiram o restaurante da sessão. OpenAPI das rotas JSON (desejável).

### 4.4 Camada de IA (T4)
- **Acesso:** **só OpenRouter**, via Vercel AI SDK 7 (`generateText` + `Output.object`) + `@openrouter/ai-sdk-provider`. Modelos por tarefa definidos pela mini-avaliação.
- **Tarefas:**
  1. **Estruturar cardápio:** imagem/PDF → JSON (PDF só para modelos que aceitam PDF).
  2. **Chamadas do kit:** com `{beneficio}`, `{convite}`, `{prato:…}`.
  3. **Pacote e plano da semana:** escolha entre candidatas (por id), texto do convite, justificativa e "o que aprendemos", tudo com referências.
  4. **Revisor:** rubrica → `ok | atenção | bloquear` + motivos, de **outro provedor**, via OpenRouter.
- **Guardrails em 5 camadas:**
  1. **Contrato:** saída estruturada validada com Zod. Inválida → nova tentativa → próximo modelo (**laço no nosso código**), registrando o modelo e o custo reais. Na tarefa 3, a escolha precisa ser um **id de candidata existente**.
  2. **Regras fixas:**
     - valores só **por referência** (`{fato:chave}`, `{prato:id}`, `{beneficio}`, `{convite}`); o código escreve números e nomes;
     - **lista de palavras proibidas**;
     - limites de tamanho;
     - nada de PII.
  3. **Revisor** (kit, texto do convite e reativação), assíncrono.
  4. **Humano:** o dono aprova o pacote, o plano e o kit antes de qualquer coisa chegar ao salão ou aos clientes.
  5. **Observabilidade:** rastro de cada chamada (4.8).
- **Defesas:**
  - texto da imagem é dado, nunca instrução;
  - nomes de itens limpos e limitados antes de entrar em outros prompts;
  - IA sem ferramentas de escrita: o plano (S6) e o Assistente do salão (S8) têm só ferramentas de leitura; mudanças saem como proposta tipada que o código confere e o dono aplica com um clique (o MCP expõe o **nosso** sistema a agentes externos);
  - **Assistente restrito ao escopo do restaurante (D277, D286):** a IA classifica o pedido (`escopo`) e, fora do escopo, a recusa é escrita pelo código, sem propostas; um portão determinístico limita formato, tamanho e âncora da resposta (não garante o assunto);
  - imagem que não é cardápio → caminho de saída;
  - **PII nunca entra no prompt, por construção:** fatos agregados e público resolvido pelo código. **Exceção declarada (S8, D262/D268):** o copiloto e o MCP recebem primeiro nome + inicial e atributos de clientes por apelido (`{cliente:C3}`); **contato (e-mail, telefone) nunca**; o Langfuse não grava entrada nem saída da tarefa do copiloto.
- **Latência:**
  - extrações dos 3 exemplos em **cache por hash** (rotuladas "processado anteriormente");
  - kit e pacote em paralelo/streaming, com esqueleto;
  - timeout por tentativa + orçamento total;
  - depois de ~45 s, "texto modelo (sem IA)".
- **Modo sem IA** nas 3 tarefas de geração: digitar/usar exemplo; texto modelo; candidata de maior pontuação.
- **Prompts editáveis ao vivo** na página de configurações:
  - só o bloco de instruções e tom (schema e guardrails ficam no código);
  - "testar com exemplo" antes de publicar;
  - voltar versão;
  - flags no banco: `ab`, `revisor`, `aprende`, `insight_operacao`, `mcp`.
- **"Aprende com o dono":** edições aprovadas viram exemplos nos prompts **só do próprio restaurante**; métrica de % aceitas sem edição.
- **Imagens:**
  - redimensionadas no navegador (~1600 px, JPEG);
  - upload até 8 MB;
  - tipos JPG/PNG/WEBP/PDF verificados; PDF até 5 páginas;
  - **imagem nunca guardada**.
- **Chaves e custo:**
  - 2 chaves no OpenRouter: pública, com teto baixo, e demo;
  - limites por visitante, por IP e teto global por dia;
  - orçamento total de US$ 10;
  - MCP do OpenRouter na construção (D98).
- **Mini-avaliação:**
  - **Tarefa 1:** 3 cardápios com gabarito; mede acerto de itens e preços, JSON válido, latência p50 e custo.
  - **Tarefa 3:** ~5 fixtures de fatos e candidatas. Mede referências válidas, escolha válida e aderência a uma rubrica curta (turno × item, justificativa cita fato pertinente), e **compara com a linha de base sem IA** (candidata de maior pontuação + texto modelo).
  - Relatório em Markdown + rastros no Langfuse. Chamado de "teste de fumaça" se a amostra for pequena.

### 4.5 Infra e deploy (T5)
- **Easypanel:** serviços `case-salao-db` (Postgres 16, só na rede interna) e `case-salao-app` (Node 22, Next `standalone`) dentro do projeto `sites` (D100), com nome neutro e domínio `sites-case-salao-app.lyv8st.easypanel.host`, **sem limite de CPU/memória** (D90).
- **Deploy acionado pelo CI só quando verde.** **Congelamento em 23/11 às 15h** = desligar o gatilho.
- **Mitigações do build na VPS:**
  - `.dockerignore` (sem docs/PDFs/prints);
  - `typescript.ignoreBuildErrors`;
  - `experimental.cpus: 1`;
  - heap do Node limitado;
  - medir o pico de memória;
  - checar a memória livre da VPS antes de cada deploy.
- **Runtime:**
  - cliente do banco criado sob demanda;
  - migrações por `migrate()` em `instrumentation.ts`, nunca na fase de build;
  - seed da vitrine se não existir;
  - `/api/health` testa o banco e devolve o SHA.
- **Ambientes:** só local e produção. E2E contra produção depois de cada deploy. Rollback por revert. Backup manual antes da sessão.
- **Variáveis de ambiente:**
  - banco;
  - 2 chaves OpenRouter;
  - Langfuse (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`);
  - senha dos bastidores, segredo da sessão, segredo do HMAC;
  - senha dos Bastidores: `BASTIDORES_PASSWORD` (gerada pela IA — D139);
  - e-mail (S2): `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `MAIL_FROM`; `E2E_LOGIN_TOKEN` (D123), `EVALUATOR_LINK_TOKEN` (D126), `PUBLIC_BASE_URL`, `PRESENTER_EMAILS` (opcional); `GOOGLE_VISION_CREDENTIALS`, usada só na T1 (D128);
  - o token do MCP é por restaurante, gerado em Configurações e guardado como hash no banco (não é variável de ambiente).

### 4.6 Segurança e privacidade (T6)
- **Sessão:** cookie assinado (httpOnly, Secure, SameSite=Lax); restaurante sempre da sessão; autorização na camada de dados.
- **Acesso:**
  - rotas públicas só por token;
  - senha própria nos bastidores;
  - **MCP com token do dono por restaurante (hash no banco, revogável), mesmos limites, sem contato de cliente nas respostas (só primeiro nome + inicial e atributos, com a flag `mcp_clientes` — D268); aprovação "via agente" registrada**.
- **Entrada e conteúdo:** Zod em tudo; React sem HTML cru da IA.
- **Plataforma:** CSP e cabeçalhos de segurança; patches de segurança atuais; limites de uso; corpo JSON de até 64 KB, com 413 acima disso antes da autenticação (S9).
- **Dados pessoais** (atualizado na S9 com D154, D169, D171, D173, D237, D262 e D268):
  - **cliente real:** entra com o próprio e-mail e um código de 6 dígitos por e-mail, com aceite explícito; nome e telefone (opcional) só no 1º acesso (D154, D173);
  - e-mail e telefone guardados como HMAC (busca) e criptografados com AES-256-GCM, chave derivada do `SESSION_SECRET` por HKDF (D169, D237);
  - o dono vê o contato completo dos próprios clientes, com o aceite do cliente no cadastro (D237); no restaurante de exemplo, contatos fictícios óbvios (DDD 00, `exemplo.invalid`);
  - contato de cliente **nunca** vai para log, prompt de IA, MCP nem rastro; o copiloto e o MCP veem só primeiro nome + inicial e atributos (visitas, selos, segmento), por apelido; o rastro do copiloto não grava a conversa (D262, D268);
  - sem apagamento automático dos dados do cliente; "Apagar meus dados" sempre disponível na Jornada; risco declarado em "Como funciona" (D171);
  - **e-mail real do dono** (D118, D169, D237): HMAC para o login e criptografado (AES-256-GCM) para o resumo semanal e o rodapé do Portal; nunca em log, rastro ou prompt; o SES processa o endereço para entregar os e-mails (declarado na tela e em "Como funciona"); contas sem acesso por 7 dias são apagadas;
  - coordenada nunca guardada;
  - limpeza "de carona" de restaurantes de teste com mais de 7 dias;
  - segredos só em variáveis de ambiente.
- **Dependências:** verificação no CI.
- **Opt-in:** o convite aparece na tela e na Jornada **sem depender de envio**; a reativação simulada vai **só para quem tem opt-in**.
- **Em produção:** o opt-in exigiria consentimento ativo (LGPD) e provedores de IA adequados à transferência internacional (hoje, primeiro nome + inicial de clientes vão ao OpenRouter com `data_collection: deny` — D262).

### 4.7 Testes (T7)
- **TDD no domínio:**
  - benefício e convite;
  - sorteio por intenção de tratar e convite fantasma;
  - teto por semana ISO, inclusive com check-ins simultâneos;
  - 1 convite ativo;
  - convite congelado;
  - códigos dos 3 tipos (o do convite só na volta, dentro da faixa, em outro dia);
  - cartela;
  - resultados do check-in;
  - dia e turno em SP (relógio fixo, inclusive 23/11 17h10);
  - incremento (Welch, 4 estados, Δcusto) e migração;
  - coortes e veredito por oferta;
  - simulador recupera o efeito declarado (IC da vitrine acima de zero);
  - insights e candidatas;
  - estatística do A/B;
  - validadores de IA (referências, palavras proibidas, escolha ∈ candidatas).
- **Contratos de IA:** saídas de exemplo boas e ruins.
- **Integração:** casos de uso principais contra Postgres no CI.
- **E2E (Playwright),** local e contra produção:
  - **caminho feliz:** login demo → criar restaurante com exemplo → salão com horário vazio → **pacote proposto → aprovar** → kit → abrir QR → check-in com GPS negado → identificação → "agora" + código + **2º card do convite** → garçom valida → painel atualiza → simular 30 dias → **plano da semana com "o que aprendemos" → aprovar**;
  - 2 check-ins com identidades diferentes no mesmo dia;
  - um cliente do holdout, sem convite visível;
  - volta com convite, usando "antecipar convite em 1 dia".

### 4.8 Observabilidade e custo (T8)
- Langfuse Cloud (plano gratuito, região EU — D84), pela integração oficial com o AI SDK 7.
- Cada chamada registra tarefa, versão do prompt, modelo real, tokens, custo, latência, reserva usada e notas (guardrails, revisor, edição do dono).
- O exportador nunca derruba a requisição.
- Resumo em `ai_calls` para a aba Qualidade da IA.
- Logs estruturados no stdout.
- Tetos de custo visíveis.

### 4.9 Design system (T9)
- Tailwind 4 (`@theme`) com tokens medidos nos prints; o print vence (D82).
- Vermelhos (D80): botão `#E71C2B`, logo e áreas sem texto `#EA1D2C`, texto pequeno `#D72E3B`, funil `#EF5652`.
- Fonte **Inter** self-hosted.
- Duas cascas: Portal (sidebar → gaveta no celular) e App (em coluna).
- Base na S0; componentes de domínio na fatia que os usa (D79).
- Ícones de biblioteca aberta.
- **Só o logo padrão do iFood** em SVG público (D81).
- Acessibilidade:
  - contraste AA;
  - foco visível e preso em sheets;
  - Esc fecha;
  - rótulos completos dos dias;
  - alvos ≥ 44 px.

---

## 5. Demo (P8) — 8 minutos, via Meet, no modo apresentação
| Tempo | Conteúdo |
|---|---|
| 0:00–0:45 | Problema (20% divulgam), promessa ("seu salão cheio divulga seu horário vazio") e **contraste com o print 04**: "benefício por turno já existe: público, para qualquer um, sem medida → aqui: convite só para quem já veio, com teto de custo e incremento medido". H1–H5 ficam para as perguntas |
| 0:45–2:30 | **Ativação "uau"** com exemplo em cache: cardápio → faixas vazias → **pacote proposto** (agora + convite + 1º plano, com custo e justificativa) → aprovar → kit (revisor) → QR |
| 2:30–3:45 | Cliente e garçom: QR → check-in → GPS → identificação → agora + código + **2º card do convite** → garçom **valida o código** → funil atualiza |
| 3:45–5:30 | Frase de transição ("este restaurante tem 60 dias de dados") → vitrine: **plano da semana** (insights, IA escolhe e explica, **"o que aprendemos"** com veredito do código) → aprovar (reativação simulada). **Copiloto (S8, D263), ≤ 60 s:** chip "Trocar a oferta de Ter–Qui 15h–18h" → cartão com custo do código → Aplicar → campo destacado |
| 5:30–6:45 | Incremento com IC e os 4 estados, proteção contra migração, negócio com 1 conta de bolso [H] (quem paga, custo de IA por restaurante) |
| 6:45–8:00 | **Mudança ao vivo** (tom ou prompt na página de configurações) + guardrails e rastro no Langfuse. MCP só se perguntarem |

- **Plano B:** vídeo de 2–3 min; restaurante de teste pré-criado; vitrine sem IA ao vivo.
- **Mudança ao vivo:** página de configurações (sem deploy) e ambiente local com hot reload para pedidos de código.
- **Checklist do dia:**
  - resetar a demo depois do ensaio;
  - conferir o saldo da chave de demo às 16h;
  - deixar a permissão de GPS definida no navegador;
  - Portal já logado na véspera (sessão de 30 dias) e envio do SES conferido;
  - Langfuse logado;
  - monitor de disponibilidade ligado;
  - pausar serviços não essenciais da VPS antes do ensaio (D90);
  - gravar um Meet de teste na S3.

## 6. Entregáveis (E1–E4)
- **E1 — slide do processo (PPTX, 1 slide):**
  - **Prompts:** como conversamos com a IA na construção, inclusive o replanejamento por diferenciação; evolução v1→vN com uma falha real e a correção; números da mini-avaliação; guardrails e revisor.
  - **APIs:** OpenRouter e por quê; modelos por tarefa com acerto, custo e latência; AI SDK; Langfuse Cloud; MCP (OpenRouter na construção e o nosso no produto); Postgres/Easypanel; Geolocation API.
  - **Riscos:** tabela da seção 8.
- **E2 — material extra:**
  - página "Como este protótipo funciona";
  - documento técnico;
  - vídeo de 2–3 min;
  - **repositório público limpo**, gerado por cópia filtrada, com varredura de segredos.
- **E3 — fatiamento e cronograma:** seção 7.
- **E4 — preparação da entrevista:**
  - pitch de 2 min e história do case em 1 min;
  - ~20 perguntas prováveis com respostas, entre elas:
    - **"isso já não existe no Comer Fora?"** (tabela já existe × novo);
    - **"não é só migração de horário?"** (métrica de proteção);
    - **"por que não um chat?" / "isso não é um chat?"** (S8: não é conversa sozinha — o pedido vira proposta conferida pelo código, sobre as mesmas ferramentas do MCP; no Portal nada muda sem o clique do dono; o número é sempre do código), **"por que não LangGraph/LangChain?"** (D215: tarefas de chamada única, humano no meio como estado de banco; reabre se o plano virar agente com ferramentas);
    - causalidade e amostra do holdout;
    - ROI do dono e quem paga;
    - escala para 400 mil;
    - custo de IA por restaurante;
    - MCP;
    - guardrails;
    - LGPD;
    - monetização;
    - kit físico em escala.
  - Dimensionamento e conta de bolso rotulada [H].
  - Projetos reais do candidato; construção agêntica como caso "Generalist".
  - Desafio técnico de logística.
  - Corrigir antes: "semanal × quinzenal" no portfólio.

## 7. Prioridade, cronograma e regra de corte (E3)
**Ordem de prioridade.** Os recursos têm flag; o que não estiver pronto e testado na noite de 22/11 fica desligado:
1. **Fluxo integral:** QR → agora + convite (com holdout e teto) → validar código → volta com convite.
2. Guardrails.
3. Modo sem IA.
4. **Plano da semana** (insights 1–3 + candidatas + IA + "o que aprendemos") e **pacote proposto** na ativação.
5. Mini-avaliação (tarefas 1 e 3).
6. E2E em produção.
7. Insight 4 + A/B.
8. Revisor.
9. Aprende com o dono.
10. MCP.

| Quando | Fatia |
|---|---|
| 19–20/11 | **S0** (fundação; em execução em outra sessão, sem mudanças pelo replanejamento) |
| 20/11 → manhã de 21/11 | **S1:** domínio com TDD (faixas e turnos, ofertas, cartela, códigos, sorteio + fantasma, teto, `decideCheckin`, incremento/coortes/migração) + esquema v2 + identificação/leituras/check-in + simulador por agente e seed de 60 dias (com 2 planos fixos em JSON com referências) + telas do cliente |
| 21/11 → manhã de 22/11 | **S2:** Portal (casca, login demo) + limites + guardrails com as referências novas + cardápio com IA + **motor de candidatas + tarefa de IA 3 + modo sem IA** + ativação com **pacote proposto** + kit + Validar código |
| 22/11 | **S3:** insights e painel + **plano da semana** (veredito, IA, "o que aprendemos", aprovar, reativação com fantasma) + entrada, modo apresentação e "Como funciona" + bastidores ("antecipar convite") → mini-avaliação (T1 e T3, com linha de base sem IA) → E2E em produção → insight 4 + A/B → revisor → aprende → MCP |
| 21/11 | **S4:** produto real e identidade: cliente com o próprio e-mail e código, contato criptografado, nada de "teste" nas telas (D151–D176) |
| 21/11 | **S5:** valor e conversão: painel em reais e meta, "Hoje no salão", landing e página do QR reescritas, "Por que esta oferta?" (D179–D185; flags `painel_valor`, `copy_v2`, `explica_ia`) |
| 21/11 | **S6:** IA que opera e sistema configurável: resumo semanal por e-mail com "Revisar e aprovar", agendador, link do garçom, plano como agente, porta-conta (D187–D200). S4–S6 com revisão e merge únicos (`959f679`, D167) |
| 21/11 → madrugada de 22/11 | **S8:** Assistente do salão (pedido → proposta conferida pelo código → "Aplicar") e MCP sobre o mesmo catálogo (D260–D271; merge `df36504`). Roda antes da S7 |
| 22/11 | **S9:** polimento pré-entrega: revisão completa (requisitos, IA, segurança) e revisão de copy; flags entregues ligadas por padrão |
| 23/11 até 15h | **S7** (era a S4, renumerada pela D151): slide PPTX, vídeo de telas reais, cópia pública, envio pelos 2 canais, **congelamento às 15h** |
| 23/11 15–17h | Resetar demo, ensaio cronometrado, checklist do dia |

## 8. Riscos e tratamento
| Risco | Tratamento |
|---|---|
| **"Isso já existe"** (benefício por turno, trilhas, cartela) | Tabela já existe × novo no produto, na demo e no slide; o diferencial é o convite nascido na mesa + incremento medido + plano com IA |
| **Migração do pico** inflando o resultado | Métrica principal em visitas totais; proteção "visitas no pico, convidados × holdout" |
| **Amostra pequena** (holdout de ~20 clientes por restaurante) | Intervalo de 95%, "amostra insuficiente"; prova estatística = piloto (roadmap) |
| **Simulação que mede o que programou** | Efeito como parâmetro declarado em "Como funciona"; simulador usa as mesmas regras do produto |
| **Grupos não comparáveis** | Sorteio só entre quem poderia receber + convite fantasma (intenção de tratar) |
| **Medida = check-ins, não visitas** (viés a favor do produto) | Rótulo "visitas registradas"; limitação declarada; em produção, cruzar com pagamento ou reserva |
| **Contaminação do holdout** | Antes do check-in, só "você pode ganhar um convite"; garçom fala só do "agora" |
| **MCP aprova plano** (caminho de dinheiro sem clique no Portal) | Token do dono por restaurante, revogável; limites; registro "via agente"; flag desligável; edição só por propor → aplicar (D269) |
| **IA decorativa** | Código decide números e dinheiro; IA escolhe entre candidatas, casa item × turno e explica; mini-avaliação compara IA × linha de base sem IA (rubrica e aceite sem edição) |
| Página confundida com o iFood oficial / bloqueio por phishing | Barra de protótipo, `noindex`, nome neutro; risco aceito sem Search Console (D88). Desde a S2 o login é idêntico ao portal/01 e pede e-mail real (D118, risco aceito pelo candidato): link privado do avaliador (D126), e-mail sem logo nem link, DMARC |
| E-mail real do dono (dado pessoal) e dependência do SES | HMAC para o login + criptografado (AES-256-GCM) para o resumo; limites por e-mail, IP e global; preflight do SES e teste de entrega antes do merge; link do avaliador como saída |
| Dados pessoais reais de clientes (D154, D237) | Aceite explícito no cadastro; HMAC + AES-256-GCM; contato nunca em log, prompt, MCP ou rastro; a IA vê só primeiro nome + inicial (D262, D268); "Apagar meus dados" a qualquer hora (D171) |
| Opt-in ligado por padrão sustenta a reativação | Convite visível sem envio; reativação só com opt-in; em produção, consentimento ativo (LGPD) |
| IA inventa número/promessa | Referências + regras + palavras proibidas + escolha ∈ candidatas + revisor + aprovação do dono |
| Prompt injection (cardápio, nomes, pedido ao assistente) | Texto como dado, saída por schema, IA só com ferramentas de leitura, nomes limpos, proposta conferida pelo código + clique, escopo do assistente com recusa do código (D277, D286) |
| IA indisponível / crédito esgotado | Modo sem IA, cache dos exemplos, 2 chaves, tetos e limites |
| Dados em provedores fora do Brasil (LGPD) | Contato nunca sai; só primeiro nome + inicial vai ao provedor, com `data_collection: deny` (D262); em produção, provedores adequados |
| Build na VPS compartilhada (OOM) | Deploy só com CI verde, mitigações de memória, checagem antes do deploy, congelamento às 15h |
| Fraude de benefício (QR fotografado) | Código único por cliente validado pelo garçom; 1 check-in/dia; convite com horário e uso único |
| Cliente confuso com "agora" + "convite"; garçom com vários códigos | Convite como 2º card depois do agora; uma tela "Validar código" que reconhece o tipo |
| A/B sem amostra | Status honesto "sem vencedora ainda" |
| GPS impreciso | Validação não bloqueante, igual ao app |
| Demo ao vivo (fuso, ensaio, latência) | Relógio em SP com teste fixo, resetar demo, cache, modo apresentação, plano B em vídeo |
| Escopo maior que o tempo | Prioridade com flags e regra de corte |

## 9. Roadmap (fora do protótipo)
- **Fase 1 — piloto:** ~50 restaurantes em 1–2 cidades do Comer Fora; holdout por cliente e mesas alternadas com e sem display. Aqui sai a **prova estatística** do incremento. Critério de parada definido.
- **Fase 2 — integração:**
  - **ativação conectada ao iFood** (D276): na primeira entrada, o sistema puxa do iFood os dados do restaurante do dono logado, em vez de pedir foto/PDF do cardápio e números declarados. Entram:
    - cardápio com preços e categorias;
    - horário de funcionamento e endereço;
    - ticket médio;
    - clientes e frequência (pedidos e visitas do Comer Fora).

    Ganhos:
    - a ativação cai de minutos para poucos cliques;
    - números medidos substituem estimativas do dono (ticket, clientes por semana);
    - o plano da semana e o copiloto já começam com histórico, sem esperar os primeiros check-ins.

    Pré-requisitos e cuidados:
    - login iFood real (hoje fora de escopo, §10);
    - base legal e transparência para usar dados de clientes de delivery numa ação de salão;
    - para a IA vai o mesmo recorte de hoje: nome curto, nunca contato (D262, D268);
    - o dono confere o que veio antes de ativar (mesmo padrão da revisão do cardápio no passo 3);
  - convite como uma trilha de marketing nativa;
  - QR que abre o app (deep link/login iFood);
  - reativação real pelo CRM/Giftback;
  - kit físico enviado pelo iFood com texto personalizado pela IA.
- **Fase 3 — plataforma:**
  - **incremento causal no nível da plataforma** (holdout somado por culinária e cidade, com amostra de verdade);
  - aprendizado agregado por culinária e turno (qual oferta enche qual horário);
  - benchmark entre restaurantes;
  - Toqan consumindo o MCP;
  - integração com o totem;
  - "promover vencedora" automático;
  - rotação do holdout;
  - "modo salão" com PIN para o garçom.
- **Ideia registrada — roleta de benefícios:** gamificar o convite com uma roleta. O "tente na próxima" seria um holdout transparente e permitiria comparar ofertas. Fica fora do protótipo porque distribuir prêmio por sorte em ação comercial tende a exigir autorização (Lei 5.768/1971; verificar a regra atual), além do escopo e do acaso na demo.

## 10. Fora de escopo
- Recriar o app inteiro (delivery, busca, home do Comer Fora, mapa, "Perto de você").
- **Avaliar** (o app real já tem).
- Reserva e fila.
- Envio real de WhatsApp/push.
- Login iFood real (o protótipo tem login próprio por e-mail + código — D118).
- Restaurante sem salão.
- Estimativa de potencial de vendas.
- Convite a clientes de delivery.
- Automação semanal sem aprovação do dono.
- Homologação.

## 11. Verificação antes do congelamento
- CI verde: lint de fronteiras, tipos, testes de domínio e contratos de IA, integração.
- E2E do caminho feliz contra produção, incluindo convite, validação do código, cliente do holdout e 2 identidades no mesmo dia.
- Vitrine abre com o painel cheio e um plano com "o que aprendemos", sem chamar IA.
- Barra de protótipo e `noindex` em todas as telas; limites de uso disparam; rastros no Langfuse sem PII.
- Mudança de prompt/tom pela página de configurações reflete sem deploy.
- Ensaio cronometrado de 8 min no modo apresentação; vídeo de reserva gravado; demo resetada.
