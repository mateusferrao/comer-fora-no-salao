import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/src/web/owner-session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal do Parceiro · entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  if (await getOwnerSession()) redirect("/parceiro/salao");
  const fromApp = (await searchParams).de === "app";
  return (
    <main className="flex min-h-[calc(100dvh-1.5rem)] flex-col items-center justify-start gap-4 bg-page px-4 py-10 sm:justify-center">
      {fromApp && (
        <p role="status" className="max-w-md rounded-sm border border-border bg-white p-3 text-sm text-ink" data-testid="aviso-trocar-lado">
          Para ver o lado do dono, entre no Portal (demo): use seu e-mail ou o link de avaliação.
        </p>
      )}
      <LoginForm />
    </main>
  );
}
