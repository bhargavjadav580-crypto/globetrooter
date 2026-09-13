import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { motion } from "framer-motion";
import { ForkKnife, Storefront, Camera, Star, Plus, Check, Warning, ArrowClockwise, MapPin } from "@phosphor-icons/react";

const CATS = [
  { key: "attraction", label: "Attractions", icon: Camera },
  { key: "food", label: "Food", icon: ForkKnife },
  { key: "market", label: "Markets", icon: Storefront },
];

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
      const res = await api.get("/places/nearby", { params: { lat, lon, category: cat } });
      setItems(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Live data unavailable");
      setItems([]);
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
