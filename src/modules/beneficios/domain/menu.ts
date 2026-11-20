/** Cardápio do salão (itens e preços em centavos). Categorias fixas [C] — planejamento S1 §4.2. */
export const MENU_CATEGORIES = ["entrada", "prato", "porcao", "sobremesa", "bebida"] as const;
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

export type MenuItem = { id: string; category: MenuCategory; name: string; priceCents: number };

export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  entrada: "Entradas",
  prato: "Pratos",
  porcao: "Porções",
  sobremesa: "Sobremesas",
  bebida: "Bebidas",
};

export function findItem(menu: readonly MenuItem[], id: string): MenuItem | undefined {
  return menu.find((i) => i.id === id);
}

/** Preço médio do cardápio (centavos, arredondado). */
export function averagePriceCents(menu: readonly MenuItem[]): number {
  if (menu.length === 0) return 0;
  return Math.round(menu.reduce((s, i) => s + i.priceCents, 0) / menu.length);
}
