import { decryptEmail } from "@/src/shared/crypto";
import type { ReactNode } from "react";
import { PortalShell } from "@/src/ui/components/PortalShell";
import { AccountFooter } from "@/src/ui/portal/AccountFooter";
import { PortalNav } from "@/src/ui/portal/PortalNav";
import { StoreBox } from "@/src/ui/portal/StoreBox";
import { openNow, requireOwner, storeLabel } from "@/src/web/portal-context";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";
import { loadContext } from "@/src/modules/salao/application/context";
import { slotAliases, slotLabel } from "@/src/modules/beneficios/domain/slot-text";
import { Copilot } from "@/src/ui/portal/copiloto/Copilot";

/** Chips do assistente por tela (S8): texto do código, com o horário vazio principal do restaurante. */
async function copilotChips(restaurantId: string): Promise<Record<string, string[]>> {
  const ctx = await loadContext(getDb(), restaurantId);
  const first = ctx ? slotAliases(ctx.slots)[0]?.slot : undefined;
  const trocar = first ? `Trocar a oferta do convite de ${slotLabel(first)}` : "Trocar a oferta de um convite";
  return {
    painel: ["Como foi a semana?", "Quem está perto da recompensa?", trocar],
    configuracoes: [trocar, "Tirar um prato das ofertas", "Mudar o teto de um horário"],
    plano: ["O que o plano está propondo?", trocar, "O que é o grupo de controle?"],
    clientes: ["Quem está perto da recompensa?", "Quem sumiu?"],
    kit: ["O que é o teto de convites?", "Como o QR conta as leituras?"],
    validar: ["Como o garçom valida o código?"],
  };
}

export const dynamic = "force-dynamic";

export default async function SalaoLayout({ children }: { children: ReactNode }) {
  const s = await requireOwner();
  const cur = s.current;
  const assistant = cur?.status === "ativo" && (await getFlags(getDb())).copiloto ? <Copilot chips={await copilotChips(cur.id)} /> : undefined;
  return (
    <PortalShell
      mobileTitle={cur?.name}
      top={
        <StoreBox
          name={cur?.name ?? null}
          open={cur ? openNow(cur.openingHours, new Date()) : null}
          currentId={cur?.id ?? null}
          stores={s.restaurants.map((r) => ({ id: r.id, name: r.name, label: storeLabel(r) }))}
        />
      }
      nav={<PortalNav showActivation={cur?.kind === "teste" && cur.status !== "ativo"} />}
      assistant={assistant}
      footer={<AccountFooter hint={decryptEmail(s.owner.emailEnc) ?? s.owner.emailHint ?? "conta"} />}
    >
      {children}
    </PortalShell>
  );
}
