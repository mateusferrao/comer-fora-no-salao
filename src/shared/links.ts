/** S7 (D322): links públicos do case, usados pelas páginas que explicam o protótipo. */
export const REPO_URL = "https://github.com/mateusferrao/comer-fora-no-salao";

/** Link para um arquivo do repositório público (caminho relativo à raiz, sem barra inicial). */
export function repoFile(path: string): string {
  return `${REPO_URL}/blob/main/${path}`;
}
