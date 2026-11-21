/**
 * Esqueleto da área de conteúdo do Portal (ajuste de 21/11): ao tocar num item do menu, a tela nova aparece na hora
 * (a casca e o menu continuam montados) e o conteúdo real entra quando o servidor responde. Sem isso, o Next
 * mantinha a tela antiga até a nova chegar inteira.
 */
export default function Loading() {
  const block = "rounded-sm bg-surface-muted motion-safe:animate-pulse";
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8" aria-busy="true" data-testid="carregando">
      <h1 className="sr-only">Carregando…</h1>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className={`${block} h-8 w-56`} />
        <div className={`${block} h-4 w-80 max-w-full`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-24`} />
        ))}
      </div>
      <div className={`${block} h-64`} aria-hidden="true" />
    </main>
  );
}
