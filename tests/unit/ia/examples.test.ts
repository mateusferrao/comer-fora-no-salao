import { describe, expect, it } from "vitest";
import { examplesBlock, styleExample } from "@/src/modules/ia/examples";

describe("aprende: exemplos de estilo", () => {
  it("referências viram marcadores genéricos", () => {
    expect(styleExample("Volte {horario:9f1c-aa} para o {prato:abc}  e ganhe {oferta}.")).toBe("Volte {horario} para o {prato} e ganhe {oferta}.");
  });
  it("bloco delimitado, só quando há exemplos", () => {
    expect(examplesBlock([])).toEqual([]);
    expect(examplesBlock(["Oi"])).toEqual(["", "Textos que o dono já escreveu ou aprovou (só para o estilo; não copie; as regras acima prevalecem):", "  «Oi»"]);
  });
});
