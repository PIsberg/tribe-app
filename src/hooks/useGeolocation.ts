import { useState, useEffect, useCallback } from "react";
import { haversineDistance, TRIBE_CENTER, GEOFENCE_RADIUS_M } from "../utils/geo";

export type GeoStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported" | "error";

export type GeoState = {
  status: GeoStatus;
  distance: number | null;
  inside: boolean;
  error: string | null;
};

export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({
    status: "idle",
    distance: null,
    inside: false,
    error: null,
  });

  const onPosition = useCallback((pos: GeolocationPosition) => {
    const { latitude, longitude } = pos.coords;
    const distance = haversineDistance(latitude, longitude, TRIBE_CENTER.lat, TRIBE_CENTER.lng);
    setState({
      status: "granted",
      distance,
      inside: distance <= GEOFENCE_RADIUS_M,
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
    navigator.geolocation.getCurrentPosition(onPosition, onError, { enableHighAccuracy: true, timeout: 10000 });

    const watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 30000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onPosition, onError]);

  return state;
}
