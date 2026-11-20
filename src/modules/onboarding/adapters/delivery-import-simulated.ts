/**
 * "Importar do delivery (simulado)" (espec. 3.2, D21): em produção viria do cardápio de delivery do Portal;
 * aqui devolve um cardápio fictício fixo, rotulado como simulado. Não integra com o iFood (o case proíbe
 * dados reais/internos).
 */
import type { CleanExtraction } from "../domain/menu-extraction";

export const DELIVERY_IMPORT: CleanExtraction = {
  ehCardapio: true,
  culinaria: "Pizzaria",
  faixaPreco: "$$",
  parcial: false,
  itens: [
    { categoria: "entrada", nome: "Pão de alho", precoCentavos: 1900, confira: false },
    { categoria: "porcao", nome: "Calabresa acebolada", precoCentavos: 3400, confira: false },
    { categoria: "porcao", nome: "Batata frita", precoCentavos: 2600, confira: false },
    { categoria: "prato", nome: "Pizza margherita", precoCentavos: 5900, confira: false },
    { categoria: "prato", nome: "Pizza calabresa", precoCentavos: 5600, confira: false },
    { categoria: "prato", nome: "Pizza 4 queijos", precoCentavos: 6400, confira: false },
    { categoria: "prato", nome: "Pizza portuguesa", precoCentavos: 6200, confira: false },
    { categoria: "sobremesa", nome: "Pizza de chocolate", precoCentavos: 4800, confira: false },
    { categoria: "sobremesa", nome: "Petit gâteau", precoCentavos: 2400, confira: false },
    { categoria: "bebida", nome: "Refrigerante 2 l", precoCentavos: 1500, confira: false },
    { categoria: "bebida", nome: "Suco natural", precoCentavos: 1100, confira: false },
  ],
};
