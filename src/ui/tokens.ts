/**
 * Espelho em TS das cores de `tokens.css` (para o teste de contraste e para usos fora do CSS).
 * O teste `tokens.ts × tokens.css` garante que os dois ficam em sincronia.
 */
export const COLORS = {
  white: "#FFFFFF",
  ink: "#151515",
  inkMuted: "#666666",
  surfaceMuted: "#F5F5F5",
  sheet: "#FAFAFA",
  page: "#F2F2F2",
  border: "#EBEBEB",
  divider: "#E0E0E0",
  handle: "#D8D8D8",
  redButton: "#E71C2B",
  redBrand: "#EA1D2C",
  redText: "#D72E3B",
  redChart: "#EF5652",
  navActive: "#FEF6F7",
  green: "#52AA6E",
  protoBg: "#2B2B2B",
  protoFg: "#FFFFFF",
} as const;
