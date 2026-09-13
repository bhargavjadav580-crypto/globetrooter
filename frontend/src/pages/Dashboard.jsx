import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import {
  Plus, MagnifyingGlass, MapPin, ArrowRight, Mountains, Buildings, Waves,
  TreePalm, Wallet, Suitcase, MapTrifold, PencilSimple, Sparkle, Eye,
} from "@phosphor-icons/react";
import { AnimatedCounter } from "@/components/Widgets";

const REGIONS = [
  { name: "Beaches", q: "Goa", icon: Waves, img: "https://images.pexels.com/photos/1078850/pexels-photo-1078850.jpeg" },
  { name: "Mountains", q: "Manali", icon: Mountains, img: "https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg" },
  { name: "Heritage Cities", q: "Jaipur", icon: Buildings, img: "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg" },
  { name: "Tropical", q: "Kerala", icon: TreePalm, img: "https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=70" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => { api.get("/trips").then((r) => setTrips(r.data)).catch(() => {}); }, []);

  const filtered = trips.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="pb-28">
      {/* Banner */}
      <div className="relative overflow-hidden">
        <img src="https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg" alt="Explore"
          className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-secondary/72" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 text-white">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overline text-white/70 mb-3">
            Welcome back, {user?.first_name || "Traveler"}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="font-display font-black text-4xl sm:text-6xl tracking-tighter max-w-2xl leading-[0.95]">
            Where does the map pull you next?
          </motion.h1>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl">
            <div className="relative flex-1">
              <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input data-testid="dashboard-search" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search your trips…"
                className="w-full rounded-full bg-card/95 pl-11 pr-4 py-3.5 text-foreground outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <button data-testid="dashboard-discover-btn" onClick={() => navigate("/search")}
              className="rounded-full bg-primary px-6 py-3.5 font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
              Discover a city
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Budget highlights */}
        <section className="mt-8" data-testid="budget-highlights">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Suitcase, label: "Total trips", value: trips.length, prefix: "" },
              { icon: MapTrifold, label: "Total stops", value: trips.reduce((a, t) => a + (t.stop_count || 0), 0), prefix: "" },
              { icon: Wallet, label: "Budget total (INR)", value: trips.filter(t => !t.currency_code || t.currency_code === "INR").reduce((a, t) => a + (t.total_budget || 0), 0), prefix: "₹" },
              { icon: MapPin, label: "Upcoming", value: trips.filter((t) => t.start_date && t.start_date > new Date().toISOString().slice(0, 10)).length, prefix: "" },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-border bg-card p-5 card-hover shadow-xs">
                <k.icon size={20} weight="bold" className="text-primary mb-2" />
                <AnimatedCounter value={k.value} prefix={k.prefix} className="font-display font-black text-2xl sm:text-3xl tracking-tighter block" />
                <p className="text-sm text-muted-foreground">{k.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming Trip Reminder Banner */}
        {(() => {
          const today = new Date();
          const upcoming = trips
            .filter((t) => t.start_date)
            .map((t) => ({
              ...t,
              daysUntil: Math.ceil((new Date(t.start_date + "T00:00:00") - today) / (1000 * 60 * 60 * 24)),
            }))
            .filter((t) => t.daysUntil >= 0 && t.daysUntil <= 7)
            .sort((a, b) => a.daysUntil - b.daysUntil)[0];

          if (!upcoming) return null;

          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg"
            >
              <div className="flex items-center gap-3 text-white">
                <span className="text-3xl">🗓</span>
                <div>
                  <p className="font-display font-black text-lg tracking-tight">
                    {upcoming.daysUntil === 0
                      ? "Your trip starts TODAY! 🎉"
                      : upcoming.daysUntil === 1
                      ? `Your "${upcoming.name}" trip starts TOMORROW!`
                      : `"${upcoming.name}" starts in ${upcoming.daysUntil} days!`}
                  </p>
                  <p className="text-sm text-white/80">
                    {upcoming.starting_point} ➔ {upcoming.destination} · Is your packing list ready?
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/trips/${upcoming.id}/roadtrip`)}
                className="rounded-full bg-white text-orange-600 px-5 py-2 font-bold text-sm hover:bg-orange-50 transition-colors shrink-0"
              >
                View Trip Plan →
              </button>
            </motion.div>
          );
        })()}

        {/* Top Regional Selections */}
        <section className="mt-12">
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="overline text-primary">Explore by vibe</p>
              <h2 className="font-display font-extrabold text-2xl tracking-tight">Top Regional Selections</h2>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {REGIONS.map((r, i) => (
              <motion.button key={r.name} data-testid={`region-${i}`}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => navigate(`/search?q=${r.q}`)}
                className="group relative shrink-0 w-56 h-40 rounded-3xl overflow-hidden border border-border text-left">
                <img src={r.img} alt={r.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 p-4 text-white">
                  <r.icon size={22} weight="fill" className="mb-1" />
                  <p className="font-display font-bold tracking-tight">{r.name}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Previous Trips */}
        <section className="mt-12">
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="overline text-primary">Your journeys</p>
              <h2 className="font-display font-extrabold text-2xl tracking-tight">Previous Trips</h2>
            </div>
            <button data-testid="see-all-trips" onClick={() => navigate("/trips")}
              className="flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all">
              See all <ArrowRight size={16} weight="bold" />
            </button>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center">
              <MapPin size={40} weight="duotone" className="mx-auto text-primary mb-3" />
              <p className="font-semibold mb-1">No trips yet</p>
              <p className="text-muted-foreground text-sm mb-5">Plan your first journey with live maps and budgets.</p>
              <button data-testid="empty-plan-btn" onClick={() => navigate("/trips/new")}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
                <Plus size={18} weight="bold" /> Plan a trip
              </button>
            </div>
          ) : (
            <div className="flex gap-5 overflow-x-auto no-scrollbar pb-2">
              {filtered.map((t, i) => (
                <motion.div key={t.id} data-testid={`trip-card-${i}`}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/trips/${t.id}/view`)}
                  className="group shrink-0 w-72 rounded-3xl overflow-hidden border border-border bg-card text-left card-hover cursor-pointer">
                  <div className="relative h-40 overflow-hidden">
                    <img src={t.cover_image} alt={t.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {/* Status Badge */}
                    {t.start_date && (() => {
                      const today = new Date().toISOString().slice(0, 10);
                      const isUpcoming = t.start_date > today;
                      const isPast = t.end_date && t.end_date < today;
                      const isActive = !isUpcoming && !isPast;
                      return (
                        <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isActive ? "bg-green-500 text-white" :
                          isUpcoming ? "bg-amber-500 text-white" :
                          "bg-gray-700/80 text-gray-200"
                        }`}>
                          {isActive ? "🟢 Active" : isUpcoming ? "🗓 Upcoming" : "✓ Completed"}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="p-5">
                    <h3 className="font-display font-bold text-lg tracking-tight line-clamp-1">{t.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin size={14} weight="fill" /> {t.starting_point} → {t.destination}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t.start_date ? new Date(t.start_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      {t.end_date ? ` — ${new Date(t.end_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    </p>
                    {/* Trip Progress Indicator */}
                    {(() => {
                      const steps = [
                        { label: "Itinerary", done: (t.stop_count || 0) > 0 },
                        { label: "Budget", done: (t.total_budget || 0) > 0 },
                        { label: "Dates", done: !!(t.start_date && t.end_date) },
                      ];
                      const doneCount = steps.filter(s => s.done).length;
                      return (
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground font-semibold">{doneCount}/{steps.length} ready</span>
                            <span className="text-[10px] font-bold text-primary">{Math.round((doneCount / steps.length) * 100)}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${(doneCount / steps.length) * 100}%` }}
                            />
                          </div>
                          <div className="flex gap-1.5 mt-1">
                            {steps.map(s => (
                              <span key={s.label} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                s.done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                              }`}>
                                {s.done ? "✓" : "○"} {s.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Quick action bar */}
                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/trips/${t.id}/build`);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-muted hover:bg-accent px-2 py-1.5 text-[11px] font-semibold text-foreground transition-colors"
                        title="Edit Trip Itinerary"
                      >
                        <PencilSimple size={12} weight="bold" /> Build
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/trips/${t.id}/view`);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-muted hover:bg-accent px-2 py-1.5 text-[11px] font-semibold text-foreground transition-colors"
                        title="View Day-by-Day Timeline"
                      >
                        <Eye size={12} weight="bold" /> View
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/trips/${t.id}/plan`);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1.5 text-[11px] font-bold transition-colors"
                        title="View Full Adventure Journey Map"
                      >
                        <Sparkle size={12} weight="fill" /> Adventure
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>

      <button data-testid="fab-plan-trip" onClick={() => navigate("/trips/new")}
        className="fixed bottom-6 right-6 z-[800] flex items-center gap-2 rounded-full bg-primary px-6 py-4 font-bold text-primary-foreground shadow-xl hover:scale-105 active:scale-95 transition-transform">
        <Plus size={22} weight="bold" /> Plan a Trip
      </button>
    </div>
  );
}
