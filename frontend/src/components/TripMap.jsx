import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

function makePin(label, color = "hsl(14,72%,53%)") {
  return L.divIcon({
    className: "",
    html: `<div class="gt-marker"><div class="gt-pin" style="background:${color}"><span>${label}</span></div></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  const pointsKey = JSON.stringify(points);

  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    try {
      if (typeof map.stop === "function") {
        map.stop();
      }
      if (typeof map.invalidateSize === "function") {
        map.invalidateSize();
      }
      if (points.length === 1) {
        map.setView(points[0], 12, { animate: false });
      } else {
        map.fitBounds(points, { padding: [40, 40], animate: false });
      }
    } catch (err) {
      console.warn("Leaflet FitBounds safe catch:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, map]);

  useEffect(() => {
    return () => {
      if (map && typeof map.stop === "function") {
        try {
          map.stop();
        } catch {
          /* ignore on unmount */
        }
      }
    };
  }, [map]);

  return null;
}

// Fires invalidateSize at 100ms, 400ms, and 1000ms after mount.
// Ensures tiles fully render even when the map container starts hidden or animating.
function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const ids = [
      setTimeout(() => { try { map.invalidateSize({ animate: false }); } catch {} }, 100),
      setTimeout(() => { try { map.invalidateSize({ animate: false }); } catch {} }, 400),
      setTimeout(() => { try { map.invalidateSize({ animate: false }); } catch {} }, 1000),
    ];
    return () => ids.forEach(clearTimeout);
  }, [map]);
  return null;
}

export default function TripMap({ stops = [], route = [], height = 380 }) {
  const valid = (Array.isArray(stops) ? stops : []).filter(
    (s) => s && s.lat != null && s.lon != null && !isNaN(Number(s.lat)) && !isNaN(Number(s.lon))
  ).map((s) => ({ ...s, lat: Number(s.lat), lon: Number(s.lon) }));
  const points = valid.map((s) => [s.lat, s.lon]);
  const center = points[0] || [20.5937, 78.9629];

  const validRoute = (Array.isArray(route) ? route : []).filter(
    (pt) => Array.isArray(pt) && pt.length >= 2 && !isNaN(Number(pt[0])) && !isNaN(Number(pt[1]))
  ).map((pt) => [Number(pt[0]), Number(pt[1])]);

  return (
    <div className="rounded-2xl overflow-hidden border border-border relative" style={{ height }} data-testid="trip-map">
      <MapContainer
        center={center}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        preferCanvas={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validRoute.length > 1 && (
          <Polyline positions={validRoute} pathOptions={{ color: "hsl(14,72%,53%)", weight: 4, opacity: 0.85 }} />
        )}
        {valid.length > 1 && validRoute.length < 2 && (
          <Polyline positions={points} pathOptions={{ color: "hsl(14,72%,53%)", weight: 3, dashArray: "6 8", opacity: 0.7 }} />
        )}
        {valid.map((s, i) => (
          <Marker key={`${s.name ?? i}-${s.lat}-${s.lon}`} position={[s.lat, s.lon]} icon={makePin(s.label ?? i + 1, s.color)}>
            <Popup>
              <div style={{ minWidth: 150 }}>
                {s.photo && <img src={s.photo} alt={s.name} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, marginBottom: 6 }} />}
                <strong>{s.name}</strong>
                {s.rating != null && <div>⭐ {s.rating}</div>}
                {s.subtitle && <div style={{ color: "#666", fontSize: 12 }}>{s.subtitle}</div>}
                {s.link && (
                  <a href={s.link} target="_blank" rel="noreferrer"
                    style={{ display: "inline-block", marginTop: 6, fontSize: 12, fontWeight: 700, color: "hsl(14,72%,53%)", textDecoration: "none" }}>
                    {s.linkLabel || "Open"} ↗
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        <FitBounds points={points} />
        <MapInvalidator />
      </MapContainer>
    </div>
  );
}
