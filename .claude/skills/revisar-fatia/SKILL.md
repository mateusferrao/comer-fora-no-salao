---
name: revisar-fatia
description: Use when a slice (fatia S0–S4) of the "Comer Fora no Salão" project finished implementation with all checks green, before merging it into main, and again after the merge to verify production.
---

# Revisar fatia

## Visão geral

Revisão crítica e independente de **tudo** o que a fatia entregou, em duas partes que rodam juntas:
1. **4 revisores independentes** (subagentes em paralelo, sem a conversa), um por frente (D08).
2. **Verificação E2E profunda feita por você mesmo**, simulando uso real no navegador, em todos os casos, local e depois em produção (D09, D13).

Depois: consolidar, filtrar criticamente, **decidir você mesmo** cada achado (D101), aplicar as correções com `implementar-fatia` (D10) e só então merge na `main` (D12), deploy e E2E em produção — tudo sem pedir confirmação entre etapas.

**REQUIRED SUB-SKILLS:** superpowers:dispatching-parallel-agents (revisores), superpowers:receiving-code-review (avaliar achados sem aceitar às cegas), superpowers:verification-before-completion (evidência antes de concluir).

**Regra de ferro:** nenhuma fatia vai para a `main` sem a matriz E2E completa e sem decisão registrada sobre cada achado crítico ou alto. Quem decide é você (D101); o candidato recebe o relatório final.

## Quando usar
- Fatia implementada com testes, lint, tipos e fronteiras verdes.
- Depois do merge na `main`: repetir a parte de produção da E2E.

## Processo

### 1. Pacote da revisão
Monte e anote os caminhos: diff da fatia (`git diff <base>..HEAD`), `docs/fatias/<SX>/planejamento.md`, especificação, decisões, contexto do case e da cultura, saída dos testes, URL local.

### 2. Revisores independentes (em paralelo, em segundo plano)
Dispare os 4 subagentes **numa única mensagem**, cada um com o prompt do seu arquivo, preenchido com os caminhos do pacote:
- [revisores/aderencia-ifood.md](revisores/aderencia-ifood.md) — case, requisitos, regras, critérios, cultura, valores, AI-first, negócio.
- [revisores/tecnica-arquitetura.md](revisores/tecnica-arquitetura.md) — arquitetura, fronteiras, padrões, código, dados, desempenho.
- [revisores/produto-design-ux.md](revisores/produto-design-ux.md) — funcionalidade, métricas, usabilidade, UX, acessibilidade, fidelidade visual.
- [revisores/seguranca-ia-qualidade.md](revisores/seguranca-ia-qualidade.md) — segurança, privacidade, guardrails de IA, testes, operação, deploy.

### 3. Verificação E2E profunda (você mesmo, enquanto os revisores trabalham)
Siga [e2e-simulacao.md](e2e-simulacao.md) inteiro. É simulação de uso real, crítica, em **todos** os casos da fatia — não um teste de fumaça.

### 4. Consolidação crítica
- Junte achados dos 4 revisores e da E2E; remova duplicados; classifique: **crítico · alto · médio · baixo**.
- Para cada achado: confira a evidência você mesmo (receiving-code-review). Achado sem evidência ou errado → marque "não procede" com o motivo.
- Lembre que os revisores também são modelos Claude: discorde quando os fatos mandarem.

### 5. Decisão (sua, registrada — D101)
Para cada achado, do mais grave ao menos grave, decida com base na especificação, nas decisões vigentes e no prazo: **corrigir agora** · **corrigir depois** (registrar a dívida e a fatia que a resolve) · **não corrigir** (com motivo).
- Crítico e alto: corrigir agora, salvo motivo forte registrado.
- Correção que muda decisão de produto ou arquitetura: decida pela especificação, registre como [C] em `decisoes-e-tradeoffs.md` (alternativas, trade-offs, motivo) e destaque no relatório final.
- Pare e pergunte **só** se o achado exigir algo que só o candidato resolve (credencial, conta paga, acesso, orçamento, serviço fora dos `case-salao-`) ou uma ação irreversível fora do escopo.

### 6. Registro e saída
- Escreva `docs/fatias/<SX>/revisao/revisao.md` com [template-revisao.md](template-revisao.md); capturas em `docs/fatias/<SX>/revisao/capturas/` (D14).
- Decisões novas em `decisoes-e-tradeoffs.md`; log atualizado.
- Correções decididas → `implementar-fatia`, e reverificação (testes + a parte da E2E afetada).
- Com tudo resolvido: conferir a memória livre da VPS, merge na `main` (deploy pelo CI), repetir a parte de produção da E2E e anexar o resultado à revisão. Commit + push.
- **Relatório final ao candidato:** o que foi entregue, achados e o que foi feito com cada um, decisões [C] tomadas na fatia, dívidas abertas e o estado em produção (SHA e E2E).

## Sinais de alerta
| Pensamento | Realidade |
|---|---|
| "Os testes passaram, a E2E é formalidade" | Teste automatizado não vê tela feia, texto errado nem fluxo confuso. Simule de verdade. |
| "Só o caminho feliz basta" | O avaliador vai sozinho, em outro horário, no celular. Todos os casos. |
| "O revisor disse, então é verdade" | Confira a evidência. Revisor também erra. |
| "Esse achado muda produto, decido em silêncio" | Pode decidir (D101), mas registrado como [C] e destacado no relatório final. |
| "Vou perguntar se pode fazer o merge" | Revisão concluída e tudo verde: faça o merge, o deploy e a E2E em produção (D101), respeitando o congelamento de 23/11 às 15h. |
| "Merge agora, reviso produção depois" | Produção é revisada logo após o merge, antes da próxima fatia. |
