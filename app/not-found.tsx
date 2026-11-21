import Link from "next/link";
import { Logo } from "@/src/ui/components/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo height={40} />
      <h1 className="text-xl font-semibold leading-7">Página não encontrada</h1>
      <p className="text-sm leading-5 text-ink-muted">O endereço pode estar errado ou a página ainda não existe neste protótipo.</p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-12 items-center justify-center rounded-md bg-ink px-6 text-base font-medium text-white hover:bg-black"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
