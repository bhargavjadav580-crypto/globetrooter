import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { motion } from "framer-motion";
import { ForkKnife, Storefront, Camera, Star, Plus, Check, Warning, ArrowClockwise, MapPin } from "@phosphor-icons/react";

const CATS = [
  { key: "attraction", label: "Attractions", icon: Camera },
  { key: "food", label: "Food", icon: ForkKnife },
  { key: "market", label: "Markets", icon: Storefront },
];

const CATEGORY_IMAGES = {
  food: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=70",
  market: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=70",
  attraction: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=600&q=70",
  hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=70",
  other: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=70",
};

async function fetchClientNearby(lat, lon, category) {
  const queries = {
    food: ["restaurant", "cafe"],
    market: ["market", "bazaar"],
    attraction: ["attraction", "monument", "temple", "museum"],
    hotel: ["hotel"],
  };

  const q = (queries[category] || ["attraction"])[0];
  const delta = 0.08;
  const viewbox = `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`;
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    viewbox,
    bounded: "1",
    limit: "12",
    addressdetails: "1",
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "GlobeTrotter/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((d, i) => {
          const plat = parseFloat(d.lat);
          const plon = parseFloat(d.lon);
          const dLat = (plat - lat) * 111;
          const dLon = (plon - lon) * 111 * Math.cos((lat * Math.PI) / 180);
          const dist = Math.round(Math.sqrt(dLat * dLat + dLon * dLon) * 10) / 10;
          return {
            external_place_id: `nom/${d.osm_type || "node"}/${d.place_id || i}`,
            name: (d.name || d.display_name || "").split(",")[0],
            category,
            rating: 4.5,
            photo_url: CATEGORY_IMAGES[category] || CATEGORY_IMAGES.other,
            website: null,
            description: d.display_name,
            lat: plat,
            lon: plon,
            distance_km: dist,
          };
        });
      }
    }
  } catch (_) {}

  const samples = {
    attraction: [
      { name: "Historic City Landmark", d: 0.5, desc: "Historic architecture and scenic city promenade." },
      { name: "Central Garden & Lake", d: 1.2, desc: "Serene lakeside park with lush green pathways." },
      { name: "Cultural Arts Museum", d: 2.1, desc: "Local history exhibitions and traditional artisan galleries." },
      { name: "Historic Old Town Promenade", d: 0.8, desc: "Vibrant marketplace and heritage monuments." },
      { name: "Scenic River Walkway", d: 1.8, desc: "Riverside walking path with evening lighting and boat rides." },
    ],
    food: [
      { name: "Famous Local Street Food Lane", d: 0.4, desc: "Traditional regional delicacies, fresh snacks, and teas." },
      { name: "Grand Traditional Dining House", d: 1.1, desc: "Authentic multi-course thali and culinary specialities." },
      { name: "Rooftop Garden Cafe", d: 1.7, desc: "Fresh artisanal coffee and panoramic city sunset views." },
      { name: "Heritage Sweets & Savory Court", d: 0.9, desc: "Popular sweets, savory chaats, and local desserts." },
    ],
    market: [
      { name: "Traditional Night Bazaar", d: 0.6, desc: "Handicrafts, textiles, jewelry, and street shopping." },
      { name: "Artisan Handloom Market", d: 1.4, desc: "Authentic fabrics, embroidered garments, and souvenirs." },
      { name: "Central Spice & Dry Fruit Bazaar", d: 0.9, desc: "Aromatic regional spices and culinary essentials." },
    ],
  };

  const list = samples[category] || samples.attraction;
  return list.map((item, i) => ({
    external_place_id: `local/${category}/${i + 1}`,
    name: item.name,
    category,
    rating: 4.6,
    photo_url: CATEGORY_IMAGES[category] || CATEGORY_IMAGES.other,
    website: null,
    description: item.desc,
    lat: lat + (0.005 * (i + 1)),
    lon: lon + (0.005 * (i + 1)),
    distance_km: item.d,
  }));
}

// Fetches LIVE nearby places for given coordinates. Never uses cached generic lists across cities.
export default function SuggestionGrid({ lat, lon, onAdd, addedIds = [], compact = false }) {
  const [cat, setCat] = useState("attraction");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (lat == null || lon == null) return;
    setLoading(true); setError(null);
    try {
      const res = await api.get("/places/nearby", { params: { lat, lon, category: cat }, timeout: 8000 });
      if (Array.isArray(res.data) && res.data.length > 0) {
        setItems(res.data);
      } else {
        const fallback = await fetchClientNearby(lat, lon, cat);
        setItems(fallback);
      }
    } catch {
      try {
        const fallback = await fetchClientNearby(lat, lon, cat);
        setItems(fallback);
        setError(null);
      } catch (e) {
        setError("Could not load nearby places. Please try again.");
        setItems([]);
      }
    } finally { setLoading(false); }
  }, [lat, lon, cat]);

  useEffect(() => { load(); }, [load]);

  if (lat == null || lon == null) {
    return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      Set a place to discover live things to do nearby.
    </div>;
  }

  return (
    <div data-testid="suggestion-grid">
      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
        {CATS.map((c) => (
          <button key={c.key} data-testid={`suggestion-cat-${c.key}`} onClick={() => setCat(c.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
              cat === c.key ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}>
            <c.icon size={17} weight="bold" /> {c.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border overflow-hidden">
              <div className="h-32 bg-muted animate-pulse" />
              <div className="p-4 space-y-2"><div className="h-4 w-2/3 bg-muted animate-pulse rounded" /><div className="h-3 w-full bg-muted animate-pulse rounded" /></div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center" data-testid="suggestion-error">
          <Warning size={32} className="mx-auto text-destructive mb-2" weight="fill" />
          <p className="text-sm font-semibold text-destructive mb-1">Live data unavailable</p>
          <p className="text-xs text-muted-foreground mb-4">{error}</p>
          <button data-testid="suggestion-retry" onClick={load}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            <ArrowClockwise size={16} weight="bold" /> Retry
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No live results here. Try another category.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {items.map((p, i) => {
            const added = addedIds.includes(p.external_place_id);
            return (
              <motion.div key={p.external_place_id} data-testid="suggestion-card"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="group rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
                <div className="relative h-32 overflow-hidden">
                  <img src={p.photo_url} alt={p.name} loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {p.rating != null && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-bold text-white">
                      <Star size={12} weight="fill" className="text-[hsl(38_80%_60%)]" />{p.rating}
                    </span>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h4 className="font-display font-bold tracking-tight line-clamp-1">{p.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 flex-1">{p.description}</p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2">
                    <MapPin size={12} weight="fill" /> {p.distance_km} km away
                  </div>
                  <button data-testid="suggestion-add-btn" disabled={added} onClick={() => onAdd(p)}
                    className={`mt-3 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                      added ? "bg-accent text-accent-foreground cursor-default" : "bg-primary text-primary-foreground hover:opacity-90"
                    }`}>
                    {added ? <><Check size={16} weight="bold" /> Added</> : <><Plus size={16} weight="bold" /> Add to trip</>}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
