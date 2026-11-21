"use client";

import { useEffect, useState } from "react";
import { formatDistance, haversineMeters } from "@/src/modules/salao/domain/geo";

/** Distância só se a permissão de GPS JÁ foi concedida — nunca pede na abertura da página. */
export function useDistance(lat: number | null, lng: number | null): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (lat === null || lng === null || !("permissions" in navigator) || !("geolocation" in navigator)) return;
    let alive = true;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((st) => {
        if (st.state !== "granted" || !alive) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => alive && setLabel(formatDistance(haversineMeters({ lat, lng }, { lat: pos.coords.latitude, lng: pos.coords.longitude }))),
          () => {},
          { enableHighAccuracy: false, maximumAge: 600_000, timeout: 8_000 },
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lat, lng]);
  return label;
}
