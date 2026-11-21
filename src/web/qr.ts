import QRCode from "qrcode";

/** QR em SVG (gerado pelo código, sem conteúdo de usuário) como data URI para <img>. */
export async function qrDataUri(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#151515", light: "#ffffff" } });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function publicBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL || "https://sites-case-salao-app.lyv8st.easypanel.host";
}
