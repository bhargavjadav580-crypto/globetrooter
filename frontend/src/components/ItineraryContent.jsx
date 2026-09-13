import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import TripMap from "@/components/TripMap";
import PlaceReviewsModal from "@/components/PlaceReviewsModal";
import { AnimatedCounter, ScoreRing, PaceBadge } from "@/components/Widgets";
import {
  Warning, Lightbulb, MapPin, CurrencyInr, Sparkle, ForkKnife, Storefront,
  Camera, ArrowDown, ListBullets, CalendarBlank, Star, Tag, Ticket, NotePencil,
} from "@phosphor-icons/react";

const CAT_COLORS = {
  transport_cost: "hsl(14,72%,53%)", accommodation_cost: "hsl(152,34%,32%)",
  food_cost: "hsl(38,68%,50%)", activity_cost: "hsl(20,50%,45%)", other_cost: "hsl(90,28%,42%)",
};
const CAT_LABELS = {
  transport_cost: "Transport", accommodation_cost: "Stay", food_cost: "Food",
  activity_cost: "Activities", other_cost: "Other",
};
const PLACE_ICON = { food: ForkKnife, market: Storefront, attraction: Camera };

export default function ItineraryContent({ data, readOnly = false }) {
  const { trip, sections, budget, score, travel_load } = data;
  const bd = budget.breakdown;
  const [viewMode, setViewMode] = useState("list");
  const [reviewPlace, setReviewPlace] = useState(null);

  // Build calendar days from trip range
  const calDays = [];
  if (trip.start_date && trip.end_date) {
    let cur = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      const active = sections.filter((s) => s.date_start && (iso >= s.date_start) && (iso <= (s.date_end || s.date_start)));
      calDays.push({ date: iso, sections: active });
      cur = new Date(cur.getTime() + 86400000);
    }
  }

  const pieData = Object.keys(CAT_LABELS)
    .map((k) => ({ name: CAT_LABELS[k], value: bd[k], key: k }))
    .filter((d) => d.value > 0);

  const stops = [];
  if (trip.start_lat != null) stops.push({ lat: trip.start_lat, lon: trip.start_lon, name: trip.starting_point, label: "A", color: "hsl(152,34%,32%)", subtitle: "Start" });
  sections.filter((s) => s.latitude != null).forEach((s, i) => stops.push({ lat: s.latitude, lon: s.longitude, name: s.title, label: i + 1, subtitle: s.place_name }));
  if (trip.dest_lat != null) stops.push({ lat: trip.dest_lat, lon: trip.dest_lon, name: trip.destination, label: "B", color: "hsl(14,72%,53%)", subtitle: "Destination" });

  const totalSpent = bd.total_estimated;
  const totalBudget = bd.total_budget;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl">
        <img src={trip.cover_image} alt={trip.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-secondary/72" />
        <div className="relative z-10 p-8 text-white">
          <p className="overline text-white/70 mb-2">Itinerary</p>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter">{trip.name}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-white/90"><MapPin size={16} weight="fill" /> {trip.starting_point} → {trip.destination}</p>
          <p className="text-sm text-white/70 mt-1">{trip.start_date} — {trip.end_date}
            {trip.distance_km ? <span className="ml-2">· {trip.distance_km} km · {Math.round((trip.travel_time_minutes || 0) / 60)}h drive</span> : null}</p>
        </div>
      </div>

      {/* Score + Load + Budget summary */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Trip Score */}
        <div className="rounded-3xl border border-border bg-card p-6" data-testid="trip-score-panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="overline text-primary">Trip Score</h2>
            <PaceBadge pace={travel_load.pace} />
          </div>
          <div className="flex items-center gap-5">
            <ScoreRing score={score.total} />
            <div className="flex-1 space-y-2">
              {score.sub_scores.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-xs font-semibold"><span>{s.name}</span><span>{s.score}/{s.max}</span></div>
                  <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(s.score / s.max) * 100}%` }} transition={{ duration: 0.9 }}
                      className="h-full rounded-full bg-primary" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            {score.sub_scores.map((s) => (
              <p key={s.name} className="text-xs text-muted-foreground flex gap-1.5"><Sparkle size={13} weight="fill" className="mt-0.5 shrink-0 text-primary" />{s.explanation}</p>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2" data-testid="budget-panel">
          <div className="flex items-center justify-between mb-2">
            <h2 className="overline text-primary">Budget Summary</h2>
            <span className="text-xs text-muted-foreground">Computed live from your sections</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 items-center">
            <div className="h-48">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                      {pieData.map((d) => <Cell key={d.key} fill={CAT_COLORS[d.key]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Add section budgets to see the breakdown.</div>}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <CurrencyInr size={22} weight="bold" className="text-primary" />
                <AnimatedCounter value={totalSpent} className="font-display font-black text-4xl tracking-tighter" />
              </div>
              <p className="text-sm text-muted-foreground">planned spend of ₹{totalBudget.toLocaleString()} budget</p>
              {budget.average_cost_per_day > 0 && (
                <p className="text-xs text-primary font-semibold mt-1" data-testid="avg-cost-day">Avg ₹{budget.average_cost_per_day.toLocaleString()} / day</p>
              )}
              <div className="h-2.5 rounded-full bg-muted mt-3 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}%` }}
                  transition={{ duration: 1 }}
                  className={`h-full rounded-full ${budget.over_budget ? "bg-destructive" : "bg-secondary"}`} />
              </div>
              <div className="mt-4 space-y-1.5">
                {Object.keys(CAT_LABELS).map((k) => bd[k] > 0 && (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[k] }} />{CAT_LABELS[k]}</span>
                    <span className="font-semibold">₹{bd[k].toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Budget Guardian alerts */}
          {budget.alerts.length > 0 && (
            <div className="mt-5 space-y-2" data-testid="budget-alerts">
              {budget.alerts.map((a, i) => (
                <div key={a.section_id ?? a.section_title ?? i} className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-destructive"><Warning size={16} weight="fill" /> {a.message}</p>
                  {a.suggestion && <p className="flex items-start gap-2 text-xs text-muted-foreground mt-1"><Lightbulb size={14} weight="fill" className="mt-0.5 shrink-0 text-[hsl(38,68%,50%)]" /> {a.suggestion}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live map */}
      <div>
        <p className="overline text-primary mb-3">Live Trip Map</p>
        <TripMap stops={stops} route={trip.route_geometry || []} height={420} />
      </div>

      {/* Day-by-day flow */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="overline text-primary">{viewMode === "list" ? "Day-by-day flow" : "Calendar view"}</p>
          <div className="flex items-center gap-1 rounded-full bg-muted p-1" data-testid="view-toggle">
            <button data-testid="view-list" onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              <ListBullets size={15} weight="bold" /> List
            </button>
            <button data-testid="view-calendar" onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              <CalendarBlank size={15} weight="bold" /> Calendar
            </button>
          </div>
        </div>

        {viewMode === "calendar" ? (
          calDays.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">Set trip dates to see the calendar view.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4" data-testid="calendar-days">
              {calDays.map((d, di) => (
                <div key={d.date} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-display font-bold tracking-tight mb-2">Day {di + 1} · <span className="text-muted-foreground text-sm font-medium">{d.date}</span></p>
                  {d.sections.length === 0 ? <p className="text-sm text-muted-foreground">No plans this day.</p> : d.sections.map((s) => (
                    <div key={s.id} className="mb-2">
                      <p className="text-sm font-semibold flex items-center gap-1"><MapPin size={13} weight="fill" className="text-primary" /> {s.title}</p>
                      {s.places?.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground pl-4 py-0.5">
                          <span className="line-clamp-1">{p.name}</span><span className="font-semibold">₹{(p.cost_estimate || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        ) : sections.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">No sections yet.</div>
        ) : (
          <div className="space-y-8">
            {sections.map((s, si) => (
              <div key={s.id} data-testid={`itinerary-section-${si}`}>
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">Section {si + 1}</span>
                  <h3 className="font-display font-bold tracking-tight">{s.title}</h3>
                  {s.date_start && <span className="text-xs text-muted-foreground">{s.date_start}{s.date_end ? ` — ${s.date_end}` : ""}</span>}
                  {s.distance_from_prev_km != null && <span className="text-xs text-primary font-semibold">· {s.distance_from_prev_km} km leg</span>}
                </div>
                {s.notes && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-900 dark:text-amber-300">
                    <NotePencil size={15} weight="bold" className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed"><strong>Note:</strong> {s.notes}</p>
                  </div>
                )}
                {s.places?.length ? (
                  <div className="space-y-0">
                    {s.places.map((p, pi) => {
                      const Icon = PLACE_ICON[p.category] || Camera;
                      return (
                        <div key={p.id}>
                          <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2 card-hover">
                            <div className="flex items-center gap-3">
                              <div className="rounded-xl bg-accent p-2.5 text-accent-foreground shrink-0"><Icon size={20} weight="bold" /></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-sm line-clamp-1">{p.name}</p>
                                  
                                  {/* Star Rating Badge (Opens Review Drawer) */}
                                  <button
                                    onClick={() => setReviewPlace(p)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                                    title="View or add reviews"
                                  >
                                    <Star size={12} weight="fill" />
                                    <span>{p.avg_rating != null ? p.avg_rating : (p.rating || "Review")}</span>
                                    {p.review_count ? <span className="opacity-75">({p.review_count})</span> : null}
                                  </button>

                                  {/* Booking info */}
                                  {p.booking_url ? (
                                    <a href={p.booking_url} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                                      <Ticket size={12} weight="bold" /> Book
                                    </a>
                                  ) : p.category === "attraction" ? (
                                    <a href={`https://www.google.com/search?q=${encodeURIComponent(p.name + " " + (s.place_name || "") + " tickets entry")}`} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">
                                      <Ticket size={12} weight="bold" /> Tickets
                                    </a>
                                  ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>
                              </div>
                              <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold whitespace-nowrap shrink-0">₹{(p.cost_estimate || 0).toLocaleString()}</span>
                            </div>

                            {/* Tags list */}
                            {p.tags?.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pl-11">
                                {p.tags.map((tag) => (
                                  <span key={tag} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {pi < s.places.length - 1 && <div className="flex justify-center py-1"><ArrowDown size={16} className="text-muted-foreground" /></div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground pl-1">₹{(s.section_budget || 0).toLocaleString()} budget · no activities added yet.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Place Reviews Modal */}
      <PlaceReviewsModal
        place={reviewPlace}
        isOpen={Boolean(reviewPlace)}
        onClose={() => setReviewPlace(null)}
      />
    </div>
  );
}
