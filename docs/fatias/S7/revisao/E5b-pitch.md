# S7 · E5b — Vídeo-pitch animado (D327, D328)

Data: 22/11/2026 · Duração: ~1 min 19 s · 1920×1080 · 24 fps

## Como foi feito
- **História:** dona Lúcia, dona de uma cantina. Sábado lotado × terça vazia → QR na mesa → benefício na hora + convite → volta na terça → a IA monta o kit e o plano, e a dona aprova → painel em R$ → a aposta para o iFood → fecho.
- **3D:** feito em código (Three.js), com personagens arredondados, móveis e cidade montados com formas simples, sem assets externos. Renderizado quadro a quadro num navegador sem tela (render em software).
- **Telas reais:** 3, todas da produção e com a barra de protótipo: o convite no celular, o kit de divulgação e o painel do restaurante de exemplo, este com o selo "histórico gerado".
- **Narração:** Piper, voz *faber*, a mesma do vídeo da demo. Legendas embutidas, uma frase por vez, com o selo "Protótipo de case · não é produto oficial do iFood · animação ilustrativa".

## Revisão independente (produto e aderência) — achado → destino
| Achado | Destino |
|---|---|
| **Bloqueante:** "Resultado medido, não achado" sobre um painel com histórico gerado | "Neste exemplo, o histórico é gerado: a tela mostra a medida, não prova o efeito" + selo grande (D328) |
| Ganho para o iFood dito como fato | "a aposta… Um piloto mede quanto"; rótulo "Hipótese" na cidade |
| Card "832 clientes" (efeito do seed) contradiz a conta de bolso | Removido do recorte do painel |
| Faltava a ativação (metade da opção 2: "entrar, divulgar") | Cena 5 abre com cardápio → kit, com a tela real do kit; os 20% (fictício) no fecho |
| Fecho prometia "mais clientes" | "convites para o horário vazio e o resultado medido em reais" |
| Destaque do convite desalinhado e fundo preto no celular | Sem rolagem (o print cabe inteiro); destaque envolvendo o card |
| Plano ilustrado diferente do convite real | Mesma faixa e oferta do convite; rótulo "ilustração" legível |
| "Nada vale sem a aprovação" absoluto (MCP, D269) | "nada chega ao cliente sem a aprovação da dona Lúcia" |
| Jargão "custo e teto vêm do código" | "o sistema calcula o custo e o limite de gasto" |
| "Cantina da dona Lúcia" × placa "Cantina Nonna Lúcia" | "Na cantina da dona Lúcia" (descrição, não nome) |
| Legendas sobrepostas por ~150 ms | Cada legenda termina quando a próxima começa |
| Logo do iFood nas telas reais × D297 | Exceção registrada na D328 (tela real com barra de protótipo) |

## Verificação
- Quadros-chave conferidos em resolução cheia depois das correções (convite, kit, plano aprovado, painel com o selo, cidade, fecho).
- A aprovação acontece no tempo da fala, calculado a partir do áudio (`timing.json`).
