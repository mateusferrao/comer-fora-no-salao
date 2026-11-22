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
  // Revisão S8 (E2E com IA real): sem o prato, a IA pergunta qual; com um prato válido e fora de uso, vira cartão.
  const cur = first && ctx ? ctx.convites[first.id]?.offer.params.itemId : undefined;
  const inUse = new Set([ctx?.agora?.offer.params.itemId, ctx?.recompensa?.offer.params.itemId, ...Object.values(ctx?.convites ?? {}).map((v) => v.offer.params.itemId)]);
  const curCat = ctx?.menu.find((m) => m.id === cur)?.category;
  const free = (ctx?.menu ?? []).filter((m) => !inUse.has(m.id) && !ctx!.inactiveItemIds.includes(m.id) && !ctx!.noOfferItemIds.includes(m.id));
  const alt = free.find((m) => m.category === curCat) ?? free.find((m) => m.category === "sobremesa");
  const trocar = first ? `Trocar a oferta do convite de ${slotLabel(first)}${alt ? ` por ${alt.name}` : ""}` : "Trocar a oferta de um convite";
  return {
    painel: ["Como foi a semana?", "Quem está perto da recompensa?", trocar],
    // "…" no fim: o chip só preenche o campo para o dono completar (revisão S8, produto 7).
    configuracoes: [trocar, "Tirar das ofertas o prato…", first ? `Mudar o teto do convite de ${slotLabel(first)} para…` : "Mudar o teto de um horário para…"],
    plano: ["O que o plano da semana sugere?", trocar, "Por que 1 em cada 10 fica sem convite?"],
    clientes: ["Quem está perto da recompensa?", "Quem sumiu?"],
    kit: ["O que é o teto de convites?", "Como o QR conta as leituras?"],
    validar: ["Como o garçom valida o código?"],
  };
}

export const dynamic = "force-dynamic";

export default async function SalaoLayout({ children }: { children: ReactNode }) {
  const s = await requireOwner();
  const cur = s.current;
  // S8: restaurante ativo → copiloto completo; em ativação (D265) → só dúvidas.
  const assistant = cur && (await getFlags(getDb())).copiloto ? <Copilot scope={`${s.owner.id}:${cur.id}`} chips={cur.status === "ativo" ? await copilotChips(cur.id) : { ativar: ["O que é o horário vazio?", "Preciso informar a margem?", "O que é o teto de convites?"] }} /> : undefined;
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
