import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { Coords } from "../hooks/useGeolocation";
import { haversineDistance, formatDistance, GEOFENCE_RADIUS_M } from "../utils/geo";

type Heat = "blazing" | "hot" | "warm" | "cold";

const HEAT_COLOR: Record<Heat, string> = {
  blazing: "#ffd700",
  hot:     "#ff4500",
  warm:    "#aa3300",
  cold:    "#383838",
};

const HEAT_GLOW: Record<Heat, string> = {
  blazing: "rgba(255,215,0,0.25)",
  hot:     "rgba(255,69,0,0.22)",
  warm:    "rgba(170,51,0,0.18)",
  cold:    "rgba(55,55,55,0.12)",
};

const HEAT_LABEL: Record<Heat, string> = {
  blazing: "blazing",
  hot:     "hot",
  warm:    "warm",
  cold:    "quiet",
};

function getHeat(lastMessageAt: number | undefined, memberCount: number): Heat {
  if (!lastMessageAt) return "cold";
  const age = Date.now() - lastMessageAt;
  if (age < 2 * 60 * 1000 && memberCount >= 2) return "blazing";
  if (age < 10 * 60 * 1000) return "hot";
  if (age < 25 * 60 * 1000) return "warm";
  return "cold";
}

function markerRadius(memberCount: number): number {
  if (memberCount === 0) return 6;
  if (memberCount === 1) return 8;
  if (memberCount <= 3) return 10;
  if (memberCount <= 6) return 13;
  return 16;
}

function makeFireIcon(heat: Heat, r: number, blazing: boolean): L.DivIcon {
  const color = HEAT_COLOR[heat];
  const size = r * 2;
  const pulseDiv = blazing
    ? `<div class="fire-pulse-ring" style="position:absolute;inset:0;border-radius:50%;background:${color};pointer-events:none;"></div>`
    : "";
  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;transform:translate(-50%,-50%)">
      ${pulseDiv}
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.5);box-shadow:0 0 ${r * 2}px ${color}88;"></div>
    </div>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
    className: "",
  });
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const userIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#60a5fa;border:2px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(96,165,250,0.25);transform:translate(-50%,-50%)"></div>`,
  iconSize: [1, 1],
  iconAnchor: [0, 0],
  className: "",
});

function FitGeofenceOnMount({ coords }: { coords: Coords }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(coords.lat, coords.lng).toBounds(GEOFENCE_RADIUS_M * 2);
    map.fitBounds(bounds, { padding: [24, 24], animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  userCoords: Coords;
  onJoin: (tribe: Doc<"tribes">) => void;
  onClose: () => void;
}

function Legend() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 8,
        left: 8,
        zIndex: 1000,
        background: "rgba(5,10,5,0.88)",
        border: "1px solid rgba(255,69,0,0.2)",
        borderRadius: 8,
        padding: "6px 10px",
        fontFamily: "monospace",
        fontSize: 10,
        color: "rgba(255,255,255,0.55)",
        pointerEvents: "none",
      }}
    >
      {(Object.entries(HEAT_LABEL) as [Heat, string][]).map(([heat, label]) => (
        <div key={heat} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: heat === "cold" ? 0 : 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: HEAT_COLOR[heat], flexShrink: 0, boxShadow: `0 0 4px ${HEAT_COLOR[heat]}99` }} />
          <span>{label}</span>
        </div>
      ))}
      <div style={{ marginTop: 5, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 4, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
        size = people inside
      </div>
    </div>
  );
}

