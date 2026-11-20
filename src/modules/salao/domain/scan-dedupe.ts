/** Leituras do QR por beacon (D49): mesmo aparelho + mesma versão em 30 min = 1; robôs de prévia ignorados. */
export const SCAN_DEDUPE_MS = 30 * 60_000;

const BOT = /(whatsapp|facebookexternalhit|facebot|slackbot|telegrambot|twitterbot|linkedinbot|discordbot|googlebot|bingbot|applebot|embedly|skypeuripreview|pinterest|redditbot|vkshare|preview)/i;

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT.test(userAgent);
}

export function shouldCountScan(lastScanAt: Date | null, at: Date): boolean {
  return lastScanAt === null || at.getTime() - lastScanAt.getTime() >= SCAN_DEDUPE_MS;
}
