import Image from "next/image";

type Props = { height?: number; className?: string };

/** Logo padrão do iFood (D81), SVG público do Wikimedia Commons (File:IFood_logo.svg; fonte registrada em docs/fatias/S0/planejamento.md §12). viewBox 1004×530,58. */
export function Logo({ height = 32, className }: Props) {
  const width = Math.round((height * 1004) / 530.58);
  return <Image src="/logo-ifood.svg" alt="iFood" width={width} height={height} className={className} unoptimized priority />;
}
