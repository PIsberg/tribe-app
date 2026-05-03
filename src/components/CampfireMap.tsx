import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion } from "framer-motion";
import type { Doc } from "../../convex/_generated/dataModel";
import type { Coords } from "../hooks/useGeolocation";
import { haversineDistance, formatDistance, GEOFENCE_RADIUS_M } from "../utils/geo";

type Tribe = Doc<"tribes">;

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function isRecentlyActive(lastMessageAt: number | undefined): boolean {
  return lastMessageAt != null && Date.now() - lastMessageAt < 5 * 60 * 1000;
}

const userIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#60a5fa;border:2px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(96,165,250,0.25);transform:translate(-50%,-50%)"></div>`,
  iconSize: [1, 1],
  iconAnchor: [0, 0],
  className: "",
});

function RecenterOnUser({ coords }: { coords: Coords }) {
  const map = useMap();
  useEffect(() => {
    map.setView([coords.lat, coords.lng], map.getZoom(), { animate: true });
  }, [coords.lat, coords.lng, map]);
  return null;
}

function InvalidateOnResize({ trigger }: { trigger: unknown }) {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 320);
    return () => window.clearTimeout(id);
  }, [trigger, map]);
  return null;
}

interface Props {
  tribes: Tribe[];
  userCoords: Coords;
  onJoin: (tribe: Tribe) => void;
  onClose: () => void;
}

export function CampfireMap({ tribes, userCoords, onJoin, onClose }: Props) {
  const [maximized, setMaximized] = useState(false);
  const nearby = tribes
    .map((t) => ({ tribe: t, dist: haversineDistance(userCoords.lat, userCoords.lng, t.lat, t.lng) }))
    .filter(({ dist }) => dist <= 50_000)
    .sort((a, b) => a.dist - b.dist);

  const containerStyle: React.CSSProperties = maximized
    ? { position: "fixed", inset: 0, zIndex: 1000, borderRadius: 0 }
    : { position: "relative" };
  const mapHeight = maximized ? "100dvh" : "340px";

  return (
    <motion.div
      className={`w-full mt-4 ${maximized ? "" : "rounded-2xl"} overflow-hidden border border-fire-char/20`}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: maximized ? "100dvh" : 340 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      style={containerStyle}
    >
      <MapContainer
        center={[userCoords.lat, userCoords.lng]}
        zoom={13}
        style={{ height: mapHeight, width: "100%", background: "#0a1a0a" }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        />
        <RecenterOnUser coords={userCoords} />
        <InvalidateOnResize trigger={maximized} />

        {/* 5km geofence ring */}
        <Circle
          center={[userCoords.lat, userCoords.lng]}
          radius={GEOFENCE_RADIUS_M}
          pathOptions={{ color: "#ff4500", fillColor: "#ff4500", fillOpacity: 0.04, weight: 1, dashArray: "4 4", opacity: 0.35 }}
        />

        {/* User position */}
        <Marker position={[userCoords.lat, userCoords.lng]} icon={userIcon} />

        {/* Campfire markers */}
        {nearby.map(({ tribe, dist }) => {
          const joinable = dist <= GEOFENCE_RADIUS_M;
          const isActive = isRecentlyActive(tribe.lastMessageAt);
          const fillColor = joinable ? "#ff4500" : "#6b6b6b";
          return (
            <CircleMarker
              key={tribe._id}
              center={[tribe.lat, tribe.lng]}
              radius={isActive && joinable ? 9 : 7}
              pathOptions={{
                color: joinable ? "#ffb37a" : "#3a3a3a",
                weight: 2,
                fillColor,
                fillOpacity: joinable ? 0.85 : 0.35,
              }}
            >
              <Popup
                className="campfire-popup"
                closeButton={false}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    background: "#0a1a0a",
                    border: "1px solid rgba(255,69,0,0.3)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    minWidth: 140,
                    color: "white",
                  }}
                >
                  <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>{tribe.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
                    {formatDistance(dist)} away
                    {isActive ? " · 🔥 active" : tribe.lastMessageAt ? ` · ${timeAgo(tribe.lastMessageAt)}` : ""}
                  </div>
                  {joinable ? (
                    <button
                      onClick={() => onJoin(tribe)}
                      style={{
                        width: "100%",
                        background: "#ff4500",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 8px",
                        fontSize: 11,
                        fontFamily: "monospace",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      Join fire 🔥
                    </button>
                  ) : (
                    <div style={{ fontSize: 10, color: "rgba(255,100,0,0.5)", textAlign: "center" }}>
                      too far to join
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Map controls */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1000,
          display: "flex",
          gap: 6,
        }}
      >
        <button
          onClick={() => setMaximized((m) => !m)}
          aria-label={maximized ? "Restore map" : "Maximize map"}
          style={{
            background: "rgba(5,15,5,0.85)",
            border: "1px solid rgba(255,69,0,0.3)",
            color: "rgba(255,255,255,0.6)",
            borderRadius: 8,
            padding: "4px 8px",
            fontFamily: "monospace",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          {maximized ? "⤡ minimize" : "⤢ maximize"}
        </button>
        <button
          onClick={() => {
            if (maximized) setMaximized(false);
            onClose();
          }}
          style={{
            background: "rgba(5,15,5,0.85)",
            border: "1px solid rgba(255,69,0,0.3)",
            color: "rgba(255,255,255,0.6)",
            borderRadius: 8,
            padding: "4px 8px",
            fontFamily: "monospace",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ✕ map
        </button>
      </div>

      {nearby.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 500,
          }}
        >
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
            No fires within 50km
          </div>
        </div>
      )}
    </motion.div>
  );
}
