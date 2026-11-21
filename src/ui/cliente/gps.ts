"use client";

import { GPS_TIMEOUT_MS, gpsStatusFromDistance, haversineMeters, type GpsStatus } from "@/src/modules/salao/domain/geo";

/**
 * GPS pedido no toque (D25), com o tempo-limite da própria API (não conta o tempo do pedido de permissão — P-I5).
 * A coordenada nunca sai do navegador: só o status volta.
 */
export function checkGps(target: { lat: number | null; lng: number | null }): Promise<GpsStatus> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator) || target.lat === null || target.lng === null) return resolve("sem_suporte");
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(gpsStatusFromDistance(haversineMeters({ lat: target.lat!, lng: target.lng! }, { lat: pos.coords.latitude, lng: pos.coords.longitude }))),
      (err) => resolve(err.code === err.PERMISSION_DENIED ? "negado" : err.code === err.TIMEOUT ? "tempo_esgotado" : "sem_suporte"),
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: GPS_TIMEOUT_MS },
    );
  });
}
