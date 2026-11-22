# S7 — Entregáveis do case (versão pública)

Status: ✅ aprovado pelo candidato em 22/11/2026. Execução pela D101, fatia por fatia, com commit e push por fatia e uma revisão independente de produto e aderência ao case em cada uma (a revisão técnica não se aplica: a S7 produz documentos, slides, vídeo e o repositório público, não código de produto). O planejamento completo, que inclui a preparação pessoal do candidato, fica no repositório privado.

## Escopo
Só o que vai no envio ao iFood. A preparação da apresentação fica fora desta fatia.

## Requisitos (case, p. 5–8, e e-mails 1 e 2)
- **Solução em um link**, funcionando, para qualquer pessoa abrir e usar, do começo ao fim, sem depender do candidato.
- **Slide do processo**, mostrando o raciocínio:
  - **Prompts:** como construiu e evoluiu os prompts e como conversou com a IA.
  - **APIs:** quais APIs e ferramentas escolheu, e por quê.
  - **Riscos:** o que levou em conta e como tratou.
- **Material extra** (opcional).
- **Regras:** sem dados fornecidos (números do briefing são fictícios); nada de dados reais (nem internos do iFood, nem dados pessoais de ninguém).
- **Critérios:** diagnóstico, solução funcionando, profundidade da construção, visão de negócio, domínio da solução.

## Fatias
| Fatia | Entrega | Teste de aceite |
|---|---|---|
| E1 Base | Acesso desta sessão à produção; `workflow_dispatch` "só fumaça contra produção" no CI; `entregaveis/` no `.dockerignore`; e-mails do apresentador isentos do teto | Fumaça disparada à mão verde; `/api/health` com o SHA novo e `ia.teto: ativo` |
| E2 Percurso real | Percurso completo em produção pelo link público e pelo link do avaliador, com prints de cada passo (e-mails mascarados) | Fluxo sem erro em janela limpa; dado guardado depois de recarregar; nenhum contato de terceiros visível a outra conta |
| E6 Documentação | README reescrito + `docs/README.md` (como ler e glossário), `docs/decisoes-principais.md`, `docs/arquitetura.md`, `docs/ia-no-produto.md`, `docs/processo-com-ia.md`; passada de consistência; textos do app sem contradição e com o bloco "Material do case" | 2 revisores, no papel de avaliador do iFood, leem o repositório a frio e respondem 10 perguntas de compreensão sem erro; 0 links quebrados; todo número com fonte |
| E3 Slide do processo | 1 slide (PPTX + PDF): Prompts, APIs e ferramentas, Riscos; tabela "prompt em produção × medido" | Render conferido a 1280×720; corpo ≥ 16 pt; todo número batido com o arquivo de origem; sem dado pessoal |
| E4 Apresentação | Abertura, fecho e apêndice (PPTX + PDF) | Mesmos testes da E3 |
| E5 Vídeo | ≤ 3 min: telas reais, voz sintética pt-BR (Piper, local), legendas; animação ilustrativa se houver tempo | Voz aprovada pelo candidato; legendas sincronizadas; nenhum dado pessoal quadro a quadro |
| E7 Repositório público | Histórico filtrado (lista do que entra) + README + relatório de auditoria (gitleaks e varredura de dados pessoais) | Auditoria zerada; build no clone; push só com o OK do candidato |
| E8 Envio | Resposta ao e-mail 1 + formulário, com links públicos de cada material | Todos os links abertos em janela anônima antes do envio |

Ordem: E1 → E2 → E6 → E3/E4 → E5 → E7 → E8.

## Decisões
D297–D319 em [decisoes-e-tradeoffs.md](../../planejamento/decisoes-e-tradeoffs.md), seção P.
