import type { Metadata } from "next";
import { Galeria } from "./Galeria";

export const metadata: Metadata = { title: "Componentes · Comer Fora no Salão" };

const CABECALHO = "Base do design system · tokens medidos em prints de referência";

export default function ComponentesPage() {
  return <Galeria cabecalho={CABECALHO} />;
}
