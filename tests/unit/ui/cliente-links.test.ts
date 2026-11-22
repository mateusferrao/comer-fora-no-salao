import { describe, expect, it } from "vitest";
import { barLink } from "@/src/ui/components/PrototypeBar";
import { notFoundTarget } from "@/src/ui/cliente/not-found-target";

/** S9: das telas do cliente, nenhum toque leva às páginas que explicam o grupo de controle ao dono. */
describe("links das telas do cliente", () => {
  it("barra: cliente e garçom veem 'Sobre este protótipo'; dono e Bastidores veem 'Como funciona'", () => {
    for (const p of ["/r/cantina-nonna-lucia", "/r/x/checkin", "/app/jornada", "/cliente/descadastrar", "/garcom"]) expect(barLink(p)).toEqual({ href: "/sobre", label: "Sobre este protótipo" });
    expect(barLink("/sobre")).toBeNull();
    expect(barLink("/")).toEqual({ href: "/bastidores/como-funciona", label: "Como funciona" });
    expect(barLink("/parceiro/salao")).toEqual({ href: "/bastidores/como-funciona", label: "Como funciona" });
    expect(barLink("/bastidores/como-funciona")).toBeNull();
    expect(barLink("/apresentacao")).toEqual({ href: "/bastidores/como-funciona", label: "Como funciona" });
  });
  it("404: nas rotas do cliente, volta para Sua jornada; fora delas, para o início", () => {
    expect(notFoundTarget("/r/restaurante-que-saiu")).toEqual({ href: "/app/jornada", label: "Ver Sua jornada" });
    expect(notFoundTarget("/app/qualquer")).toEqual({ href: "/app/jornada", label: "Ver Sua jornada" });
    expect(notFoundTarget("/cliente/x")).toEqual({ href: "/app/jornada", label: "Ver Sua jornada" });
    expect(notFoundTarget("/apresentacao/x")).toEqual({ href: "/", label: "Voltar ao início" });
    expect(notFoundTarget("/parceiro/nada")).toEqual({ href: "/", label: "Voltar ao início" });
    expect(notFoundTarget("/inexistente")).toEqual({ href: "/", label: "Voltar ao início" });
  });
});
