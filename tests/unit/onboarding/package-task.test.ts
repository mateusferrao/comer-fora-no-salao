import { describe, expect, it } from "vitest";
import { buildCandidates } from "@/src/modules/onboarding/domain/candidates";
import { declaredFacts } from "@/src/modules/onboarding/domain/facts";
import { buildPackagePrompt, buildPackageTask, resolvePackage, type PackageOut } from "@/src/modules/ia/tasks/package";
import type { MenuItem } from "@/src/modules/beneficios/domain/menu";
import type { Slot } from "@/src/modules/beneficios/domain/slots";

const menu: MenuItem[] = [
  { id: "i-gelato", category: "sobremesa", name: "Gelato", priceCents: 1600 },
  { id: "i-cannoli", category: "sobremesa", name: "Cannoli", priceCents: 2200 },
  { id: "i-fritto", category: "porcao", name: "Fritto misto", priceCents: 4800 },
  { id: "i-limonada", category: "bebida", name: "Limonada", priceCents: 1400 },
  { id: "i-nhoque", category: "prato", name: "Nhoque", priceCents: 5200 },
];
const slotT: Slot = { id: "uuid-tarde", days: [2, 3, 4], startMin: 900, endMin: 1080, intensity: "muito", extraTables: 5 };
const slotN: Slot = { id: "uuid-noite", days: [1, 2], startMin: 1260, endMin: 1380, intensity: "um_pouco", extraTables: 3 };
const cands = buildCandidates([slotN, slotT], menu, { ticketCents: 8500, marginPct: 65, exclude: [] });
const pp = buildPackagePrompt({ restaurantName: "Cantina {X}", slots: [slotN, slotT], cands, menu, facts: declaredFacts({ ticketCents: 8500 }, [slotN, slotT], menu) });
const task = buildPackageTask(pp, []);

const good: PackageOut = {
  escolhas: [
    { faixa: "A", candidata: "A1", textoConvite: "Volte {horario:A} e aproveite {oferta}.", justificativa: "A tarde está {fato:faixa_A_intensidade}; algo leve combina com o turno da {fato:faixa_A_turno}." },
    { faixa: "B", candidata: "B2", textoConvite: "Volte {horario:B}: {oferta} para fechar o dia.", justificativa: "Faixa {fato:faixa_B_intensidade}." },
  ],
  ordem: ["A", "B"],
  aprendemos: [],
};

describe("tarefa 3 — pacote com apelidos (revisão T-I2)", () => {
  it("apelidos pela prioridade: A = faixa 'muito vazio'; nada de UUID no prompt; nomes limpos", () => {
    expect(pp.slotByAlias.get("A")!.id).toBe("uuid-tarde");
    expect(pp.text).not.toContain("uuid-");
    expect(pp.text).toContain("Restaurante: Cantina X");
    expect(pp.text).toContain("{fato:ticket_medio} = R$ 85,00");
  });
  it("schema recusa faixa ou candidata fora dos apelidos", () => {
    expect(task.schema.safeParse(good).success).toBe(true);
    expect(task.schema.safeParse({ ...good, escolhas: [{ ...good.escolhas[0]!, candidata: "Z9" }] }).success).toBe(false);
  });
  it("guard: candidata de outra faixa, faixa sem escolha, ordem errada e número no texto reprovam", () => {
    expect(task.guard!(good)).toEqual({ ok: true });
    const bad = task.guard!({ ...good, escolhas: [{ ...good.escolhas[0]!, candidata: "B1", textoConvite: "Ganhe 50% off" }], ordem: ["A"] });
    expect(bad.ok).toBe(false);
    expect(bad.ok === false && bad.reasons).toEqual(expect.arrayContaining(["candidata_fora_da_faixa:B1", "faixa_sem_escolha:B", "ordem_nao_e_permutacao", "textoConvite:numero"]));
  });
  it("resolve apelidos de volta para ids, inclusive dentro dos textos", () => {
    const r = resolvePackage(pp, { ...good, escolhas: [{ ...good.escolhas[0]!, textoConvite: "Volte {horario:A} e peça {prato:p2}." }, good.escolhas[1]!] });
    expect(r[0]).toMatchObject({ slotId: "uuid-tarde", candidateId: cands.find((c) => c.slotId === "uuid-tarde")!.options[0]!.id, textoConvite: "Volte {horario:uuid-tarde} e peça {prato:i-cannoli}." });
  });
});

describe("tarefa 3 — plano da semana: 'o que aprendemos' (D220; S3)", () => {
  const learned = [
    { key: "uuid-tarde:v1", slotId: "uuid-tarde", verdict: "trocar" as const, gain: "um Cannoli grátis", title: "Doce grátis" },
    { key: "uuid-noite:v2", slotId: "uuid-noite", verdict: "cedo_demais" as const, gain: "uma Limonada grátis", title: "Bebida grátis" },
    { key: "uuid-velha:v1", slotId: "uuid-velha", verdict: "manter" as const, gain: "x", title: "x" }, // faixa desativada: fora
  ];
  const ppL = buildPackagePrompt({ restaurantName: "Cantina", slots: [slotN, slotT], cands, menu, facts: { ...declaredFacts({ ticketCents: 8500 }, [slotN, slotT], menu), uso7d_A_pct: 9 }, learned, tone: "descontraído {sem chaves}" });
  const taskL = buildPackageTask(ppL, []);
  const ok: PackageOut = {
    ...good,
    aprendemos: [
      { ofertaKey: "O1", texto: "Só {fato:uso7d_A_pct} dos convites de {horario:A} foram usados: vale trocar a oferta." },
      { ofertaKey: "O2", texto: "Ainda há poucos convites de {horario:B} para julgar {oferta}." },
    ],
  };
  it("prompt traz o veredito do código, o tom delimitado e a regra; o veredito não está no schema", () => {
    expect(ppL.text).toContain("O1: faixa A, Doce grátis — veredito do código: trocar");
    expect(ppL.text).toContain("«descontraído sem chaves»");
    expect(ppL.system).not.toContain("descontraído");
    expect(ppL.system).toContain("Não mude o veredito");
    expect(taskL.name).toBe("plano");
    expect(taskL.schema.safeParse(ok).success).toBe(true);
    expect(taskL.schema.safeParse({ ...ok, aprendemos: [{ ofertaKey: "O9", texto: "x" }] }).success).toBe(false);
  });
  it("guard: falta 1 oferta, oferta repetida e dígito solto reprovam", () => {
    expect((taskL.guard!(ok) as { reasons?: string[] }).reasons ?? []).toEqual([]);
    const bad = taskL.guard!({ ...ok, aprendemos: [ok.aprendemos[0]!, ok.aprendemos[0]!] });
    expect(bad.ok === false && bad.reasons).toEqual(expect.arrayContaining(["aprendemos_invalido:O1", "aprendemos_faltando:O2"]));
    const dig = taskL.guard!({ ...ok, aprendemos: [ok.aprendemos[0]!, { ofertaKey: "O2", texto: "Só 3 convites." }] });
    expect(dig.ok === false && dig.reasons).toContain("aprendemos:numero");
  });
  it("sem ofertas anteriores (1º plano): aprendemos tem de vir vazio", () => {
    expect(task.schema.safeParse({ ...good, aprendemos: [{ ofertaKey: "O1", texto: "x" }] }).success).toBe(false);
  });
});
