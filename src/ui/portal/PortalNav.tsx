"use client";

import { usePathname } from "next/navigation";
import { Badge } from "../components/Badge";
import { NavItem } from "../components/NavItem";

type Props = { showActivation: boolean };

/** Ícones de traço (como na barra lateral do Portal — portal/02), 20 px, cor do texto. */
const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICON = {
  geral: <I d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  ativar: <I d="M5 12l4 4L19 6" />,
  plano: <I d="M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />,
  kit: <I d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v7M14 20h3" />,
  clientes: <I d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  validar: <I d="M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
  config: <I d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />,
};


/** Seção "Comer Fora no salão" da barra lateral (selo "Novo" — espec. 3.1). Só itens que funcionam (D130). */
export function PortalNav({ showActivation }: Props) {
  const path = usePathname() ?? "";
  const is = (href: string, exact = false) => (exact ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <div>
      <p className="flex items-center gap-2 px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Comer Fora no salão <Badge tone="outline-red">Novo</Badge>
      </p>
      <ul className="flex flex-col gap-1">
        <li>
          <NavItem icon={ICON.geral} href="/parceiro/salao" active={is("/parceiro/salao", true)}>
            Visão geral
          </NavItem>
        </li>
        {showActivation && (
          <li>
            <NavItem icon={ICON.ativar} href="/parceiro/salao/ativar" active={is("/parceiro/salao/ativar")}>
              Ativação
            </NavItem>
          </li>
        )}
        {!showActivation && (
          <li>
            <NavItem icon={ICON.plano} href="/parceiro/salao/plano" active={is("/parceiro/salao/plano")}>
              Plano da semana
            </NavItem>
          </li>
        )}
        <li>
          <NavItem icon={ICON.kit} href="/parceiro/salao/kit" active={is("/parceiro/salao/kit")}>
            Kit de divulgação
          </NavItem>
        </li>
        <li>
          <NavItem icon={ICON.clientes} href="/parceiro/salao/clientes" active={is("/parceiro/salao/clientes")}>
            Clientes
          </NavItem>
        </li>
        <li>
          <NavItem icon={ICON.validar} href="/parceiro/salao/validar" active={is("/parceiro/salao/validar")}>
            Validar código
          </NavItem>
        </li>
        <li>
          <NavItem icon={ICON.config} href="/parceiro/salao/configuracoes" active={is("/parceiro/salao/configuracoes")}>
            Configurações
          </NavItem>
        </li>
      </ul>
    </div>
  );
}
