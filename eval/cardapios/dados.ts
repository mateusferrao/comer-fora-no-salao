/**
 * Cardápios FICTÍCIOS dos 3 exemplos (D117, D130): nomes, pratos e preços inventados para o protótipo.
 * Fonte única: o mesmo dado desenha a imagem (scripts/gerar-cardapios.ts) e é o gabarito da T1.
 */
import type { MenuCategory } from "@/src/modules/beneficios/domain/menu";

export type GabaritoItem = { categoria: MenuCategory; nome: string; precoCentavos: number };
/** Linha impressa: `nome` + preço(s). Vários preços = variações (ex.: chopp 300/500 ml), cada uma vira um item. */
export type Linha = { nome: string; desc?: string; precos: Array<{ rotulo?: string; centavos: number }> };
export type Secao = { titulo: string; categoria: MenuCategory; linhas: Linha[] };
export type Cardapio = {
  id: "boteco" | "burger" | "sushi";
  nome: string;
  subtitulo: string;
  culinaria: string;
  faixaPreco: "$" | "$$" | "$$$" | "$$$$";
  paginas: Secao[][];
};

const p = (centavos: number, rotulo?: string) => ({ centavos, rotulo });

export const CARDAPIOS: Cardapio[] = [
  {
    id: "boteco",
    nome: "Boteco do Seu Zé",
    subtitulo: "Petiscos, chopp gelado e comida de vó",
    culinaria: "Brasileira",
    faixaPreco: "$$",
    paginas: [
      [
        {
          titulo: "Petiscos",
          categoria: "porcao",
          linhas: [
            { nome: "Bolinho de bacalhau", desc: "6 unidades", precos: [p(3890)] },
            { nome: "Mandioca frita", desc: "com maionese da casa", precos: [p(2990)] },
            { nome: "Calabresa acebolada", precos: [p(3490)] },
            { nome: "Torresmo pururuca", precos: [p(3200)] },
            { nome: "Pastel de queijo", desc: "4 unidades", precos: [p(2650)] },
            { nome: "Frango a passarinho", precos: [p(4290)] },
          ],
        },
        {
          titulo: "Entradas",
          categoria: "entrada",
          linhas: [
            { nome: "Caldinho de feijão", precos: [p(1400)] },
            { nome: "Salada vinagrete", precos: [p(1650)] },
          ],
        },
        {
          titulo: "Pratos",
          categoria: "prato",
          linhas: [
            { nome: "Feijoada da casa", desc: "sábados e domingos", precos: [p(5490)] },
            { nome: "Picanha na chapa", desc: "serve 2 pessoas", precos: [p(11900)] },
            { nome: "Parmegiana de frango", precos: [p(4850)] },
            { nome: "Baião de dois", precos: [p(4400)] },
          ],
        },
        {
          titulo: "Sobremesas",
          categoria: "sobremesa",
          linhas: [
            { nome: "Pudim de leite", precos: [p(1490)] },
            { nome: "Cocada de forno", precos: [p(1200)] },
            { nome: "Romeu e Julieta", precos: [p(1350)] },
          ],
        },
        {
          titulo: "Bebidas",
          categoria: "bebida",
          linhas: [
            { nome: "Chopp claro", precos: [p(1200, "300 ml"), p(1800, "500 ml")] },
            { nome: "Caipirinha de limão", precos: [p(2200)] },
            { nome: "Refrigerante lata", precos: [p(700)] },
            { nome: "Água com gás", precos: [p(550)] },
            { nome: "Suco de caju", precos: [p(900)] },
          ],
        },
      ],
    ],
  },
  {
    id: "burger",
    nome: "Burger Lab",
    subtitulo: "Hambúrguer artesanal · pão de fermentação natural",
    culinaria: "Hamburgueria",
    faixaPreco: "$$",
    paginas: [
      [
        {
          titulo: "Para começar",
          categoria: "entrada",
          linhas: [
            { nome: "Batata rústica", precos: [p(2400)] },
            { nome: "Onion rings", precos: [p(2600)] },
            { nome: "Nuggets da casa", desc: "8 unidades", precos: [p(2800)] },
          ],
        },
        {
          titulo: "Burgers",
          categoria: "prato",
          linhas: [
            { nome: "Classic Burger", desc: "blend 160 g, queijo prato, alface e tomate", precos: [p(3690)] },
            { nome: "Cheddar Bacon", precos: [p(4290)] },
            { nome: "Burger Duplo 2x", desc: "2 blends de 120 g", precos: [p(4990)] },
            { nome: "Veggie de grão-de-bico", precos: [p(3800)] },
            { nome: "Chicken Crispy", precos: [p(3750)] },
            { nome: "Smash Simples", precos: [p(2990)] },
          ],
        },
        {
          titulo: "Doces",
          categoria: "sobremesa",
          linhas: [
            { nome: "Brownie com sorvete", precos: [p(2200)] },
            { nome: "Cookie quente", precos: [p(1600)] },
          ],
        },
        {
          titulo: "Bebidas",
          categoria: "bebida",
          linhas: [
            { nome: "Milkshake de baunilha", precos: [p(2490)] },
            { nome: "Refrigerante 600 ml", precos: [p(900)] },
            { nome: "Limonada suíça", precos: [p(1400)] },
            { nome: "Cerveja artesanal IPA", precos: [p(2400)] },
            { nome: "Água", precos: [p(500)] },
          ],
        },
      ],
    ],
  },
  {
    id: "sushi",
    nome: "Sushi Hanami",
    subtitulo: "Cozinha japonesa contemporânea",
    culinaria: "Japonesa",
    faixaPreco: "$$$",
    paginas: [
      [
        {
          titulo: "Entradas",
          categoria: "entrada",
          linhas: [
            { nome: "Gyoza", desc: "6 unidades", precos: [p(3200)] },
            { nome: "Sunomono", precos: [p(1800)] },
            { nome: "Missoshiru", precos: [p(1400)] },
            { nome: "Harumaki de legumes", desc: "4 unidades", precos: [p(2400)] },
          ],
        },
        {
          titulo: "Sushis e sashimis",
          categoria: "prato",
          linhas: [
            { nome: "Combinado Hanami", desc: "30 peças", precos: [p(13900)] },
            { nome: "Combinado do chef", desc: "15 peças", precos: [p(7900)] },
            { nome: "Sashimi de salmão", desc: "10 fatias", precos: [p(5800)] },
            { nome: "Uramaki filadélfia", desc: "8 unidades", precos: [p(3600)] },
          ],
        },
      ],
      [
        {
          titulo: "Temakis",
          categoria: "prato",
          linhas: [
            { nome: "Temaki de salmão", precos: [p(3400)] },
            { nome: "Temaki skin", precos: [p(2800)] },
          ],
        },
        {
          titulo: "Para dividir",
          categoria: "porcao",
          linhas: [
            { nome: "Hot roll", desc: "10 unidades", precos: [p(3900)] },
            { nome: "Ceviche de peixe branco", precos: [p(4600)] },
          ],
        },
        {
          titulo: "Sobremesas",
          categoria: "sobremesa",
          linhas: [
            { nome: "Harumaki de banana com sorvete", precos: [p(2600)] },
            { nome: "Mochi de morango", precos: [p(1800)] },
          ],
        },
        {
          titulo: "Bebidas",
          categoria: "bebida",
          linhas: [
            { nome: "Chá verde gelado", precos: [p(1200)] },
            { nome: "Saquê", desc: "dose", precos: [p(2200)] },
            { nome: "Refrigerante lata", precos: [p(750)] },
            { nome: "Água", precos: [p(550)] },
          ],
        },
      ],
    ],
  },
];

/** Gabarito: cada preço de cada linha vira um item ("Chopp claro 300 ml"). */
export function gabarito(c: Cardapio): GabaritoItem[] {
  return c.paginas.flat().flatMap((s) =>
    s.linhas.flatMap((l) => l.precos.map((pr) => ({ categoria: s.categoria, nome: pr.rotulo ? `${l.nome} ${pr.rotulo}` : l.nome, precoCentavos: pr.centavos }))),
  );
}

export const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
