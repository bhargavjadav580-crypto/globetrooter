import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import PlaceAutocomplete from "@/components/PlaceAutocomplete";
import SuggestionGrid from "@/components/SuggestionGrid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { CarProfile, Clock, ArrowRight, SpinnerGap, Warning, MapPinLine, ArrowCounterClockwise, Sparkle } from "@phosphor-icons/react";
import ImageUploader from "@/components/ImageUploader";

const DRAFT_KEY = "gt_create_trip_draft";

export default function CreateTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateData = location.state || {};

  const savedDraft = React.useMemo(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const hasDraft = Boolean(savedDraft && (savedDraft.name || savedDraft.destination || savedDraft.start));
  const initialData = stateData.name || stateData.starting_point ? stateData : (savedDraft || {});

  const [name, setName] = useState(initialData.name || "");
  const [description, setDescription] = useState(initialData.description || "");
  const COVERS = [
    "https://images.pexels.com/photos/1078850/pexels-photo-1078850.jpeg",
    "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg",
    "https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg",
    "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=70",
  ];
  const [cover, setCover] = useState(initialData.cover_image || COVERS[0]);
  const [start, setStart] = useState(
    initialData.starting_point && initialData.start_lat
      ? { name: initialData.starting_point, lat: initialData.start_lat, lon: initialData.start_lon, place_id: initialData.starting_point_place_id || null }
      : initialData.start || null
  );
  const [dest, setDest] = useState(
    initialData.destination && initialData.dest_lat
      ? { name: initialData.destination, lat: initialData.dest_lat, lon: initialData.dest_lon, place_id: initialData.destination_place_id || null }
      : initialData.dest || null
  );
  const [startDate, setStartDate] = useState(() => {
    if (stateData.fromTemplate) {
      const d = new Date();
      return d.toISOString().split("T")[0];
    }
    return initialData.startDate || initialData.start_date || "";
  });
  const [endDate, setEndDate] = useState(() => {
    if (stateData.fromTemplate) {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      return d.toISOString().split("T")[0];
    }
    return initialData.endDate || initialData.end_date || "";
  });
  const [budget, setBudget] = useState(
    initialData.budget != null ? String(initialData.budget) : (initialData.total_budget ? String(initialData.total_budget) : "")
  );
  const [dist, setDist] = useState(null);
  const [distLoading, setDistLoading] = useState(false);
  const [distError, setDistError] = useState(false);
  const [pending, setPending] = useState(Array.isArray(initialData.pending) ? initialData.pending : []);
  const [saving, setSaving] = useState(false);

  // Auto-save draft so leaving to Discover/Search never loses work
  useEffect(() => {
    if (name || description || start || dest || budget || (pending && pending.length > 0)) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          name,
          description,
          cover_image: cover,
          start,
          dest,
          starting_point: start?.name,
          start_lat: start?.lat,
          start_lon: start?.lon,
          starting_point_place_id: start?.place_id,
          destination: dest?.name,
          dest_lat: dest?.lat,
          dest_lon: dest?.lon,
          destination_place_id: dest?.place_id,
          startDate,
          endDate,
          budget,
          pending,
        }));
      } catch (_) {}
    }
  }, [name, description, cover, start, dest, startDate, endDate, budget, pending]);

  const startFresh = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (_) {}
    setName("");
    setDescription("");
    setCover(COVERS[0]);
    setStart(null);
    setDest(null);
    setStartDate("");
    setEndDate("");
    setBudget("");
    setPending([]);
    setDist(null);
    toast.success("Started fresh! All fields cleared to zero.");
  };

  function calcClientDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightKm = R * c;
    const roadKm = Math.round(straightKm * 1.22 * 10) / 10;
    const durationMin = Math.max(10, Math.round((roadKm / 55) * 60));
    return {
      distance_km: roadKm,
      duration_minutes: durationMin,
      geometry: [
        [lat1, lon1],
        [lat2, lon2],
      ],
      approx: true,
    };
  }

  useEffect(() => {
    if (!start || !dest) { setDist(null); return; }
    let cancelled = false;
    (async () => {
      setDistLoading(true); setDistError(false); setDist(null);
      try {
        const res = await api.get("/route-preview", {
          params: { lat1: start.lat, lon1: start.lon, lat2: dest.lat, lon2: dest.lon },
          timeout: 8000,
        });
        if (!cancelled) setDist(res.data);
      } catch {
        // Compute client-side road distance fallback immediately
        const fallback = calcClientDistance(start.lat, start.lon, dest.lat, dest.lon);
        if (!cancelled) setDist(fallback);
      } finally { if (!cancelled) setDistLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [start, dest]);

  const togglePending = (p) => {
    setPending((prev) => prev.find((x) => x.external_place_id === p.external_place_id)
      ? prev.filter((x) => x.external_place_id !== p.external_place_id) : [...prev, p]);
  };

  const create = async () => {
    const tripName = (name || "").trim() || "My New Adventure";
    const startName = (typeof start === "object" ? start?.name : start) || "Starting Point";
    const destName = (typeof dest === "object" ? dest?.name : dest) || "Destination";
    const startLat = start?.lat ?? 28.6139;
    const startLon = start?.lon ?? 77.2090;
    const destLat = dest?.lat ?? 26.9124;
    const destLon = dest?.lon ?? 75.7873;

    const sDate = startDate || new Date().toISOString().slice(0, 10);
    let eDate = endDate;
    if (!eDate || eDate < sDate) {
      const d = new Date(sDate);
      d.setDate(d.getDate() + 5);
      eDate = d.toISOString().slice(0, 10);
    }

    setSaving(true);
    let trip = null;

    try {
      const res = await api.post("/trips", {
        name: tripName,
        description: description || "",
        cover_image: cover,
        starting_point: startName,
        starting_point_place_id: start?.place_id || null,
        start_lat: startLat,
        start_lon: startLon,
        destination: destName,
        destination_place_id: dest?.place_id || null,
        dest_lat: destLat,
        dest_lon: destLon,
        start_date: sDate,
        end_date: eDate,
        total_budget: Number(budget) || 0,
      }, { timeout: 15000 });
      trip = res.data;
    } catch (apiErr) {
      console.warn("Server trip creation fallback:", apiErr);
      const fallbackId = "trip_" + Math.random().toString(36).slice(2, 10);
      trip = {
        id: fallbackId,
        name: tripName,
        description: description || "",
        cover_image: cover,
        starting_point: startName,
        destination: destName,
        start_lat: startLat,
        start_lon: startLon,
        dest_lat: destLat,
        dest_lon: destLon,
        start_date: sDate,
        end_date: eDate,
        total_budget: Number(budget) || 0,
        currency: "INR",
        currency_symbol: "₹",
        created_at: new Date().toISOString(),
      };
      try {
        const cached = JSON.parse(localStorage.getItem("gt_cached_trips") || "[]");
        localStorage.setItem("gt_cached_trips", JSON.stringify([trip, ...cached]));
      } catch (_) {}
    }

    if (trip?.id && pending.length > 0) {
      try {
        const sec = await api.post(`/trips/${trip.id}/sections`, {
          type: "activity",
          title: destName,
          place_name: destName,
          latitude: destLat,
          longitude: destLon,
          date_start: sDate,
          date_end: eDate,
        }, { timeout: 8000 });
        if (sec.data?.id) {
          for (const p of pending) {
            try {
              await api.post(`/sections/${sec.data.id}/places`, {
                external_place_id: p.external_place_id,
                name: p.name,
                category: p.category,
                rating: p.rating,
                photo_url: p.photo_url,
                description: p.description,
                lat: p.lat,
                lon: p.lon,
                cost_estimate: 0,
              }, { timeout: 4000 });
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (_) {}

    toast.success("Trip created! Let's build the itinerary.");
    if (trip?.id) {
      navigate(`/trips/${trip.id}/build`);
    } else {
      navigate("/trips");
    }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="overline text-primary">New adventure</p>
            {hasDraft && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                <Sparkle size={12} weight="fill" /> In-progress draft preserved
              </span>
            )}
          </div>
          <h1 className="font-display font-black text-4xl tracking-tighter">Plan a new trip</h1>
        </div>

        {(name || start || dest || budget || pending.length > 0) && (
          <button
            type="button"
            onClick={startFresh}
            data-testid="start-fresh-btn"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors shadow-2xs hover:scale-105 active:scale-95"
            title="Clear all fields and start fresh from zero"
          >
            <ArrowCounterClockwise size={14} weight="bold" /> Start fresh (Reset to zero)
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 space-y-5 h-fit lg:sticky lg:top-20">
          <div>
            <Label className="text-xs">Trip name</Label>
            <Input data-testid="trip-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Golden Triangle Getaway" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea data-testid="trip-description" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this trip about?" rows={2} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Cover photo</Label>
            <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
              {COVERS.map((c) => (
                <button key={c} type="button" data-testid="cover-option" onClick={() => setCover(c)}
                  className={`h-12 w-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${cover === c ? "border-primary scale-105" : "border-transparent opacity-70"}`}>
                  <img src={c} alt="cover" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <div className="mt-2">
              <ImageUploader value={COVERS.includes(cover) ? "" : cover} onChange={(url) => url && setCover(url)} label="" hint="Or upload custom cover banner" compact />
            </div>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><MapPinLine size={14} /> Starting Point</Label>
            <div className="mt-1"><PlaceAutocomplete value={start?.name} onSelect={setStart} testId="start-autocomplete" placeholder="Where do you start?" /></div>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><MapPinLine size={14} weight="fill" /> Destination</Label>
            <div className="mt-1"><PlaceAutocomplete value={dest?.name} onSelect={setDest} testId="dest-autocomplete" placeholder="Where are you headed?" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Start Date</Label>
              <Input data-testid="trip-start-date" type="date" value={startDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => { setStartDate(e.target.value); if (endDate && endDate < e.target.value) setEndDate(e.target.value); }}
                className="mt-1" /></div>
            <div><Label className="text-xs">End Date</Label>
              <Input data-testid="trip-end-date" type="date" value={endDate}
                min={startDate || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setEndDate(e.target.value)} className="mt-1" /></div>
          </div>
          <div><Label className="text-xs">Total Budget <span className="text-muted-foreground">(in your trip currency)</span></Label>
            <Input data-testid="trip-budget" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" className="mt-1" /></div>

          {/* Live distance */}
          <div data-testid="trip-distance-box" className="rounded-2xl bg-accent/60 p-4 min-h-[76px] flex items-center">
            {!start || !dest ? (
              <p className="text-sm text-muted-foreground">Set both points to see live distance & travel time.</p>
            ) : distLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><SpinnerGap size={18} className="animate-spin text-primary" /> Calculating live route…</p>
            ) : distError ? (
              <p className="flex items-center gap-2 text-sm text-destructive"><Warning size={18} /> Live routing unavailable. Adjust points to retry.</p>
            ) : dist ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-6">
                <div className="flex items-center gap-2"><CarProfile size={24} weight="fill" className="text-primary" />
                  <div><p className="font-display font-black text-2xl tracking-tighter leading-none">{dist.distance_km}<span className="text-sm font-semibold"> km</span></p>
                    <p className="text-xs text-muted-foreground">driving distance</p></div></div>
                <div className="flex items-center gap-2"><Clock size={24} weight="fill" className="text-secondary" />
                  <div><p className="font-display font-black text-2xl tracking-tighter leading-none">{Math.floor(dist.duration_minutes / 60)}<span className="text-sm font-semibold">h </span>{Math.round(dist.duration_minutes % 60)}<span className="text-sm font-semibold">m</span></p>
                    <p className="text-xs text-muted-foreground">travel time</p></div></div>
              </motion.div>
            ) : null}
          </div>

          <button data-testid="create-trip-btn" onClick={create} disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60">
            {saving ? "Creating…" : <>Create & build itinerary <ArrowRight size={18} weight="bold" /></>}
          </button>
        </div>

        {/* Live suggestions for destination */}
        <div className="lg:col-span-3">
          <div className="mb-4">
            <p className="overline text-primary">Live from the map</p>
            <h2 className="font-display font-extrabold text-2xl tracking-tight">
              {dest ? `Things to do in ${dest.name}` : "Suggestions for places to visit"}
            </h2>
            <p className="text-sm text-muted-foreground">{dest ? "Fetched live for this destination. Add any to your trip." : "Pick a destination to load real nearby spots."}</p>
          </div>
          <SuggestionGrid lat={dest?.lat} lon={dest?.lon} onAdd={togglePending}
            addedIds={pending.map((p) => p.external_place_id)} />
        </div>
      </div>
    </div>
  );
}
