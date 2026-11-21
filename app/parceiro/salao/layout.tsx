import type { ReactNode } from "react";
import { PortalShell } from "@/src/ui/components/PortalShell";
import { AccountFooter } from "@/src/ui/portal/AccountFooter";
import { PortalNav } from "@/src/ui/portal/PortalNav";
import { StoreBox } from "@/src/ui/portal/StoreBox";
import { openNow, requireOwner, storeLabel } from "@/src/web/portal-context";

export const dynamic = "force-dynamic";

export default async function SalaoLayout({ children }: { children: ReactNode }) {
  const s = await requireOwner();
  const cur = s.current;
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
      footer={<AccountFooter hint={s.owner.emailHint ?? "conta"} />}
    >
      {children}
    </PortalShell>
  );
}
