import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import PlaceAutocomplete from "@/components/PlaceAutocomplete";
import SuggestionGrid from "@/components/SuggestionGrid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { CarProfile, Clock, ArrowRight, SpinnerGap, Warning, MapPinLine } from "@phosphor-icons/react";
import ImageUploader from "@/components/ImageUploader";

export default function CreateTrip() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const COVERS = [
    "https://images.pexels.com/photos/1078850/pexels-photo-1078850.jpeg",
    "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg",
    "https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg",
    "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=70",
  ];
  const [cover, setCover] = useState(COVERS[0]);
  const [start, setStart] = useState(null);
  const [dest, setDest] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [dist, setDist] = useState(null);
  const [distLoading, setDistLoading] = useState(false);
  const [distError, setDistError] = useState(false);
  const [pending, setPending] = useState([]);
  const [saving, setSaving] = useState(false);

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
    if (!name.trim()) return toast.error("Give your trip a name.");
    if (!start || !dest) return toast.error("Pick a real starting point and destination.");
    if (!startDate || !endDate) return toast.error("Choose start and end dates.");
    if (endDate < startDate) return toast.error("End date must be after start date.");
    setSaving(true);
    try {
      const res = await api.post("/trips", {
        name, description, cover_image: cover,
        starting_point: start.name, starting_point_place_id: start.place_id,
        start_lat: start.lat, start_lon: start.lon,
        destination: dest.name, destination_place_id: dest.place_id,
        dest_lat: dest.lat, dest_lon: dest.lon,
        start_date: startDate, end_date: endDate, total_budget: Number(budget) || 0,
      });
      const trip = res.data;
      if (pending.length > 0) {
        const sec = await api.post(`/trips/${trip.id}/sections`, {
          type: "activity", title: dest.name, place_name: dest.name,
          latitude: dest.lat, longitude: dest.lon,
          date_start: startDate, date_end: endDate,
        });
        for (const p of pending) {
          await api.post(`/sections/${sec.data.id}/places`, {
            external_place_id: p.external_place_id, name: p.name, category: p.category,
            rating: p.rating, photo_url: p.photo_url, description: p.description,
            lat: p.lat, lon: p.lon, cost_estimate: 0,
          });
        }
      }
      toast.success("Trip created! Let's build the itinerary.");
      navigate(`/trips/${trip.id}/build`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not create trip.");
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <p className="overline text-primary mb-2">New adventure</p>
      <h1 className="font-display font-black text-4xl tracking-tighter mb-8">Plan a new trip</h1>

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
