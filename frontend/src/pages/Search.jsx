import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MagnifyingGlass, Star, MapPin, ForkKnife, Storefront, Camera, Warning, ArrowClockwise, SortAscending, Globe, Sparkle, BookmarkSimple, Plus, Buildings } from "@phosphor-icons/react";

const CATS = [
  { key: "attraction", label: "Attractions", icon: Camera },
  { key: "food", label: "Food", icon: ForkKnife },
  { key: "market", label: "Markets", icon: Storefront },
];

const TRENDING_DESTINATIONS = [
  { name: "Goa", tagline: "Sun, sand, and coastal heritage", img: "https://images.pexels.com/photos/1078850/pexels-photo-1078850.jpeg", tag: "Beaches" },
  { name: "Manali", tagline: "Snow peaks, valleys & alpine trails", img: "https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg", tag: "Mountains" },
  { name: "Jaipur", tagline: "Palaces, forts & vibrant bazaars", img: "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg", tag: "Heritage" },
  { name: "Udaipur", tagline: "Lakes, royal heritage & sunsets", img: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=800&q=70", tag: "Romance" },
  { name: "Varanasi", tagline: "Ghats, spiritual vibes & silk markets", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800&q=70", tag: "Culture" },
  { name: "Kerala", tagline: "Backwaters, tea estates & spice gardens", img: "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=70", tag: "Nature" },
];

export default function Search() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [cat, setCat] = useState("attraction");
  const [sort, setSort] = useState("distance");
  const [maxKm, setMaxKm] = useState(50);
  const [place, setPlace] = useState(null);
  const [cityInfo, setCityInfo] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [trips, setTrips] = useState([]);
  const [addTarget, setAddTarget] = useState(null);

  useEffect(() => { api.get("/trips").then((r) => setTrips(r.data)).catch(() => {}); }, []);

  const run = useCallback(async (query, category) => {
    if (!query || query.trim().length < 2) return;
    setLoading(true); setError(null); setSearched(true);
    try {
      const [srch, info] = await Promise.all([
        api.get("/places/search", { params: { q: query, category } }),
        api.get("/places/city-info", { params: { q: query } }).catch(() => ({ data: null })),
      ]);
      setPlace(srch.data.place);
      setResults(srch.data.results);
      setCityInfo(info.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Live data unavailable");
      setResults([]);
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get("q")) run(params.get("q"), cat); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (searched && q) run(q, cat); }, [cat]);

  const saveDestination = async () => {
    if (!place) return;
    try {
      await api.post("/saved-destinations", { place_name: place.name, place_id: place.place_id, lat: place.lat, lon: place.lon });
      toast.success(`Saved ${place.name} to your destinations`);
    } catch { toast.error("Could not save"); }
  };

  const addToTrip = async (tripId) => {
    const p = addTarget;
    try {
      const sec = await api.post(`/trips/${tripId}/sections`, {
        type: "activity", title: p.name, place_name: place?.name || p.name,
        latitude: place?.lat, longitude: place?.lon,
      });
      await api.post(`/sections/${sec.data.id}/places`, {
        external_place_id: p.external_place_id, name: p.name, category: p.category,
        rating: p.rating, photo_url: p.photo_url, description: p.description, lat: p.lat, lon: p.lon, cost_estimate: 0,
      });
      toast.success(`Added ${p.name} to your trip`);
      setAddTarget(null);
    } catch { toast.error("Could not add to trip"); }
  };

  const sorted = [...results].filter((r) => r.distance_km <= maxKm).sort((a, b) =>
    sort === "rating" ? (b.rating || 0) - (a.rating || 0)
      : sort === "name" ? a.name.localeCompare(b.name)
        : a.distance_km - b.distance_km);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <p className="overline text-primary mb-1">Discover any city</p>
      <h1 className="font-display font-black text-4xl tracking-tighter mb-6">Activity & City Search</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); run(q, cat); }} className="relative flex-1">
          <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input data-testid="city-search-input" value={q} onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value.trim()) { setSearched(false); setResults([]); }
          }}
            placeholder="Try 'Ahmedabad' or 'Goa'…"
            className="w-full rounded-full border border-input bg-card pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-ring" />
        </form>
        <button data-testid="search-btn" onClick={() => run(q, cat)}
          className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground">Search</button>
      </div>

      {/* City meta info */}
      {cityInfo?.place && !loading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid="city-info"
          className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex-1 min-w-[180px]">
            <p className="font-display font-bold tracking-tight text-lg">{cityInfo.place.name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Globe size={14} weight="fill" /> {cityInfo.country}</p>
          </div>
          <div className="flex items-center gap-2"><Sparkle size={18} weight="fill" className="text-primary" />
            <div><p className="font-display font-black text-xl leading-none">{cityInfo.live_spots}+</p><p className="text-xs text-muted-foreground">live spots</p></div></div>
          <div className="flex items-center gap-2"><Buildings size={18} weight="fill" className="text-secondary" />
            <div><p className="font-display font-black text-xl leading-none">{cityInfo.times_planned}</p><p className="text-xs text-muted-foreground">times planned</p></div></div>
          <button data-testid="save-destination-btn" onClick={saveDestination}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
            <BookmarkSimple size={16} weight="bold" /> Save destination
          </button>
        </motion.div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {CATS.map((c) => (
          <button key={c.key} data-testid={`search-cat-${c.key}`} onClick={() => setCat(c.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${cat === c.key ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
            <c.icon size={16} weight="bold" /> {c.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Within
            <select data-testid="distance-filter" value={maxKm} onChange={(e) => setMaxKm(Number(e.target.value))}
              className="rounded-full border border-input bg-card px-2 py-1 text-xs outline-none">
              <option value={5}>5 km</option><option value={15}>15 km</option><option value={50}>50 km</option><option value={9999}>Any</option>
            </select>
          </label>
          <div className="flex items-center gap-1.5 text-sm">
            <SortAscending size={16} className="text-muted-foreground" />
            <select data-testid="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}
              className="rounded-full border border-input bg-card px-3 py-1.5 text-sm outline-none">
              <option value="distance">Distance</option><option value="rating">Rating</option><option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>}

      {error && !loading && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center" data-testid="search-error">
          <Warning size={32} className="mx-auto text-destructive mb-2" weight="fill" />
          <p className="text-sm font-semibold text-destructive mb-3">{error}</p>
          <button data-testid="search-retry" onClick={() => run(q, cat)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            <ArrowClockwise size={16} weight="bold" /> Retry
          </button>
        </div>
      )}

      {!loading && !error && !searched && (
        <div className="space-y-4 my-6">
          <div>
            <p className="overline text-primary">Popular Indian Destinations</p>
            <h2 className="font-display font-extrabold text-2xl tracking-tight">Explore Trending Road Trip Hubs</h2>
            <p className="text-sm text-muted-foreground">Click any city to discover live attractions, food spots & markets.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TRENDING_DESTINATIONS.map((dest, idx) => (
              <motion.div
                key={dest.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => {
                  setQ(dest.name);
                  run(dest.name, cat);
                }}
                className="group relative h-48 rounded-3xl overflow-hidden border border-border cursor-pointer shadow-xs hover:shadow-md transition-all hover:scale-[1.02]"
              >
                <img
                  src={dest.img}
                  alt={dest.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                <div className="absolute top-3 right-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md text-white border border-white/30">
                    {dest.tag}
                  </span>
                </div>
                <div className="absolute bottom-0 p-4 text-white">
                  <h3 className="font-display font-bold text-xl tracking-tight flex items-center gap-1.5">
                    <MapPin size={18} weight="fill" className="text-primary" /> {dest.name}
                  </h3>
                  <p className="text-xs text-white/80 line-clamp-1 mt-0.5">{dest.tagline}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-foreground/90 mt-2 bg-primary/80 px-2.5 py-0.5 rounded-full">
                    <Sparkle size={12} weight="fill" /> Discover spots →
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && searched && sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No live results within {maxKm === 9999 ? "range" : maxKm + " km"}. Try another city, category or distance.</div>
      )}

      <div className="space-y-3" data-testid="search-results">
        {!loading && sorted.map((r, i) => (
          <motion.div key={r.external_place_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            data-testid={`search-result-${i}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 hover:border-primary/50 transition-colors">
            <img src={r.photo_url} alt={r.name} className="h-16 w-16 rounded-xl object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold tracking-tight line-clamp-1">{r.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-1">{r.description}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin size={12} weight="fill" /> {r.distance_km} km</p>
            </div>
            {r.rating != null && (
              <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-sm font-bold text-accent-foreground">
                <Star size={14} weight="fill" className="text-primary" /> {r.rating}
              </span>
            )}
            <button data-testid={`add-to-trip-${i}`} onClick={() => setAddTarget(r)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap">
              <Plus size={15} weight="bold" /> Add to trip
            </button>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!addTarget} onOpenChange={(o) => !o && setAddTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display tracking-tight">Add "{addTarget?.name}" to which trip?</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {trips.length === 0 ? <p className="text-sm text-muted-foreground">You have no trips yet. Create one first.</p> :
              trips.map((t) => (
                <button key={t.id} data-testid={`add-to-trip-option-${t.id}`} onClick={() => addToTrip(t.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-primary transition-colors">
                  <img src={t.cover_image} alt={t.name} className="h-10 w-14 rounded-lg object-cover" />
                  <div><p className="font-semibold text-sm">{t.name}</p><p className="text-xs text-muted-foreground">{t.destination}</p></div>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
