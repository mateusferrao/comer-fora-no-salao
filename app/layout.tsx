import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/wght.css";
import "./globals.css";
import { PrototypeBar } from "@/src/ui/components/PrototypeBar";

export const metadata: Metadata = {
  title: "Comer Fora no Salão · protótipo de case",
  description: "Protótipo de case. Não é produto oficial do iFood. Dados fictícios.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh font-sans antialiased">
        <PrototypeBar />
        {children}
      </body>
    </html>
  );
}
