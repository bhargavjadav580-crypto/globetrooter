import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaretLeft, CaretRight, Eye, MapPin } from "@phosphor-icons/react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PALETTE = ["hsl(14,72%,53%)", "hsl(152,34%,32%)", "hsl(38,68%,50%)", "hsl(20,50%,45%)", "hsl(90,28%,42%)"];

export default function CalendarView() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => { api.get("/trips").then((r) => setTrips(r.data)).catch(() => {}); }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const tripColor = {};
  trips.forEach((t, i) => { tripColor[t.id] = PALETTE[i % PALETTE.length]; });

  const tripsOn = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    return trips.filter((t) => t.start_date && t.end_date && iso >= t.start_date && iso <= t.end_date);
  };

  const monthName = cursor.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <p className="overline text-primary mb-1">Plan across time</p>
      <h1 className="font-display font-black text-4xl tracking-tighter mb-8">Calendar View</h1>

      <div className="rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <button data-testid="cal-prev" onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-full p-2.5 hover:bg-accent transition-colors"><CaretLeft size={20} weight="bold" /></button>
          <h2 data-testid="cal-month" className="font-display font-black text-2xl tracking-tighter">{monthName}</h2>
          <button data-testid="cal-next" onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-full p-2.5 hover:bg-accent transition-colors"><CaretRight size={20} weight="bold" /></button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {DAYS.map((d) => <div key={d} className="text-center overline text-muted-foreground py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((date, i) => (
            <div key={i} data-testid={date ? `cal-day-${date.getDate()}` : `cal-empty-${i}`}
              onClick={() => date && tripsOn(date).length > 0 && setSelectedDay(date)}
              className={`min-h-[84px] rounded-xl border p-1.5 ${date ? "border-border bg-background" : "border-transparent"} ${date && tripsOn(date).length > 0 ? "cursor-pointer hover:border-primary transition-colors" : ""}`}>
              {date && (
                <>
                  <span className="text-xs font-semibold text-muted-foreground">{date.getDate()}</span>
                  <div className="mt-1 space-y-1">
                    {tripsOn(date).slice(0, 3).map((t) => (
                      <motion.button key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/trips/${t.id}/view`); }}
                        className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-white"
                        style={{ background: tripColor[t.id] }}>
                        {t.name}
                      </motion.button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display tracking-tight">
            {selectedDay?.toLocaleDateString("default", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </DialogTitle></DialogHeader>
          <div className="space-y-2" data-testid="cal-day-detail">
            {selectedDay && tripsOn(selectedDay).map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="h-8 w-1.5 rounded-full" style={{ background: tripColor[t.id] }} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm line-clamp-1">{t.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} weight="fill" /> {t.starting_point} → {t.destination}</p>
                </div>
                <button data-testid={`cal-view-${t.id}`} onClick={() => navigate(`/trips/${t.id}/view`)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">
                  <Eye size={15} weight="bold" /> View
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
