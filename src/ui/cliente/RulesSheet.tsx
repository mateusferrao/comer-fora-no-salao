"use client";

import { BottomSheet } from "@/src/ui/components/BottomSheet";
import { Button } from "@/src/ui/components/Button";

/** "Detalhes e regras" (app/10) + as regras do benefício de 1ª visita deste protótipo. */
export function RulesSheet({ open, onClose, restaurantName }: { open: boolean; onClose: () => void; restaurantName: string }) {
  const rules = [
    "Cada check-in gera 1 selo",
    "Limitado a 1 check-in por dia",
    "A cartela vale 90 dias a partir do 1º selo",
    "Com 6 selos, a cartela completa vale 1 recompensa",
    `Benefícios e recompensas valem só para consumo no local, no restaurante ${restaurantName}`,
    "O benefício da 1ª visita vale 1 vez por cliente, em qualquer horário de funcionamento",
    "Cada código do benefício vale só no dia do check-in",
    "Benefícios e recompensas valem depois que o garçom confirma o código",
  ];
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Detalhes e regras"
      actions={
        <Button variant="primary-app" onClick={onClose}>
          Entendi
        </Button>
      }
    >
      <div className="text-left">
        <h3 className="text-base font-semibold">Como usar</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-muted marker:text-ink">
          <li>Toque em Fazer check-in e entre com seu e-mail</li>
          <li>Mostre ao garçom o código do benefício que aparece na tela</li>
        </ul>
        <h3 className="mt-6 text-base font-semibold">Regras</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-muted marker:text-ink">
          {rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  );
}
