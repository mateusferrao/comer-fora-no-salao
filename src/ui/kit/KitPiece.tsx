import { INVITE_LINE } from "@/src/modules/kit/domain/templates";

type Texts = { titulo: string; subtitulo: string; acao: string };
const SIZE = { display: { w: 148, h: 210, qr: 58, title: 9.5, name: 7, brand: 9.5 }, cartaz: { w: 210, h: 297, qr: 82, title: 13.5, name: 10, brand: 13.5 } } as const;

/**
 * Display (A5 = meia A4) e cartaz (A4): um único modelo visual em 2 tamanhos (D41), com o QR da versão (≥ 3 cm),
 * a marca do restaurante em destaque (H5) e só o logo padrão do iFood (D81). Sem fotos.
 */
export function KitPiece({ kind, restaurantName, texts, qrSrc, versionLabel }: { kind: "display" | "cartaz"; restaurantName: string; texts: Texts; qrSrc: string; versionLabel: string }) {
  const s = SIZE[kind];
  const mm = (v: number) => `${v}mm`;
  return (
    <div
      className="flex flex-col items-center bg-white text-center text-ink"
      style={{ width: mm(s.w), height: mm(s.h), padding: mm(s.w * 0.07), boxSizing: "border-box", fontFamily: "var(--font-sans)" }}
      data-peca={kind}
    >
      <p className="font-extrabold leading-tight" style={{ fontSize: mm(s.brand) }}>
        {restaurantName}
      </p>
      <div className="mt-[3%] w-full rounded-[3mm] bg-red-button px-[4%] py-[3%] text-white">
        <p className="font-bold leading-tight" style={{ fontSize: mm(s.title) }}>
          {texts.titulo}
        </p>
      </div>
      <p className="mt-[3%] leading-snug" style={{ fontSize: mm(s.name * 0.62) }}>
        {texts.subtitulo}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrSrc} alt={`QR da versão ${versionLabel}`} style={{ width: mm(s.qr), height: mm(s.qr), marginTop: mm(s.w * 0.04) }} />
      <p className="mt-[2%] font-semibold" style={{ fontSize: mm(s.name * 0.62) }}>
        {texts.acao}
      </p>
      <p className="mt-auto leading-snug text-ink-muted" style={{ fontSize: mm(s.name * 0.5) }}>
        {INVITE_LINE}
      </p>
      <div className="mt-[2%] flex w-full items-center justify-between" style={{ fontSize: mm(s.name * 0.42) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ifood.svg" alt="iFood" style={{ height: mm(s.name * 0.9) }} />
        <span className="text-ink-muted">
          Comer Fora · versão {versionLabel} · <span data-testid="rodape-prototipo">Protótipo de case · não é produto oficial do iFood</span>
        </span>
      </div>
    </div>
  );
}

/** Cartão do garçom (¼ de A4, sem QR): roteiro de ≤ 2 frases só sobre o "agora" (espec. 3.4). */
export function WaiterCard({ restaurantName, frase }: { restaurantName: string; frase: string }) {
  return (
    <div className="flex flex-col bg-white text-left text-ink" style={{ width: "105mm", height: "148.5mm", padding: "8mm", boxSizing: "border-box", border: "0.3mm dashed #999" }} data-peca="garcom">
      <p className="font-bold" style={{ fontSize: "6mm" }}>
        {restaurantName}
      </p>
      <p className="mt-[3mm] font-semibold text-red-text" style={{ fontSize: "3.6mm" }}>
        Roteiro do garçom
      </p>
      <p className="mt-[4mm] leading-snug" style={{ fontSize: "5mm" }}>
        {frase}
      </p>
      <p className="mt-auto text-ink-muted" style={{ fontSize: "3mm" }}>
        Validar: Portal do Parceiro › Comer Fora no salão › Validar código
      </p>
    </div>
  );
}
