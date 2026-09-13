import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Printer, CircleNotch } from "@phosphor-icons/react";
import TripSubNav from "@/components/TripSubNav";

const CAT_EMOJI = { attraction: "🏛", food: "🍽", market: "🛍", stay: "🏨", transport: "🚗", general: "📍", market_food: "🥘" };
const CAT_LABEL = { attraction: "Attraction", food: "Food & Dining", market: "Market & Shopping", stay: "Stay", transport: "Transport", general: "Activity" };

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatShortDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function TripBrochure() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [stays, setStays] = useState([]);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const brochureRef = useRef(null);

  const loadAll = useCallback(async () => {
    try {
      const [fullR, staysR, budgetR] = await Promise.all([
        api.get(`/trips/${id}/full`),
        api.get(`/trips/${id}/overnight-stays`),
        api.get(`/trips/${id}/final-budget`).catch(() => ({ data: null })),
      ]);
      setData(fullR.data);
      setStays(staysR.data || []);
      // final-budget returns { numbers, narrative } — extract numbers for display
      const budgetData = budgetR.data;
      if (budgetData?.numbers) {
        const n = budgetData.numbers;
        setBudget({
          total_budget: n.trip_budget || 0,
          total_planned_spend: n.grand_total || 0,
          narrative: budgetData.narrative,
          breakdown: {
            stays: n.overnight_stays?.total_cost || 0,
            food: n.itinerary_costs?.breakdown?.food || 0,
            activities: n.itinerary_costs?.breakdown?.attractions || 0,
            transport: n.drive_costs?.total || 0,
          },
        });
      }
    } catch {
      toast.error("Could not load trip data for brochure.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground gap-2">
        <CircleNotch size={22} className="animate-spin" /> Preparing brochure…
      </div>
    );
  }

  if (!data) return null;

  const { trip, sections = [], places = [], score } = data;
  const placesBySection = {};
  sections.forEach(sec => { placesBySection[sec.id] = []; });
  places.forEach(p => {
    if (placesBySection[p.section_id]) placesBySection[p.section_id].push(p);
    else placesBySection[p.section_id] = [p];
  });

  const staysByNight = {};
  stays.forEach(st => { staysByNight[st.waypoint_index] = st; });

  const totalPlaces = places.length;
  const attractions = places.filter(p => p.category === "attraction").length;
  const foodSpots = places.filter(p => p.category === "food").length;
  const markets = places.filter(p => p.category === "market").length;
  const planned = budget?.total_budget || trip.total_budget || 0;
  const spent = budget?.total_planned_spend || 0;
  const sym = trip.currency_symbol || "₹";

  return (
    <>
      {/* ─── Screen-only toolbar (hidden when printing) ─── */}
      <div className="no-print">
        <TripSubNav trip={trip} onTripUpdated={loadAll} />
        <div className="bg-card border-b border-border flex items-center justify-between px-6 py-2.5 shadow-2xs">
          <span className="text-xs text-muted-foreground hidden sm:block">
            Pro Tip: In print options, check "Background graphics" to preserve all card styling.
          </span>
          <button onClick={handlePrint}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-1.5 rounded-full text-xs hover:bg-primary/90 transition-colors ml-auto shadow-xs">
            <Printer size={15} weight="bold" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* ─── Brochure content ─── */}
      <div ref={brochureRef} className="brochure-root mx-auto max-w-[820px] px-8 pb-16 pt-8 bg-white font-sans text-[#1a1a2e]">

        {/* COVER SECTION */}
        <div className="brochure-cover relative rounded-3xl overflow-hidden mb-10 h-[260px] flex flex-col justify-end"
          style={{ background: trip.cover_image ? "none" : "linear-gradient(135deg,#1a1a2e,#16213e)" }}>
          {trip.cover_image && (
            <img src={trip.cover_image} alt={trip.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={e => { e.target.style.display = "none"; }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="relative p-8 text-white">
            <div className="flex items-center gap-2 mb-2 opacity-80">
              <span className="text-xs font-bold tracking-widest uppercase">GlobeTrotter Trip Brochure</span>
            </div>
            <h1 className="text-3xl font-black leading-tight mb-1">{trip.name}</h1>
            <p className="text-white/80 font-medium">{trip.starting_point} → {trip.destination}</p>
          </div>
        </div>

        {/* TRIP STATS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Duration", value: `${sections.length > 0 ? sections.length : "—"} Days`, icon: "📅" },
            { label: "Total Budget", value: `${sym}${planned.toLocaleString("en-IN")}`, icon: "💰" },
            { label: "Distance", value: `${Math.round(trip.distance_km || 0)} km`, icon: "🗺" },
            { label: "Trip Score", value: `${score?.total || "—"}/100`, icon: "⭐" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-2xl border border-[#e8e8f0] bg-[#f8f8fe] p-4 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-lg font-black text-[#1a1a2e]">{value}</div>
              <div className="text-xs text-[#6b6b8a] font-medium uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>

        {/* DATES & ROUTE */}
        <div className="rounded-2xl border border-[#e8e8f0] bg-[#f8f8fe] px-6 py-4 mb-10 flex flex-wrap gap-6 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-[#6b6b8a] mb-0.5">Departure</div>
            <div className="font-bold text-[#1a1a2e]">{formatDate(trip.start_date)}</div>
          </div>
          <div className="text-2xl text-[#c0bfd8]">→</div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-[#6b6b8a] mb-0.5">Return</div>
            <div className="font-bold text-[#1a1a2e]">{formatDate(trip.end_date)}</div>
          </div>
          {trip.description && (
            <div className="w-full text-sm text-[#4a4a6a] leading-relaxed border-t border-[#e8e8f0] pt-3 mt-1">
              {trip.description}
            </div>
          )}
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { count: attractions, label: "Attractions", emoji: "🏛" },
            { count: foodSpots, label: "Food & Dining", emoji: "🍽" },
            { count: markets, label: "Markets", emoji: "🛍" },
          ].map(({ count, label, emoji }) => (
            <div key={label} className="rounded-2xl border border-[#e8e8f0] p-4 flex items-center gap-3">
              <span className="text-2xl">{emoji}</span>
              <div>
                <div className="text-xl font-black">{count}</div>
                <div className="text-xs text-[#6b6b8a] font-medium">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── DAY-BY-DAY ITINERARY ─── */}
        <h2 className="text-xl font-black mb-6 pb-2 border-b-2 border-[#1a1a2e] flex items-center gap-2">
          📋 Day-by-Day Itinerary
        </h2>

        {sections.map((sec, si) => {
          const secPlaces = placesBySection[sec.id] || [];
          const nightStay = staysByNight[si + 1];
          const hasDate = sec.date_start;

          return (
            <div key={sec.id} className="brochure-section mb-8">
              {/* Section header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#1a1a2e] text-white font-black text-sm flex items-center justify-center">
                  {si + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h3 className="font-black text-lg leading-tight">{sec.title}</h3>
                    {hasDate && (
                      <span className="text-xs font-bold text-[#6b6b8a] bg-[#f0f0fa] px-2 py-0.5 rounded-full">
                        {formatShortDate(hasDate)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-[#6b6b8a]">📍 {sec.place_name}</div>
                </div>
                {sec.section_budget > 0 && (
                  <div className="text-right shrink-0">
                    <div className="text-xs text-[#6b6b8a] font-medium">Section Budget</div>
                    <div className="font-black text-[#1a1a2e]">{sym}{sec.section_budget.toLocaleString("en-IN")}</div>
                  </div>
                )}
              </div>

              {/* Places list */}
              {secPlaces.length > 0 && (
                <div className="ml-12 space-y-2">
                  {secPlaces.map((place, pi) => (
                    <div key={place.id} className="flex items-start gap-3 p-3 rounded-xl border border-[#e8e8f0] bg-[#fafafe]">
                      <span className="text-lg flex-shrink-0 mt-0.5">{CAT_EMOJI[place.category] || "📍"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{place.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-[#f0f0fa] text-[#6b6b8a] font-medium">
                            {CAT_LABEL[place.category] || place.category}
                          </span>
                          {(place.avg_rating || place.rating) && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                              ★ {place.avg_rating || place.rating}
                            </span>
                          )}
                          {place.scheduled_time && (
                            <span className="text-xs text-[#8b8baa]">🕒 {place.scheduled_time}</span>
                          )}
                        </div>
                        {place.tags?.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {place.tags.map((t) => (
                              <span key={t} className="text-[10px] font-semibold text-[#6b6b8a] bg-[#eef] px-1.5 py-0.2 rounded">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                        {place.description && (
                          <p className="text-xs text-[#6b6b8a] mt-0.5 leading-relaxed">{place.description}</p>
                        )}
                      </div>
                      {place.cost_estimate > 0 && (
                        <div className="text-sm font-bold text-[#1a1a2e] shrink-0">
                          {sym}{place.cost_estimate.toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Night stay */}
              {nightStay && (
                <div className="ml-12 mt-2 flex items-center gap-3 p-3 rounded-xl border border-[#dbeafe] bg-[#eff6ff]">
                  <span className="text-lg">🏨</span>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-[#1e40af]">{nightStay.hotel_name}</div>
                    <div className="text-xs text-[#3b82f6]">Night stay · {nightStay.night_date}</div>
                  </div>
                  {nightStay.price_estimate > 0 && (
                    <div className="text-sm font-bold text-[#1e40af] shrink-0">
                      {sym}{nightStay.price_estimate.toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ─── BUDGET SUMMARY ─── */}
        {budget && (
          <>
            <h2 className="text-xl font-black mb-6 pb-2 border-b-2 border-[#1a1a2e] flex items-center gap-2 mt-10">
              💰 Budget Summary
            </h2>
            <div className="rounded-2xl border border-[#e8e8f0] overflow-hidden mb-10">
              {[
                ["🏨 Accommodation & Stays", budget.breakdown?.stays],
                ["🍽 Food & Dining", budget.breakdown?.food],
                ["🏛 Activities & Attractions", budget.breakdown?.activities],
                ["🚗 Transport & Fuel", budget.breakdown?.transport],
              ].filter(([, v]) => v > 0).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0fa] last:border-0">
                  <span className="text-sm font-medium text-[#4a4a6a]">{label}</span>
                  <span className="font-bold">{sym}{Number(value || 0).toLocaleString("en-IN")}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-4 bg-[#1a1a2e] text-white">
                <span className="font-bold">Estimated Total Spend</span>
                <span className="font-black text-lg">{sym}{spent.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3 bg-[#f8f8fe]">
                <span className="text-sm font-medium text-[#6b6b8a]">Trip Budget</span>
                <span className="font-bold">{sym}{planned.toLocaleString("en-IN")}</span>
              </div>
              <div className={`flex items-center justify-between px-5 py-3 ${spent > planned ? "bg-red-50" : "bg-green-50"}`}>
                <span className="text-sm font-bold">{spent > planned ? "⚠️ Over Budget by" : "✅ Remaining Budget"}</span>
                <span className={`font-black ${spent > planned ? "text-red-700" : "text-green-700"}`}>
                  {sym}{Math.abs(planned - spent).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </>
        )}

        {/* AI NARRATIVE */}
        {budget?.narrative && (
          <>
            <h2 className="text-xl font-black mb-4 pb-2 border-b-2 border-[#1a1a2e] flex items-center gap-2">
              🤖 AI Trip Insights
            </h2>
            <div className="rounded-2xl border border-[#e8e8f0] bg-[#f8f8fe] p-6 mb-10">
              <p className="text-sm text-[#4a4a6a] leading-relaxed whitespace-pre-line">{budget.narrative}</p>
            </div>
          </>
        )}

        {/* ─── FOOTER ─── */}
        <div className="mt-10 pt-6 border-t border-[#e8e8f0] flex items-center justify-between text-xs text-[#9b9bba]">
          <span>Generated by <strong>GlobeTrotter</strong> · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
          <span>{trip.starting_point} → {trip.destination} · {totalPlaces} places</span>
        </div>
      </div>

      {/* ─── Print CSS (injected into <head> at runtime) ─── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .brochure-root {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .brochure-cover { height: 220px !important; }
          .brochure-section { page-break-inside: avoid; }
          @page {
            size: A4;
            margin: 15mm 12mm;
          }
        }
      `}</style>
    </>
  );
}
