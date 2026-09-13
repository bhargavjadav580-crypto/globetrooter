import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PencilSimple, Eye, Trash, MapPin, CalendarBlank, Plus } from "@phosphor-icons/react";

function groupTrips(trips) {
  const today = new Date().toISOString().slice(0, 10);
  const g = { Ongoing: [], Upcoming: [], Completed: [] };
  trips.forEach((t) => {
    if (t.start_date && t.end_date) {
      if (t.start_date <= today && t.end_date >= today) g.Ongoing.push(t);
      else if (t.start_date > today) g.Upcoming.push(t);
      else g.Completed.push(t);
    } else g.Upcoming.push(t);
  });
  return g;
}

export default function TripListing() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);

  const load = () => api.get("/trips").then((r) => setTrips(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    await api.delete(`/trips/${id}`);
    toast.success("Trip deleted");
    load();
  };

  const groups = groupTrips(trips);
  const colors = { Ongoing: "text-primary", Upcoming: "text-secondary", Completed: "text-muted-foreground" };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="overline text-primary mb-1">Your travel log</p>
          <h1 className="font-display font-black text-4xl tracking-tighter">My Trips</h1>
        </div>
        <button data-testid="new-trip-btn" onClick={() => navigate("/trips/new")}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
          <Plus size={18} weight="bold" /> New trip
        </button>
      </div>

      {trips.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No trips yet — start planning your first adventure.
        </div>
      )}

      {["Ongoing", "Upcoming", "Completed"].map((key) => groups[key].length > 0 && (
        <section key={key} className="mb-10" data-testid={`group-${key.toLowerCase()}`}>
          <h2 className={`overline mb-4 ${colors[key]}`}>{key}</h2>
          <div className="space-y-4">
            {groups[key].map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                data-testid={`listing-trip-${i}`}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:border-primary/50 transition-colors">
                <img src={t.cover_image} alt={t.name} className="h-20 w-28 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-lg tracking-tight line-clamp-1">{t.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin size={14} weight="fill" /> {t.starting_point} → {t.destination}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><CalendarBlank size={13} /> {t.start_date} — {t.end_date}
                    <span className="ml-2">· {t.stop_count || 0} stop{(t.stop_count || 0) === 1 ? "" : "s"}</span>
                    {t.distance_km ? <span className="ml-2">· {t.distance_km} km</span> : null}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button data-testid={`view-btn-${i}`} onClick={() => navigate(`/trips/${t.id}/view`)}
                    className="rounded-full p-2.5 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"><Eye size={18} weight="bold" /></button>
                  <button data-testid={`edit-btn-${i}`} onClick={() => navigate(`/trips/${t.id}/build`)}
                    className="rounded-full p-2.5 text-muted-foreground hover:text-secondary hover:bg-accent transition-colors"><PencilSimple size={18} weight="bold" /></button>
                  <button data-testid={`delete-btn-${i}`} onClick={() => del(t.id)}
                    className="rounded-full p-2.5 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"><Trash size={18} weight="bold" /></button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
