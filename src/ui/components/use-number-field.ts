"use client";

import { useState } from "react";

/**
 * Campo numérico que aceita ficar vazio enquanto o dono digita (revisão da S2: `Number(v) || 1` punha 1 ao
 * apagar, e "20" virava "120"). Só repassa valores válidos; ao sair do campo, volta para o último válido.
 */
export function useNumberField(value: number, min: number, max: number, onValue: (n: number) => void) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // Valor mudou por fora (ex.: rascunho carregado): acompanha, ajustando o estado durante a renderização.
  if (seen !== value) {
    setSeen(value);
    if (Number(text) !== value) setText(String(value));
  }
  return {
    value: text,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = e.target.value.replace(/\D/g, "").slice(0, String(max).length);
      setText(t);
      const n = Number(t);
      if (t !== "" && n >= min && n <= max) onValue(n);
    },
    onBlur: () => setText(String(value)),
  };
}
