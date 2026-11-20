import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/src/web/owner-session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal do Parceiro · entrar" };

export default async function EntrarPage() {
  if (await getOwnerSession()) redirect("/parceiro/salao");
  return (
    <main className="flex min-h-[calc(100dvh-1.5rem)] items-start justify-center bg-page px-4 py-10 sm:items-center">
      <LoginForm />
    </main>
  );
}
