import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import PlaceAutocomplete from "@/components/PlaceAutocomplete";
import SuggestionGrid from "@/components/SuggestionGrid";
import TripMap from "@/components/TripMap";
import PlaceReviewsModal from "@/components/PlaceReviewsModal";
import CollaboratorsModal from "@/components/CollaboratorsModal";
import TripSubNav from "@/components/TripSubNav";
import CustomPlaceModal from "@/components/CustomPlaceModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash, CarProfile, Clock, Sparkle, CaretDown, CaretUp, X, MapTrifold,
  ArrowRight, Star, UsersThree, Tag, Ticket, Lightbulb, MapPin, NotePencil, CopySimple,
} from "@phosphor-icons/react";

const TYPES = ["travel", "stay", "activity", "custom"];
const POPULAR_TAGS = ["Must Try", "Scenic View", "Pure Veg", "Family-Friendly", "Couples", "Budget", "Adventure", "Heritage"];

export default function BuildItinerary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [openSuggest, setOpenSuggest] = useState(null);
  const [reviewPlace, setReviewPlace] = useState(null);
  const [isCollabOpen, setIsCollabOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState("All");
  const [customPlaceSection, setCustomPlaceSection] = useState(null);

  const load = useCallback(async () => {
    const res = await api.get(`/trips/${id}/full`);
    setData(res.data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addSection = async () => {
    const n = (data?.sections?.length || 0) + 1;
    await api.post(`/trips/${id}/sections`, { type: "custom", title: `Section ${n}` });
    load();
  };

  const updateSection = async (sid, patch) => {
    try {
      await api.put(`/sections/${sid}`, patch);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Update failed"); }
  };

  const deleteSection = async (sid) => { await api.delete(`/sections/${sid}`); load(); };

  const duplicateSection = async (s) => {
    try {
      await api.post(`/trips/${id}/sections`, {
        type: s.type,
        title: `${s.title} (Copy)`,
        place_name: s.place_name || "",
        date_start: s.date_start || "",
        date_end: s.date_end || "",
        section_budget: s.section_budget || 0,
        notes: s.notes || "",
        latitude: s.latitude,
        longitude: s.longitude,
      });
      toast.success(`Section "${s.title}" duplicated!`);
      load();
    } catch {
      toast.error("Could not duplicate section.");
    }
  };

  const moveSection = async (index, dir) => {
    const ids = data.sections.map((s) => s.id);
    const ni = index + dir;
    if (ni < 0 || ni >= ids.length) return;
    [ids[index], ids[ni]] = [ids[ni], ids[index]];
    await api.post(`/trips/${id}/sections/reorder`, { order: ids });
    load();
  };

  const addPlace = async (sid, p) => {
    await api.post(`/sections/${sid}/places`, {
      external_place_id: p.external_place_id, name: p.name, category: p.category,
      rating: p.rating, photo_url: p.photo_url, description: p.description,
      lat: p.lat, lon: p.lon, cost_estimate: 0, tags: p.category === "food" ? ["Must Try"] : ["Heritage"],
    });
    toast.success(`Added ${p.name}`);
    load();
  };

  const togglePlaceTag = async (place, tag) => {
    const currentTags = place.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    try {
      await api.put(`/places/${place.id}`, { tags: newTags });
      load();
    } catch {
      toast.error("Could not update tag.");
    }
  };

  const removePlace = async (pid) => { await api.delete(`/places/${pid}`); load(); };

  if (!data) return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-5" data-testid="build-skeleton">
      <div className="h-8 w-48 rounded-2xl bg-muted animate-pulse" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-3xl border border-border bg-card p-6 space-y-3">
              <div className="flex gap-3 items-center">
                <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
                <div className="h-6 w-48 rounded-xl bg-muted animate-pulse" />
              </div>
              <div className="h-10 rounded-xl bg-muted animate-pulse" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-20 rounded-2xl bg-muted animate-pulse col-span-2" />
                <div className="h-20 rounded-2xl bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-96 rounded-3xl bg-muted animate-pulse" />
      </div>
    </div>
  );
  const { trip, sections } = data;

  const mapStops = sections.filter((s) => s.latitude != null)
    .map((s, i) => ({ lat: s.latitude, lon: s.longitude, name: s.title, label: i + 1, subtitle: s.place_name }));

  return (
    <div className="pb-24">
      {/* Persistent Trip Navigation Tab Bar */}
      <TripSubNav trip={trip} onTripUpdated={load} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        {/* Place Tag Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
          <span className="text-xs font-bold text-muted-foreground uppercase shrink-0 flex items-center gap-1">
            <Tag size={14} /> Filter by vibe:
          </span>
          {["All", ...POPULAR_TAGS].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTag(t)}
              className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedTag === t
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Great Adventure Call-to-Action Banner */}
        {sections.length > 0 && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary/15 via-accent to-primary/10 border border-primary/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                <Sparkle size={20} weight="fill" />
              </div>
              <div>
                <p className="font-display font-bold text-sm text-foreground">See Your Full Journey & Map</p>
                <p className="text-xs text-muted-foreground">View your interactive map with all hotels, food spots, sights & final computed budget.</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/trips/${id}/plan`)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap shadow-xs"
            >
              View Great Adventure ✨
            </button>
          </div>
        )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {sections.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">
              No sections yet. Add your first leg, stay or activity block below.
            </div>
          )}
          {sections.map((s, i) => (
            <motion.div key={s.id} data-testid={`section-card-${i}`} layout
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-black">{i + 1}</span>
                  <div>
                    <input data-testid={`section-title-${i}`} defaultValue={s.title}
                      onBlur={(e) => e.target.value !== s.title && updateSection(s.id, { title: e.target.value })}
                      className="font-display font-bold text-lg tracking-tight bg-transparent outline-none border-b border-transparent focus:border-primary" />
                    <div className="flex gap-1.5 mt-1">
                      {TYPES.map((t) => (
                        <button key={t} data-testid={`section-type-${i}-${t}`} onClick={() => updateSection(s.id, { type: t })}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-colors ${s.type === t ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex flex-col">
                    <button data-testid={`move-up-${i}`} onClick={() => moveSection(i, -1)} disabled={i === 0}
                      className="rounded p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors"><CaretUp size={16} weight="bold" /></button>
                    <button data-testid={`move-down-${i}`} onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1}
                      className="rounded p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors"><CaretDown size={16} weight="bold" /></button>
                  </div>
                  <button
                    data-testid={`duplicate-section-${i}`}
                    onClick={() => duplicateSection(s)}
                    title="Duplicate this section"
                    className="rounded-full p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <CopySimple size={16} />
                  </button>
                  <button data-testid={`delete-section-${i}`} onClick={() => deleteSection(s.id)}
                    className="rounded-full p-2 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"><Trash size={18} /></button>
                </div>
              </div>

              {s.distance_from_prev_km != null && (
                <div data-testid={`section-distance-${i}`} className="mb-4 flex items-center gap-4 rounded-xl bg-accent/60 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 font-semibold"><CarProfile size={16} weight="fill" className="text-primary" /> {s.distance_from_prev_km} km from previous</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Clock size={16} /> {Math.round(s.travel_time_from_prev_minutes)} min</span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Place</Label>
                  <div className="mt-1">
                    <PlaceAutocomplete value={s.place_name} testId={`section-place-${i}`}
                      onSelect={(p) => updateSection(s.id, { place_name: p.name, place_id: p.place_id, latitude: p.lat, longitude: p.lon })} />
                  </div>
                </div>
                <div><Label className="text-xs">Date range</Label>
                  <div className="flex gap-2 mt-1">
                    <Input data-testid={`section-date-start-${i}`} type="date" defaultValue={s.date_start || ""}
                      onBlur={(e) => updateSection(s.id, { date_start: e.target.value })} />
                    <Input data-testid={`section-date-end-${i}`} type="date" defaultValue={s.date_end || ""}
                      onBlur={(e) => updateSection(s.id, { date_end: e.target.value })} />
                  </div>
                </div>
                <div><Label className="text-xs">Budget for this section ({trip.currency_symbol || "₹"})</Label>
                  <Input data-testid={`section-budget-${i}`} type="number" min="0" defaultValue={s.section_budget || 0}
                    onBlur={(e) => updateSection(s.id, { section_budget: Number(e.target.value) })} className="mt-1" /></div>
                <div className="sm:col-span-2">
                  <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <NotePencil size={13} weight="bold" className="text-primary" />
                    Notes & Travel Tips for this Day / Leg (optional)
                  </Label>
                  <input
                    type="text"
                    defaultValue={s.notes || ""}
                    placeholder="e.g. Carry cash for entry, best sunset view from north gate, meet Rahul at 4pm..."
                    onBlur={(e) => updateSection(s.id, { notes: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Selected places */}
              {s.places?.length > 0 && (
                <div className="mt-4 space-y-2.5">
                  {s.places
                    .filter((p) => selectedTag === "All" || (p.tags && p.tags.includes(selectedTag)))
                    .map((p) => (
                    <div key={p.id} data-testid="section-place-item" className="rounded-2xl border border-border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <img src={p.photo_url} alt={p.name} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm line-clamp-1">{p.name}</p>
                            
                            {/* Star Rating Badge (Opens Review Drawer) */}
                            <button
                              onClick={() => setReviewPlace(p)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                              title="Click to view or add reviews"
                            >
                              <Star size={12} weight="fill" />
                              <span>{p.avg_rating != null ? p.avg_rating : (p.rating || "Review")}</span>
                              {p.review_count ? <span className="opacity-75">({p.review_count})</span> : null}
                            </button>

                            {/* Booking Link if present or attraction */}
                            {p.booking_url ? (
                              <a
                                href={p.booking_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              >
                                <Ticket size={12} weight="bold" /> Book
                              </a>
                            ) : p.category === "attraction" ? (
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(p.name + " " + s.place_name + " tickets entry fee")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                              >
                                <Ticket size={12} weight="bold" /> Tickets info
                              </a>
                            ) : null}
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-muted-foreground">{trip.currency_symbol || "₹"}</span>
                          <CostEditor key={p.id} place={p} onSaved={load} />
                        </div>
                        <button data-testid="remove-place-btn" onClick={() => removePlace(p.id)}
                          className="rounded-full p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"><X size={16} weight="bold" /></button>
                      </div>

                      {/* Tag selector chips */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/50">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/70">Tags:</span>
                        {POPULAR_TAGS.map((tag) => {
                          const hasTag = p.tags && p.tags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => togglePlaceTag(p, tag)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                                hasTag
                                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                  : "bg-background border border-border/60 text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              {hasTag ? `✓ ${tag}` : `+ ${tag}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions toggle & Custom Place Add */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {s.latitude != null && (
                  <button data-testid={`toggle-suggestions-${i}`} onClick={() => setOpenSuggest(openSuggest === s.id ? null : s.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15 transition-colors">
                    <Sparkle size={16} weight="fill" /> Live things to do in {s.place_name}
                    <CaretDown size={14} weight="bold" className={`transition-transform ${openSuggest === s.id ? "rotate-180" : ""}`} />
                  </button>
                )}

                {/* 1-Click Custom / Secret Spot Creator */}
                <button
                  type="button"
                  onClick={() => setCustomPlaceSection(s)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-primary/60 transition-colors shadow-xs"
                >
                  <MapPin size={16} className="text-amber-500" weight="bold" />
                  + Add Custom Spot / Hidden Gem
                </button>
              </div>

              {s.latitude != null && (
                <AnimatePresence>
                  {openSuggest === s.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="pt-4">
                        <SuggestionGrid lat={s.latitude} lon={s.longitude} compact
                          onAdd={(p) => addPlace(s.id, p)}
                          addedIds={s.places?.map((x) => x.external_place_id) || []} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </motion.div>
          ))}

          <button data-testid="add-section-btn" onClick={addSection}
            className="w-full inline-flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border py-5 font-semibold text-primary hover:border-primary hover:bg-primary/5 transition-colors">
            <Plus size={20} weight="bold" /> Add another Section
          </button>
        </div>

        {/* Mini map */}
        <div className="lg:sticky lg:top-20 h-fit">
          <p className="overline text-primary mb-2">Live route preview</p>
          <TripMap stops={mapStops} height={420} />
          <p className="text-xs text-muted-foreground mt-2">Markers update as you set each section's place.</p>
        </div>
      </div>

      {/* Place Reviews Drawer / Modal */}
      <PlaceReviewsModal
        place={reviewPlace}
        isOpen={Boolean(reviewPlace)}
        onClose={() => setReviewPlace(null)}
        onReviewUpdated={load}
      />

      {/* Collaborators Modal */}
      <CollaboratorsModal
        tripId={id}
        isOpen={isCollabOpen}
        onClose={() => setIsCollabOpen(false)}
      />

      {/* Custom Place Modal */}
      <CustomPlaceModal
        section={customPlaceSection}
        isOpen={Boolean(customPlaceSection)}
        onClose={() => setCustomPlaceSection(null)}
        onPlaceAdded={load}
        currencySymbol={trip?.currency_symbol || "₹"}
      />
      </div>
    </div>
  );
}

function CostEditor({ place, onSaved }) {
  const [val, setVal] = useState(place.cost_estimate || 0);
  return (
    <input data-testid="place-cost" type="number" min="0" value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={async () => {
        try { await api.put(`/places/${place.id}`, { cost_estimate: Number(val) || 0 }); onSaved && onSaved(); }
        catch { toast.error("Could not save cost — please try again."); }
      }}
      className="w-16 rounded-lg border border-input bg-card px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring" />
  );
}
