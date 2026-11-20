/** GPS não bloqueante (D25): a distância é calculada no navegador; só o status vai ao servidor. */
export const NEAR_METERS = 300;
export const GPS_TIMEOUT_MS = 8_000;
export const MAX_SHOWN_DISTANCE_M = 5_000;

export const GPS_STATUSES = ["perto", "longe", "negado", "sem_suporte", "tempo_esgotado", "confirmado_manual"] as const;
export type GpsStatus = (typeof GPS_STATUSES)[number];

export type LatLng = { lat: number; lng: number };

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function gpsStatusFromDistance(meters: number): "perto" | "longe" {
  return meters <= NEAR_METERS ? "perto" : "longe";
}

/** "379 m" / "1,2 km"; acima de 5 km não mostra (demo remota). */
export function formatDistance(meters: number): string | null {
  if (meters > MAX_SHOWN_DISTANCE_M) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}
