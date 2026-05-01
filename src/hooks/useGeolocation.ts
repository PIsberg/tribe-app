import { useState, useEffect, useCallback, useRef } from "react";
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

// center is the geofence origin — pass the active tribe's lat/lng, or omit for no check
export function useGeolocation(center?: Coords): GeoState {
  const centerRef = useRef(center);
  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  const [state, setState] = useState<GeoState>({
    status: "idle",
    coords: null,
    distance: null,
    inside: false,
    error: null,
  });

  const onPosition = useCallback((pos: GeolocationPosition) => {
    const coords: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const c = centerRef.current;
    const distance = c ? haversineDistance(coords.lat, coords.lng, c.lat, c.lng) : null;
    setState({
      status: "granted",
      coords,
      distance,
      inside: distance != null ? distance <= GEOFENCE_RADIUS_M : false,
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
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, status: "unsupported", error: "Geolocation not supported" }));
      return;
    }

    setState((prev) => ({ ...prev, status: "requesting" }));
    navigator.geolocation.getCurrentPosition(onPosition, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
    });

    const watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 30000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onPosition, onError]);

  // Re-derive inside/distance when center changes without a new GPS event
  useEffect(() => {
    setState((prev) => {
      if (!prev.coords || !center) return prev;
      const distance = haversineDistance(prev.coords.lat, prev.coords.lng, center.lat, center.lng);
      return { ...prev, distance, inside: distance <= GEOFENCE_RADIUS_M };
    });
  }, [center]);

  return state;
}
