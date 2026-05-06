import { useState, useEffect, useCallback } from "react";
import { haversineDistance, GEOFENCE_RADIUS_M } from "../utils/geo";

export type GeoStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported" | "error";

export type Coords = { lat: number; lng: number };

export type GeoState = {
  status: GeoStatus;
  coords: Coords | null;
  distance: number | null;
  inside: boolean;
  error: string | null;
};

type InternalState = Pick<GeoState, "status" | "coords" | "error">;

const GEO_SUPPORTED = Boolean(navigator?.geolocation);

// Dev-only: set sessionStorage key "tribe:dev_geo" to "lat,lng" to bypass real geolocation.
function getDevGeoOverride(): Coords | null {
  if (!import.meta.env.DEV) return null;
  try {
    const raw = sessionStorage.getItem("tribe:dev_geo");
    if (!raw) return null;
    const [lat, lng] = raw.split(",").map(Number);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

// center is the geofence origin — pass the active tribe's lat/lng, or omit for no check
export function useGeolocation(center?: Coords): GeoState {
  const devOverride = getDevGeoOverride();

  const [state, setState] = useState<InternalState>(() => {
    if (devOverride) return { status: "granted", coords: devOverride, error: null };
    return {
      status: GEO_SUPPORTED ? "requesting" : "unsupported",
      coords: null,
      error: GEO_SUPPORTED ? null : "Geolocation not supported",
    };
  });

  const onPosition = useCallback((pos: GeolocationPosition) => {
    setState({
      status: "granted",
      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      error: null,
    });
  }, []);

  const onError = useCallback((err: GeolocationPositionError) => {
    setState((prev) => ({
      ...prev,
      status: err.code === GeolocationPositionError.PERMISSION_DENIED ? "denied" : "error",
      error: err.message,
    }));
  }, []);

  useEffect(() => {
    if (devOverride || !GEO_SUPPORTED) return;

    navigator.geolocation.getCurrentPosition(onPosition, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
    });

    const watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 30000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [devOverride, onPosition, onError]);

  // distance and inside are derived from coords + center during render — no effect needed
  const distance =
    state.coords && center
      ? haversineDistance(state.coords.lat, state.coords.lng, center.lat, center.lng)
      : null;

  return {
    ...state,
    distance,
    inside: distance != null ? distance <= GEOFENCE_RADIUS_M : false,
  };
}