export function CampfireMap({ userCoords, onJoin, onClose }: Props) {
  const [maximized, setMaximized] = useState(false);
  const tribes = useQuery(api.tribes.listWithCounts) ?? [];

  const nearby = tribes
    .map((t) => ({ tribe: t, dist: haversineDistance(userCoords.lat, userCoords.lng, t.lat, t.lng) }))
    .filter(({ dist }) => dist <= 50_000)
    .sort((a, b) => a.dist - b.dist);

  const containerStyle: React.CSSProperties = maximized
    ? { position: "fixed", inset: 0, zIndex: 1000, borderRadius: 0 }
    : { position: "relative" };
  const mapHeight = maximized ? "100dvh" : "340px";

  const content = (
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
        <FitGeofenceOnMount coords={userCoords} />
        <InvalidateOnResize trigger={maximized} />

        {/* Geofence ring */}
        <Circle
          center={[userCoords.lat, userCoords.lng]}
          radius={GEOFENCE_RADIUS_M}
          pathOptions={{ color: "#ff4500", fillColor: "#ff4500", fillOpacity: 0.04, weight: 1, dashArray: "4 4", opacity: 0.3 }}
        />

        {/* User position */}
        <Marker position={[userCoords.lat, userCoords.lng]} icon={userIcon} />

        {/* Campfire markers */}
        {nearby.map(({ tribe, dist }) => {
          const joinable = dist <= GEOFENCE_RADIUS_M;
          const heat = joinable ? getHeat(tribe.lastMessageAt, tribe.memberCount) : "cold";
          const r = joinable ? markerRadius(tribe.memberCount) : 6;
          const blazing = heat === "blazing";
          const glowColor = HEAT_GLOW[heat];
          const fireColor = HEAT_COLOR[heat];
          const fireIcon = makeFireIcon(heat, r, blazing);

          return (
            <Fragment key={tribe._id}>
              {/* Glow ring — non-interactive CircleMarker in pixel space */}
              <CircleMarker
                center={[tribe.lat, tribe.lng]}
                radius={r + 8}
                interactive={false}
                pathOptions={{
                  color: "transparent",
                  fillColor: glowColor,
                  fillOpacity: 0.7,
                  weight: 0,
                }}
              />
              {/* Fire dot with popup */}
              <Marker
                position={[tribe.lat, tribe.lng]}
                icon={fireIcon}
              >
                <Popup className="campfire-popup" closeButton={false}>
                  <div
                    style={{
                      fontFamily: "monospace",
                      background: "#0a1a0a",
                      border: `1px solid ${fireColor}55`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      minWidth: 148,
                      color: "white",
                    }}
                  >
                    <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 2, color: fireColor }}>
                      {tribe.name}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                      {formatDistance(dist)} away · {tribe.memberCount} {tribe.memberCount === 1 ? "person" : "people"}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: joinable ? 8 : 4 }}>
                      {HEAT_LABEL[heat]} fire
                      {tribe.lastMessageAt ? ` · ${timeAgo(tribe.lastMessageAt)}` : " · no messages yet"}
                    </div>
                    {joinable ? (
                      <button
                        onClick={() => onJoin(tribe)}
                        style={{
                          width: "100%",
                          background: fireColor,
                          color: heat === "blazing" ? "#000" : "white",
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
                      <div style={{ fontSize: 10, color: "rgba(255,100,0,0.45)", textAlign: "center" }}>
                        too far to join
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>

      {/* Map controls */}
      <div style={{ position: "absolute", top: 8, right: 8, zIndex: 1001, display: "flex", gap: 6 }}>
        <button
          onClick={() => setMaximized((m) => !m)}
          aria-label={maximized ? "Restore map" : "Maximize map"}
          style={{
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(5,10,5,0.88)",
            border: "1px solid rgba(255,69,0,0.28)",
            color: "rgba(255,255,255,0.6)",
            borderRadius: 6,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {maximized ? "⤡" : "⤢"}
        </button>
        <button
          onClick={() => { if (maximized) setMaximized(false); onClose(); }}
          aria-label="Close map"
          style={{
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(5,10,5,0.88)",
            border: "1px solid rgba(255,69,0,0.28)",
            color: "rgba(255,255,255,0.6)",
            borderRadius: 6,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <Legend />

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
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
            No fires within 50km
          </div>
        </div>
      )}
    </motion.div>
  );

  // When maximized, portal into <body> to escape any framer-motion transform
  // ancestors that would otherwise become the containing block for our
  // position:fixed wrapper and confine it to the parent's width on desktop.
  return maximized ? createPortal(content, document.body) : content;
}
