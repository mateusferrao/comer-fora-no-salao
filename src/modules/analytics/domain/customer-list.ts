/**
 * Lista de clientes de um grupo (ajuste de 21/11): todos, 20 por página, busca por nome e ordenação por coluna.
 * Puro: a busca é sobre o nome mostrado (primeiro nome + inicial, D106) — buscar pelo sobrenome revelaria o que a
 * tela esconde.
 */
export const PAGE_SIZE = 20;
export const SORT_KEYS = ["cliente", "primeira", "ultima", "selos", "peca", "optin"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";
export type ListQuery = { q: string; sort: SortKey; dir: SortDir; page: number };
export const DEFAULT_QUERY: ListQuery = { q: "", sort: "ultima", dir: "desc", page: 1 };

type Listable = { displayName: string; firstDay: string | null; lastDay: string | null; stamps: number; piece: string | null; optIn: { email: boolean; app: boolean } };

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
const optInRank = (c: Listable) => (c.optIn.email ? 2 : 0) + (c.optIn.app ? 1 : 0);

function compare(a: Listable, b: Listable, key: SortKey): number {
  switch (key) {
    case "cliente":
      return collator.compare(a.displayName, b.displayName);
    case "primeira":
      return (a.firstDay ?? "").localeCompare(b.firstDay ?? "");
    case "ultima":
      return (a.lastDay ?? "").localeCompare(b.lastDay ?? "");
    case "selos":
      return a.stamps - b.stamps;
    case "peca":
      // Sem peça vai para o fim nas 2 direções.
      return a.piece === b.piece ? 0 : a.piece === null ? 1 : b.piece === null ? -1 : collator.compare(a.piece, b.piece);
    case "optin":
      return optInRank(a) - optInRank(b);
  }
}

/** Filtra, ordena (desempate pelo nome) e corta a página pedida (fora do intervalo → a mais próxima). */
export function listPage<T extends Listable>(rows: readonly T[], query: ListQuery, size = PAGE_SIZE): { items: T[]; total: number; page: number; pages: number } {
  const q = normalize(query.q);
  const found = q ? rows.filter((r) => normalize(r.displayName).includes(q)) : [...rows];
  const sign = query.dir === "asc" ? 1 : -1;
  found.sort((a, b) => {
    const c = compare(a, b, query.sort);
    if (c !== 0) return query.sort === "peca" && (a.piece === null || b.piece === null) ? c : sign * c;
    return collator.compare(a.displayName, b.displayName);
  });
  const pages = Math.max(1, Math.ceil(found.length / size));
  const page = Math.min(Math.max(1, Math.floor(query.page) || 1), pages);
  return { items: found.slice((page - 1) * size, page * size), total: found.length, page, pages };
}

/** Lê a query da URL; valor inválido volta ao padrão. */
export function parseListQuery(sp: { q?: string; ordem?: string; dir?: string; pagina?: string }): ListQuery {
  const sort = (SORT_KEYS as readonly string[]).includes(sp.ordem ?? "") ? (sp.ordem as SortKey) : DEFAULT_QUERY.sort;
  const dir: SortDir = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : sort === "cliente" || sort === "peca" ? "asc" : "desc";
  const page = Number.parseInt(sp.pagina ?? "1", 10);
  return { q: (sp.q ?? "").slice(0, 60), sort, dir, page: Number.isFinite(page) && page > 0 ? page : 1 };
}
