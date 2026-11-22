"use client";

import { useState, type ReactNode } from "react";
import { AppShell } from "@/src/ui/components/AppShell";
import { Badge } from "@/src/ui/components/Badge";
import { BottomSheet } from "@/src/ui/components/BottomSheet";
import { Button } from "@/src/ui/components/Button";
import { Chip } from "@/src/ui/components/Chip";
import { PortalShell } from "@/src/ui/components/PortalShell";
import { Select } from "@/src/ui/components/Select";
import { Tabs } from "@/src/ui/components/Tabs";
import { COLORS } from "@/src/ui/tokens";

const SECOES = [
  { id: "tokens", titulo: "Tokens" },
  { id: "button", titulo: "Botões" },
  { id: "tabs", titulo: "Abas" },
  { id: "chip", titulo: "Chips" },
  { id: "select", titulo: "Seletor" },
  { id: "badge", titulo: "Selos" },
  { id: "bottom-sheet", titulo: "Painel inferior" },
  { id: "app-shell", titulo: "Casca do App" },
  { id: "portal-shell", titulo: "Casca do Portal" },
] as const;

const CORES: Array<[string, string]> = [
  ["ink", COLORS.ink],
  ["ink-muted", COLORS.inkMuted],
  ["surface-muted", COLORS.surfaceMuted],
  ["sheet", COLORS.sheet],
  ["page", COLORS.page],
  ["border", COLORS.border],
  ["divider", COLORS.divider],
  ["red-button", COLORS.redButton],
  ["red-brand", COLORS.redBrand],
  ["red-text", COLORS.redText],
  ["red-chart", COLORS.redChart],
  ["green", COLORS.green],
];

function Secao({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} data-testid={`demo-${id}`} aria-labelledby={`${id}-titulo`} className="scroll-mt-12 border-t border-divider py-8">
      <h2 id={`${id}-titulo`} className="mb-4 text-lg font-semibold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Nav() {
  return (
    <ul className="space-y-1">
      {SECOES.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-ink hover:bg-surface-muted">
            {s.titulo}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Galeria({ cabecalho }: { cabecalho: string }) {
  const [aba, setAba] = useState("beneficios");
  const [sheet, setSheet] = useState(false);
  const [confirmacao, setConfirmacao] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [oferta, setOferta] = useState("cannoli");
  const simularCarregamento = () => {
    setCarregando(true);
    setTimeout(() => setCarregando(false), 1_500);
  };

  return (
    <PortalShell nav={<Nav />}>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
        <h1 className="mb-6 text-2xl font-semibold leading-8">{cabecalho}</h1>

        <Secao id="tokens" titulo="Tokens">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {CORES.map(([nome, hex]) => (
              <li key={nome} className="rounded-md border border-border p-2">
                <div aria-hidden="true" className="h-10 rounded-sm border border-border" style={{ background: hex }} />
                <p className="mt-2 text-xs font-medium">{nome}</p>
                <p className="text-xs text-ink-muted">{hex}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-muted">Fonte: Inter (hospedada no próprio site). Raios: 4 · 8 · 12 · 16 · 24 · painel inferior 56.</p>
        </Secao>

        <Secao id="button" titulo="Botões">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary-app">Primário do app</Button>
            <Button variant="secondary-app">Secundário do app</Button>
            <Button variant="primary-portal">Primário do Portal</Button>
            <Button variant="outline-portal">Contorno do Portal</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="primary-app" disabled>
              Desabilitado
            </Button>
            <Button variant="primary-app" loading>
              Carregando
            </Button>
            <Button variant="primary-portal" loading>
              Carregando
            </Button>
            <Button variant="outline-app" loading={carregando} onClick={simularCarregamento}>
              Simular carregamento
            </Button>
          </div>
        </Secao>

        <Secao id="tabs" titulo="Abas">
          <Tabs
            label="Exemplo de abas"
            value={aba}
            onValueChange={setAba}
            items={[
              { id: "beneficios", label: "Benefícios", content: <p className="text-sm text-ink-muted">Conteúdo da aba Benefícios.</p> },
              { id: "sobre", label: "Sobre", content: <p className="text-sm text-ink-muted">Conteúdo da aba Sobre.</p> },
            ]}
          />
        </Secao>

        <Secao id="chip" titulo="Chips">
          <div className="flex flex-wrap gap-2">
            <Chip>Ter, Qua</Chip>
            <Chip>Noturno</Chip>
          </div>
        </Secao>

        <Secao id="select" titulo="Seletor">
          <div className="max-w-sm">
            <Select
              label="Oferta"
              value={oferta}
              onChange={setOferta}
              options={[
                { value: "cannoli", label: "Cannoli grátis", hint: "Doce grátis · custo R$ 8 · melhor nota" },
                { value: "panna", label: "Panna cotta grátis", hint: "Doce grátis · custo R$ 6" },
                { value: "tiramisu", label: "Tiramisù grátis", hint: "Doce grátis · custo R$ 9" },
                { value: "esgotado", label: "Gelato grátis", hint: "Fora das ofertas", disabled: true },
              ]}
            />
          </div>
          <p className="mt-2 text-sm text-ink-muted" data-testid="select-valor">
            Escolhido: {oferta}
          </p>
        </Secao>

        <Secao id="badge" titulo="Selos">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Neutro</Badge>
            <Badge tone="red">Vermelho</Badge>
            <Badge tone="green">Verde</Badge>
          </div>
        </Secao>

        <Secao id="bottom-sheet" titulo="Painel inferior">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary-app" onClick={() => setSheet(true)}>
              Abrir painel inferior
            </Button>
            <Button variant="secondary-app" onClick={() => setConfirmacao(true)}>
              Abrir confirmação
            </Button>
          </div>
          <BottomSheet
            open={sheet}
            onClose={() => setSheet(false)}
            title="Parece que você não está no restaurante"
            actions={
              <>
                <Button variant="outline-app" onClick={() => setSheet(false)}>
                  Fechar
                </Button>
                <Button variant="primary-app" onClick={() => setSheet(false)}>
                  Confirmar localização
                </Button>
              </>
            }
            description="O GPS pode não ser preciso. Se você já está no restaurante, confirme abaixo para tentarmos validar seu benefício novamente."
          />
          <BottomSheet
            open={confirmacao}
            onClose={() => setConfirmacao(false)}
            dismissible={false}
            title="Confirmar a ação?"
            description="Exemplo de confirmação: o toque no fundo não fecha; use os botões ou Esc."
            actions={
              <>
                <Button variant="outline-app" onClick={() => setConfirmacao(false)}>
                  Cancelar
                </Button>
                <Button variant="primary-app" onClick={() => setConfirmacao(false)}>
                  Confirmar
                </Button>
              </>
            }
          />
        </Secao>

        <Secao id="app-shell" titulo="Casca do App">
          <AppShell fullHeight={false} className="overflow-hidden rounded-md border border-border py-6">
            <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-ink-muted">
              Coluna de até 420 px; fora dela, fundo cinza neutro.
            </div>
          </AppShell>
        </Secao>

        <Secao id="portal-shell" titulo="Casca do Portal">
          <p className="text-sm text-ink-muted">
            Esta página usa a casca do Portal: menu lateral fixo a partir de 1024 px; abaixo disso, gaveta aberta pelo botão de menu.
          </p>
        </Secao>
      </main>
    </PortalShell>
  );
}
