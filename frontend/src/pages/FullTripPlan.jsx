import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import TripMap from "@/components/TripMap";
import TripSubNav from "@/components/TripSubNav";
import {
  ArrowLeft, MapTrifold, Flag, FlagCheckered, Bed, MapPin, CircleNotch,
  ArrowSquareOut, ShareNetwork, Clock, Path, Printer, Wallet, Sparkle,
  ForkKnife, Storefront, Camera, Compass, Star,
} from "@phosphor-icons/react";

const COLORS = {
  start: "hsl(152,34%,32%)", // Forest green
  dest: "hsl(0,72%,50%)",    // Crimson
  stay: "hsl(38,68%,50%)",   // Amber / Gold
  food: "hsl(14,72%,53%)",   // Coral / Warm Orange
  market: "hsl(280,60%,50%)", // Purple
  attraction: "hsl(215,70%,50%)", // Royal Blue
  activity: "hsl(165,60%,38%)", // Emerald
  section: "hsl(20,50%,45%)",  // Terracotta
};

function haversine(aLat, aLon, bLat, bLon) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function fmtDur(min) {
  if (min == null || min <= 0) return "0m";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function getCategoryKind(place) {
  const cat = (place.category || "").toLowerCase();
  const tags = place.tags || [];
  if (cat.includes("food") || cat.includes("restaurant") || cat.includes("cafe") || cat.includes("dining") || tags.includes("Food")) {
    return "food";
  }
  if (cat.includes("market") || cat.includes("shopping") || cat.includes("shop") || cat.includes("mall") || tags.includes("Shopping")) {
    return "market";
  }
  if (cat.includes("hotel") || cat.includes("stay") || cat.includes("resort") || cat.includes("hostel") || cat.includes("lodge")) {
    return "stay";
  }
  if (cat.includes("activity") || cat.includes("adventure") || tags.includes("Adventure")) {
    return "activity";
  }
  return "attraction";
}

const KIND_META = {
  start: { label: "Starting Point", icon: Flag, badge: "Start", color: COLORS.start },
  dest: { label: "Final Destination", icon: FlagCheckered, badge: "Destination", color: COLORS.dest },
  stay: { label: "Hotel / Stay", icon: Bed, badge: "🏨 Stay", color: COLORS.stay },
  food: { label: "Food & Dining", icon: ForkKnife, badge: "🍽️ Food", color: COLORS.food },
  market: { label: "Market / Shopping", icon: Storefront, badge: "🛍️ Market", color: COLORS.market },
  attraction: { label: "Sight / Attraction", icon: Camera, badge: "🏛️ Sight", color: COLORS.attraction },
  activity: { label: "Activity / Sport", icon: Compass, badge: "🎯 Activity", color: COLORS.activity },
  section: { label: "Trip Leg / Area", icon: MapPin, badge: "📍 Area", color: COLORS.section },
};

export default function FullTripPlan({ shared = false }) {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [stays, setStays] = useState([]);
  const [route, setRoute] = useState([]);
  const [meta, setMeta] = useState({ distance_km: null, duration_minutes: null });
  const [budget, setBudget] = useState(null);
  const [error, setError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [filterKind, setFilterKind] = useState("all");

  const loadAll = useCallback(() => {
    if (shared) {
      api.get(`/trips/public/${slug}/plan`).then((r) => {
        setData({ trip: r.data.trip, sections: r.data.sections, places: r.data.places || [] });
        setStays(r.data.overnight_stays || []);
        setRoute(r.data.route_geometry || []);
        setMeta({ distance_km: r.data.distance_km, duration_minutes: r.data.duration_minutes });
      }).catch(() => setError(true));
      return;
    }
    api.get(`/trips/${id}/full`).then((r) => setData(r.data)).catch(() => setError(true));
    api.get(`/trips/${id}/overnight-stays`).then((r) => setStays(r.data || [])).catch(() => {});
    api.get(`/trips/${id}/route-plan`, { params: { max_drive_hours: 6 } })
      .then((r) => {
        setRoute(r.data?.geometry || []);
        setMeta({ distance_km: r.data?.distance_km, duration_minutes: r.data?.duration_minutes });
      })
      .catch(() => {});
    api.get(`/trips/${id}/final-budget`).then((r) => setBudget(r.data)).catch(() => {});
  }, [id, slug, shared]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const { timeline, mapRoute, stops } = useMemo(() => {
    if (!data) return { timeline: [], mapRoute: [], stops: [] };

    const { trip, sections = [] } = data;
    const effectiveRoute = route.length > 1 ? route : (trip.route_geometry || []);

    let cum = [], totalRoute = 0;
    if (effectiveRoute.length > 1) {
      cum[0] = 0;
      for (let i = 1; i < effectiveRoute.length; i++) {
        totalRoute += haversine(effectiveRoute[i - 1][0], effectiveRoute[i - 1][1], effectiveRoute[i][0], effectiveRoute[i][1]);
        cum[i] = totalRoute;
      }
    }
    const avgSpeed = totalRoute && meta.duration_minutes ? totalRoute / (meta.duration_minutes / 60) : 50;

    const progressFor = (lat, lon) => {
      if (lat == null || lon == null) return { km: 0, min: 0 };
      if (effectiveRoute.length < 2) {
        const km = haversine(trip.start_lat ?? lat, trip.start_lon ?? lon, lat, lon);
        return { km: Math.round(km), min: Math.round((km / avgSpeed) * 60) };
      }
      let best = 0, bestD = Infinity;
      for (let i = 0; i < effectiveRoute.length; i++) {
        const d = haversine(effectiveRoute[i][0], effectiveRoute[i][1], lat, lon);
        if (d < bestD) { bestD = d; best = i; }
      }
      const km = cum[best] || 0;
      return { km: Math.round(km), min: Math.round((km / avgSpeed) * 60) };
    };

    const intermediateItems = [];

    (stays || []).forEach((s) => {
      if (s.lat != null && s.lon != null) {
        intermediateItems.push({
          kind: "stay",
          lat: s.lat,
          lon: s.lon,
          name: s.hotel_name,
          sectionTitle: s.waypoint_name ? `Near ${s.waypoint_name}` : "Overnight Stop",
          sub: `Overnight stay${s.night_date ? ` · ${s.night_date}` : ""}`,
          website: s.website,
          rating: null,
          photo: null,
          cost: s.price_estimate,
          bookingUrl: s.website || `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(s.hotel_name)}`,
          key: `stay-${s.id}`,
        });
      }
    });

    sections.forEach((sec, sIdx) => {
      const placesInSec = sec.places || [];
      
      if (placesInSec.length > 0) {
        placesInSec.forEach((p) => {
          const lat = p.lat ?? p.latitude ?? sec.latitude;
          const lon = p.lon ?? p.longitude ?? sec.longitude;
          if (lat != null && lon != null) {
            const kind = getCategoryKind(p);
            intermediateItems.push({
              kind,
              lat,
              lon,
              name: p.name,
              sectionTitle: sec.title || `Section ${sIdx + 1}`,
              sub: p.description || p.category || "Itinerary stop",
              photo: p.photo_url,
              rating: p.avg_rating ?? p.rating,
              cost: p.cost_estimate,
              tags: p.tags || [],
              bookingUrl: p.booking_url || (kind === "food" 
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + " restaurant")}`
                : `https://www.google.com/search?q=${encodeURIComponent(p.name + " " + (sec.place_name || "") + " booking tickets")}`),
              key: `place-${p.id}`,
            });
          }
        });
      } else if (sec.latitude != null && sec.longitude != null) {
        intermediateItems.push({
          kind: "section",
          lat: sec.latitude,
          lon: sec.longitude,
          name: sec.title,
          sectionTitle: sec.place_name || `Section ${sIdx + 1}`,
          sub: sec.place_name || "Itinerary area",
          photo: null,
          rating: null,
          cost: sec.section_budget,
          bookingUrl: `https://www.google.com/maps/search/?api=1&query=${sec.latitude},${sec.longitude}`,
          key: `sec-${sec.id}`,
        });
      }
    });

    const ordered = intermediateItems
      .map((item) => ({ ...item, progress: progressFor(item.lat, item.lon) }))
      .sort((a, b) => a.progress.km - b.progress.km);

    const fullTimeline = [];
    if (trip.start_lat != null && trip.start_lon != null) {
      fullTimeline.push({
        kind: "start",
        lat: trip.start_lat,
        lon: trip.start_lon,
        name: trip.starting_point,
        sectionTitle: "Origin",
        sub: "Starting departure point",
        km: 0,
        min: 0,
        key: "start",
        bookingUrl: `https://www.google.com/maps/search/?api=1&query=${trip.start_lat},${trip.start_lon}`,
      });
    }

    ordered.forEach((p) => {
      fullTimeline.push({
        ...p,
        km: p.progress.km,
        min: p.progress.min,
      });
    });

    if (trip.dest_lat != null && trip.dest_lon != null) {
      const dp = progressFor(trip.dest_lat, trip.dest_lon);
      fullTimeline.push({
        kind: "dest",
        lat: trip.dest_lat,
        lon: trip.dest_lon,
        name: trip.destination,
        sectionTitle: "Arrival",
        sub: "Final journey destination",
        km: meta.distance_km ?? dp.km,
        min: meta.duration_minutes ?? dp.min,
        key: "dest",
        bookingUrl: `https://www.google.com/maps/search/?api=1&query=${trip.dest_lat},${trip.dest_lon}`,
      });
    }

    const mapStops = fullTimeline.map((t, i) => {
      const metaInfo = KIND_META[t.kind] || KIND_META.section;
      return {
        lat: t.lat,
        lon: t.lon,
        name: t.name,
        label: `${i + 1}`,
        color: metaInfo.color,
        photo: t.photo,
        rating: t.rating,
        subtitle: `${metaInfo.badge} · ${t.sectionTitle} · ${t.km} km from start`,
        link: t.bookingUrl || `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lon}`,
        linkLabel: t.kind === "stay" ? "Book stay" : t.kind === "food" ? "View menu/details" : "View on map",
      };
    });

    return { timeline: fullTimeline, mapRoute: effectiveRoute, stops: mapStops };
  }, [data, stays, route, meta]);

  if (error) return <div className="mx-auto max-w-3xl px-6 py-20 text-center text-destructive">Could not load this trip.</div>;
  if (!data) return <div className="mx-auto max-w-3xl px-6 py-20 text-center text-muted-foreground flex items-center justify-center gap-2"><CircleNotch size={18} className="animate-spin" /> Loading full trip plan…</div>;

  const { trip } = data;
  const currencySym = trip.currency_symbol || "₹";

  const shareTrip = async () => {
    setSharing(true);
    try {
      const res = await api.post(`/trips/${id}/publish`);
      const url = `${window.location.origin}/t/${res.data.public_slug}/plan`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Public map link copied to clipboard!");
    } catch {
      toast.error("Could not create share link.");
    } finally {
      setSharing(false);
    }
  };

  const openFullRoute = () => {
    const pts = timeline.map((t) => [t.lat, t.lon]);
    if (pts.length < 2) {
      toast.error("Not enough points for a driving route link.");
      return;
    }
    const origin = pts[0].join(",");
    const destination = pts[pts.length - 1].join(",");
    const waypoints = pts.slice(1, -1).slice(0, 9).map((p) => p.join(",")).join("|");
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
    window.open(url, "_blank");
  };

  const categoryCounts = timeline.reduce((acc, t) => {
    acc[t.kind] = (acc[t.kind] || 0) + 1;
    return acc;
  }, {});

  const filteredTimeline = timeline.filter((t) => {
    if (filterKind === "all") return true;
    if (filterKind === "places") return t.kind === "attraction" || t.kind === "activity" || t.kind === "section";
    return t.kind === filterKind;
  });

  const filteredStops = stops.filter((s, idx) => {
    const t = timeline[idx];
    if (!t) return true;
    if (filterKind === "all") return true;
    if (filterKind === "places") return t.kind === "attraction" || t.kind === "activity" || t.kind === "section";
    return t.kind === filterKind;
  });

  return (
    <div className="pb-16 print-area" data-testid="full-trip-plan-page">
      {!shared && data?.trip && <TripSubNav trip={{ ...trip, id }} onTripUpdated={loadAll} />}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {shared ? (
              <p className="overline text-primary mb-1 flex items-center gap-1.5">
                <ShareNetwork size={14} weight="bold" /> Shared Adventure Plan
              </p>
            ) : (
              <button
                data-testid="fulltrip-back-btn"
                onClick={() => navigate(`/trips/${id}/view`)}
                className="no-print inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-1"
              >
                <ArrowLeft size={14} weight="bold" /> Back to itinerary
              </button>
            )}
            <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight flex items-center gap-2">
              Your Great Adventure ✨
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {trip.starting_point} ➔ {trip.destination} · <span className="font-semibold text-foreground">{timeline.length} stops</span> (Hotels, Food, Sights & Markets)
              {meta.distance_km ? ` · ${meta.distance_km} km · ${fmtDur(meta.duration_minutes)} total drive` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 no-print items-center">
            {!shared && (
              <button
                data-testid="fulltrip-share-btn"
                onClick={shareTrip}
                disabled={sharing}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {sharing ? <CircleNotch size={14} className="animate-spin" /> : <ShareNetwork size={14} weight="bold" />}
                Share map
              </button>
            )}
            {!shared && (
              <button
                onClick={() => navigate(`/trips/${id}/brochure`)}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 px-3.5 py-1.5 text-xs font-semibold transition-colors"
              >
                <Printer size={14} weight="bold" /> PDF Brochure
              </button>
            )}
            <button
              data-testid="fulltrip-print-btn"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card hover:bg-accent px-3.5 py-1.5 text-xs font-semibold transition-colors"
            >
              <Printer size={14} weight="bold" /> Print
            </button>
            <button
              data-testid="fulltrip-google-maps-btn"
              onClick={openFullRoute}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground hover:opacity-90 transition-opacity"
            >
              <MapTrifold size={14} weight="bold" /> Google Maps
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border/60 py-3">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-xs font-bold text-muted-foreground uppercase mr-1">Filter view:</span>
            {[
              { id: "all", label: `All Stops (${timeline.length})`, color: null },
              { id: "stay", label: `🏨 Hotels (${categoryCounts.stay || 0})`, color: COLORS.stay },
              { id: "food", label: `🍽️ Food & Cafes (${categoryCounts.food || 0})`, color: COLORS.food },
              { id: "market", label: `🛍️ Markets (${categoryCounts.market || 0})`, color: COLORS.market },
              { id: "places", label: `🏛️ Sights & Spots (${(categoryCounts.attraction || 0) + (categoryCounts.activity || 0) + (categoryCounts.section || 0)})`, color: COLORS.attraction },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterKind(f.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  filterKind === f.id
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.start }} /> Start</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.stay }} /> Hotel</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.food }} /> Food</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.market }} /> Market</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.attraction }} /> Sight</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.dest }} /> Dest</span>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-3 sm:p-5 shadow-xs" data-testid="fulltrip-map-panel">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <MapTrifold size={16} className="text-primary" weight="bold" />
              Complete Journey Map & Route
            </h2>
            <span className="text-xs text-muted-foreground">
              Showing {filteredStops.length} marked locations along route
            </span>
          </div>
          <TripMap stops={filteredStops} route={mapRoute} height={500} />
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4" data-testid="fulltrip-roadmap-list">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
            <div>
              <h2 className="overline text-primary flex items-center gap-1.5 mb-1">
                <Path size={15} weight="bold" /> Journey Sequence
              </h2>
              <p className="font-display font-bold text-lg text-foreground">
                Follow your journey step by step — {timeline.length} destinations in geographic order
              </p>
            </div>
            <span className="text-xs bg-accent px-3 py-1 rounded-full font-semibold">
              {filteredTimeline.length} of {timeline.length} items shown
            </span>
          </div>

          <div className="space-y-3">
            {filteredTimeline.map((t, idx) => {
              const metaInfo = KIND_META[t.kind] || KIND_META.section;
              const Icon = metaInfo.icon;
              const originalIndex = timeline.findIndex((item) => item.key === t.key);

              return (
                <div
                  key={t.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5 hover:border-primary/40 hover:bg-muted/10 transition-all shadow-2xs"
                  data-testid={`fulltrip-stop-${idx}`}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
                      style={{ background: metaInfo.color }}
                    >
                      {originalIndex + 1}
                    </span>

                    {t.photo ? (
                      <img
                        src={t.photo}
                        alt={t.name}
                        className="h-12 w-12 rounded-xl object-cover shrink-0 border border-border/80"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/80"
                        style={{ backgroundColor: `${metaInfo.color}18`, color: metaInfo.color }}
                      >
                        <Icon size={22} weight="duotone" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: `${metaInfo.color}15`, color: metaInfo.color }}
                        >
                          {metaInfo.badge}
                        </span>
                        <p className="font-bold text-sm text-foreground truncate">{t.name}</p>
                        {t.rating != null && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                            <Star size={11} weight="fill" /> {t.rating}
                          </span>
                        )}
                        {t.cost > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                            {currencySym}{Number(t.cost).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        <span className="font-medium text-foreground/80">{t.sectionTitle}</span> · {t.sub}
                      </p>

                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {t.bookingUrl && (
                          <a
                            href={t.bookingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            {t.kind === "stay" ? "🔗 Book Stay" : t.kind === "food" ? "🍴 View Menu" : "🎟️ Book / Info"}
                            <ArrowSquareOut size={11} weight="bold" />
                          </a>
                        )}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lon}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground"
                        >
                          <MapPin size={12} weight="bold" /> View on Map
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-border/60 shrink-0 text-right">
                    <div className="flex items-center sm:justify-end gap-1 font-bold text-xs">
                      <span>{t.km} km</span>
                      <span className="text-muted-foreground font-normal">from start</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                      <Clock size={11} weight="bold" /> {fmtDur(t.min)} drive
                    </p>
                    {originalIndex > 0 && (
                      <span className="text-[10px] text-primary/80 font-semibold bg-primary/10 px-1.5 py-0.5 rounded-sm mt-1 inline-block">
                        +{Math.max(0, t.km - timeline[originalIndex - 1].km)} km from prev
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {budget?.numbers && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xs" data-testid="fulltrip-budget-panel">
            <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
              <h2 className="overline text-primary flex items-center gap-1.5">
                <Wallet size={16} weight="bold" /> Final Trip Budget Summary
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">
                All itinerary items, stays & fuel computed live
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div className="rounded-2xl border border-border bg-accent/40 p-4">
                <p className="text-xs text-muted-foreground font-semibold mb-1">Itinerary Spend</p>
                <p className="font-display font-black text-xl sm:text-2xl tracking-tight">
                  {currencySym}{Number(budget.numbers.itinerary_costs?.total_estimated || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/40 p-4">
                <p className="text-xs text-muted-foreground font-semibold mb-1">Overnight Stays</p>
                <p className="font-display font-black text-xl sm:text-2xl tracking-tight">
                  {currencySym}{Number(budget.numbers.overnight_stays?.total_cost || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/40 p-4">
                <p className="text-xs text-muted-foreground font-semibold mb-1">Drive & Fuel Cost (est.)</p>
                <p className="font-display font-black text-xl sm:text-2xl tracking-tight">
                  {currencySym}{Number(budget.numbers.drive_costs?.total || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                <p className="text-xs text-primary font-bold mb-1">Grand Total</p>
                <p className="font-display font-black text-xl sm:text-2xl tracking-tight text-primary">
                  {currencySym}{Number(budget.numbers.grand_total || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs mb-4">
              <span className="font-semibold bg-accent px-3 py-1.5 rounded-full">
                {currencySym}{Number(budget.numbers.per_day || 0).toLocaleString()} / day ({budget.numbers.days || 1} days)
              </span>
              {budget.numbers.trip_budget > 0 && (
                <span
                  className={`font-semibold px-3 py-1.5 rounded-full ${
                    budget.numbers.over_budget > 0
                      ? "bg-destructive/10 text-destructive border border-destructive/30"
                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                  }`}
                >
                  Budget: {currencySym}{Number(budget.numbers.trip_budget).toLocaleString()}
                  {budget.numbers.over_budget > 0
                    ? ` (+${currencySym}${Number(budget.numbers.over_budget).toLocaleString()} over)`
                    : " (Within planned budget ✨)"}
                </span>
              )}
            </div>

            {budget.narrative && (
              <div className="rounded-2xl bg-muted/50 p-4 border border-border/80 text-xs sm:text-sm text-foreground/90 leading-relaxed">
                <p className="font-semibold mb-1 flex items-center gap-1.5 text-primary">
                  <Sparkle size={14} weight="fill" /> AI Budget & Journey Insights:
                </p>
                <p className="whitespace-pre-line text-muted-foreground">{budget.narrative}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
