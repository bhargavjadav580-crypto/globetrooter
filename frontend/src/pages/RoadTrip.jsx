import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "@/lib/api";
import { toast } from "sonner";
import TripMap from "@/components/TripMap";
import CollaboratorsModal from "@/components/CollaboratorsModal";
import TripSubNav from "@/components/TripSubNav";
import {
  ArrowLeft, Bed, Car, Bus, Train, AirplaneTilt, GasPump, MapTrifold,
  Sparkle, Trash, ArrowSquareOut, MoonStars, Path, CircleNotch,
  DownloadSimple, CalendarBlank, FileX, CloudSun, Receipt, FilePdf, UsersThree,
} from "@phosphor-icons/react";

const MODE_ICON = { drive: Car, bus: Bus, train: Train, flight: AirplaneTilt };

function fmtDur(min) {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function RoadTrip() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [plan, setPlan] = useState(null);
  const [maxHours, setMaxHours] = useState(6);
  const [planLoading, setPlanLoading] = useState(true);
  const [stays, setStays] = useState([]);
  const [hotelsFor, setHotelsFor] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [fuel, setFuel] = useState({ vehicle_type: "car", mileage_kmpl: "", fuel_price_per_liter: "", travelers: 1 });
  const [transport, setTransport] = useState(null);
  const [budget, setBudget] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  // New feature state
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [isCollabOpen, setIsCollabOpen] = useState(false);

  const loadPlan = useCallback(async (hours) => {
    setPlanLoading(true);
    try {
      const r = await api.get(`/trips/${id}/route-plan`, { params: { max_drive_hours: hours } });
      setPlan(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not compute route plan.");
    } finally {
      setPlanLoading(false);
    }
  }, [id]);

  const loadTransport = useCallback(async () => {
    try { setTransport((await api.get(`/trips/${id}/transport-options`)).data); }
    catch { toast.info("Transport cost estimates unavailable for this trip."); }
  }, [id]);

  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const r = await api.get(`/trips/${id}/weather`);
      setWeather(r.data);
      setShowWeather(true);
    } catch {
      toast.error("Could not fetch weather forecast.");
    } finally {
      setWeatherLoading(false);
    }
  }, [id]);

  const downloadFile = (url, filename) => {
    const a = document.createElement("a");
    // Build authenticated URL by appending token from cookie fallback via fetch
    fetch(url, { credentials: "include" })
      .then((r) => r.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(`${filename} downloaded!`);
      })
      .catch(() => toast.error("Download failed."));
  };

  const exportICS = () => downloadFile(`${API}/trips/${id}/export/ics`, `${trip?.name || "trip"}.ics`);
  const exportGPX = () => downloadFile(`${API}/trips/${id}/export/gpx`, `${trip?.name || "trip"}.gpx`);

  const loadAll = useCallback(async () => {
    api.get(`/trips/${id}`).then((r) => setTrip(r.data)).catch(() => toast.error("Could not load trip."));
    api.get(`/trips/${id}/overnight-stays`).then((r) => setStays(r.data)).catch(() => {});
    api.get(`/trips/${id}/fuel-profile`).then((r) => {
      if (r.data?.mileage_kmpl) setFuel({ vehicle_type: r.data.vehicle_type, mileage_kmpl: r.data.mileage_kmpl, fuel_price_per_liter: r.data.fuel_price_per_liter, travelers: r.data.travelers || 1 });
    }).catch(() => {});
    api.get(`/trips/${id}/final-budget`).then((r) => setBudget(r.data)).catch(() => {});
    loadPlan(maxHours);
    loadTransport();
  }, [id, maxHours, loadPlan, loadTransport]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openHotels = async (wp) => {
    setHotelsFor(wp);
    setHotels([]);
    setHotelsLoading(true);
    try {
      const r = await api.get(`/trips/${id}/hotels`, { params: { lat: wp.lat, lon: wp.lon } });
      setHotels(r.data);
      if (r.data.length === 0) toast.info("No hotels found near this stop on OpenStreetMap.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Live hotel search failed.");
    } finally {
      setHotelsLoading(false);
    }
  };

  const saveStay = async (hotel) => {
    try {
      const r = await api.post(`/trips/${id}/overnight-stays`, {
        waypoint_index: hotelsFor.index, waypoint_name: hotelsFor.name,
        night_date: hotelsFor.suggested_night_date, hotel_name: hotel.name,
        external_place_id: hotel.external_place_id, lat: hotel.lat, lon: hotel.lon,
        website: hotel.website, price_estimate: 0,
      });
      setStays((prev) => [...prev.filter((s) => s.waypoint_index !== hotelsFor.index), r.data].sort((a, b) => a.waypoint_index - b.waypoint_index));
      setHotelsFor(null);
      toast.success(`${hotel.name} saved for night ${hotelsFor.day}.`);
      api.get(`/trips/${id}/final-budget`).then((res) => setBudget(res.data)).catch(() => {});
    } catch { toast.error("Could not save stay."); }
  };

  const updateStayPrice = async (stay, price) => {
    try {
      const r = await api.put(`/overnight-stays/${stay.id}`, { price_estimate: Number(price) || 0 });
      setStays((prev) => prev.map((s) => (s.id === stay.id ? r.data : s)));
      api.get(`/trips/${id}/final-budget`).then((res) => setBudget(res.data)).catch(() => {});
    } catch { toast.error("Could not update price."); }
  };

  const deleteStay = async (stay) => {
    try {
      await api.delete(`/overnight-stays/${stay.id}`);
      setStays((prev) => prev.filter((s) => s.id !== stay.id));
      api.get(`/trips/${id}/final-budget`).then((res) => setBudget(res.data)).catch(() => {});
    } catch { toast.error("Could not remove stay."); }
  };

  const saveFuel = async () => {
    if (!fuel.mileage_kmpl || !fuel.fuel_price_per_liter) { toast.error("Enter mileage and fuel price."); return; }
    try {
      await api.post(`/trips/${id}/fuel-profile`, {
        vehicle_type: fuel.vehicle_type,
        mileage_kmpl: Number(fuel.mileage_kmpl),
        fuel_price_per_liter: Number(fuel.fuel_price_per_liter),
        travelers: Math.max(1, Number(fuel.travelers) || 1),
      });
      toast.success("Fuel profile saved.");
      loadTransport();
      api.get(`/trips/${id}/final-budget`).then((res) => setBudget(res.data)).catch(() => {});
    } catch (e) { toast.error(e.response?.data?.detail || "Could not save fuel profile."); }
  };

  const generateAI = async () => {
    setAiLoading(true);
    try {
      const r = await api.post(`/trips/${id}/final-budget`);
      setBudget(r.data);
      toast.success("AI budget summary generated.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "AI summary failed.");
    } finally { setAiLoading(false); }
  };

  const openFullRoute = async () => {
    try {
      const r = await api.get(`/trips/${id}/final-map-link`);
      window.open(r.data.url, "_blank");
    } catch { toast.error("Could not build map link."); }
  };

  if (!trip) return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-6" data-testid="roadtrip-skeleton">
      <div className="h-10 w-64 rounded-2xl bg-muted animate-pulse" />
      <div className="h-4 w-40 rounded-xl bg-muted animate-pulse" />
      <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
        <div className="h-6 w-40 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-64 rounded-2xl bg-muted animate-pulse" />
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-3xl border border-border bg-card p-6 h-64 animate-pulse bg-muted" />
        <div className="rounded-3xl border border-border bg-card p-6 h-64 animate-pulse bg-muted lg:col-span-2" />
      </div>
    </div>
  );
  if (trip.start_lat == null || trip.dest_lat == null) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-muted-foreground mb-4">This trip needs a starting point and destination with map coordinates.</p>
        <button data-testid="roadtrip-edit-trip-btn" onClick={() => navigate(`/trips/${id}/build`)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Edit trip</button>
      </div>
    );
  }

  const mapStops = [];
  mapStops.push({ lat: trip.start_lat, lon: trip.start_lon, name: trip.starting_point, label: "A", color: "hsl(152,34%,32%)", subtitle: "Start" });
  (plan?.waypoints || []).forEach((w) => {
    const stay = stays.find((s) => s.waypoint_index === w.index);
    mapStops.push({ lat: stay?.lat ?? w.lat, lon: stay?.lon ?? w.lon, name: stay ? stay.hotel_name : `Night ${w.day}: ${w.name}`, label: `N${w.day}`, color: "hsl(38,68%,50%)", subtitle: stay ? `Overnight stay · ${w.name}` : "Suggested overnight stop" });
  });
  mapStops.push({ lat: trip.dest_lat, lon: trip.dest_lon, name: trip.destination, label: "B", color: "hsl(14,72%,53%)", subtitle: "Destination" });

  const num = budget?.numbers;
  const sym = trip?.currency_symbol || "₹";

  return (
    <div className="pb-16" data-testid="roadtrip-page">
      {/* Persistent Trip Navigation Tab Bar */}
      <TripSubNav trip={trip} onTripUpdated={loadAll} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">Road Trip & Overnight Stays</h1>
            <p className="text-xs text-muted-foreground">{trip.starting_point} ➔ {trip.destination}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Google Maps */}
            <button data-testid="open-google-maps-btn" onClick={openFullRoute} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground hover:opacity-90 transition-opacity">
              <MapTrifold size={15} weight="bold" /> Google Maps
            </button>
            {/* Weather */}
            <button onClick={showWeather ? () => setShowWeather(false) : loadWeather}
              disabled={weatherLoading}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-3.5 py-1.5 text-xs font-semibold hover:bg-sky-200 dark:hover:bg-sky-900 disabled:opacity-60 transition-colors">
              {weatherLoading ? <CircleNotch size={14} className="animate-spin" /> : <CloudSun size={14} weight="bold" />}
              🌤 Weather
            </button>
            {/* Export Dropdown */}
            <div className="relative group">
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-semibold hover:bg-accent transition-colors"
              >
                <DownloadSimple size={14} weight="bold" /> Export ▾
              </button>
              <div className="absolute right-0 mt-1 w-48 rounded-2xl border border-border bg-card shadow-xl p-1.5 z-50 hidden group-hover:block">
                <button onClick={exportICS}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-accent transition-colors text-left">
                  <CalendarBlank size={15} weight="bold" className="text-purple-600" />
                  <div>
                    <p className="font-bold">Calendar (.ics)</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Import into Google Calendar</p>
                  </div>
                </button>
                <button onClick={exportGPX}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-accent transition-colors text-left">
                  <DownloadSimple size={15} weight="bold" className="text-orange-600" />
                  <div>
                    <p className="font-bold">GPS Track (.gpx)</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Import into maps / GPS devices</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* Weather Panel */}
      {showWeather && weather && (
        <div className="rounded-3xl border border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-950/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-2">
              <CloudSun size={18} weight="bold" /> 7-Day Weather Forecast per Stop
            </h2>
            <button onClick={() => setShowWeather(false)} className="text-sky-600 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-200 text-sm font-medium">Hide</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {weather.map((stop, si) => (
              <div key={si} className="rounded-2xl bg-card border border-sky-100 dark:border-sky-800 p-4">
                <h3 className="font-semibold text-sm mb-3">{stop.stop_name}</h3>
                {stop.error ? (
                  <p className="text-xs text-muted-foreground">{stop.error}</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {stop.forecast.slice(0, 7).map((day, di) => (
                      <div key={di} className="flex flex-col items-center min-w-[58px] bg-sky-50 dark:bg-sky-900/40 rounded-xl p-2 text-center">
                        <span className="text-xs text-muted-foreground">{new Date(day.date).toLocaleDateString("en-IN", { weekday: "short" })}</span>
                        <span className="text-xl my-0.5">{day.emoji}</span>
                        <span className="text-xs font-bold text-sky-700 dark:text-sky-300">{day.temp_max}°</span>
                        <span className="text-xs text-muted-foreground">{day.temp_min}°</span>
                        {day.precipitation_mm > 0 && (
                          <span className="text-xs text-blue-500 mt-0.5">{day.precipitation_mm}mm</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route plan */}
      <div className="rounded-3xl border border-border bg-card p-6" data-testid="route-plan-panel">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="overline text-primary flex items-center gap-2"><Path size={16} weight="bold" /> Multi-day drive plan</h2>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-muted-foreground">Max driving / day</label>
            <input data-testid="max-drive-hours-slider" type="range" min={3} max={12} step={1} value={maxHours}
              onChange={(e) => setMaxHours(Number(e.target.value))}
              onMouseUp={() => loadPlan(maxHours)} onTouchEnd={() => loadPlan(maxHours)} className="accent-[hsl(14,72%,53%)]" />
            <span className="text-sm font-bold w-8" data-testid="max-drive-hours-value">{maxHours}h</span>
          </div>
        </div>
        {plan ? (
          <div className="relative">
            {planLoading && (
              <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-xs rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold text-primary">
                <CircleNotch size={20} className="animate-spin" /> Updating route…
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[["Total distance", `${plan.distance_km} km`], ["Driving time", fmtDur(plan.duration_minutes)],
                ["Driving days", plan.driving_days], ["Overnight stops", plan.overnight_stops_needed]].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-muted p-4">
                  <p className="text-xs text-muted-foreground font-semibold">{k}</p>
                  <p className="font-display font-black text-2xl tracking-tighter" data-testid={`plan-stat-${String(k).toLowerCase().replace(/ /g, "-")}`}>{v}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 mb-5">
              {plan.legs.map((l) => (
                <div key={l.day} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm" data-testid={`route-leg-${l.day}`}>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground whitespace-nowrap">Day {l.day}</span>
                  <span className="flex-1 font-semibold line-clamp-1">{l.from} → {l.to}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{l.distance_km} km · {fmtDur(l.drive_minutes)}</span>
                </div>
              ))}
            </div>
            <TripMap stops={mapStops} route={plan.geometry || trip.route_geometry || []} height={380} />
          </div>
        ) : planLoading ? (
          <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2"><CircleNotch size={18} className="animate-spin" /> Computing live route…</div>
        ) : <p className="text-sm text-destructive">Route plan unavailable.</p>}
      </div>

      {/* Overnight stops + hotels */}
      {plan && plan.waypoints.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-6" data-testid="overnight-panel">
          <h2 className="overline text-primary flex items-center gap-2 mb-4"><MoonStars size={16} weight="bold" /> Overnight stops & hotels</h2>
          <div className="space-y-4">
            {plan.waypoints.map((w) => {
              const stay = stays.find((s) => s.waypoint_index === w.index);
              return (
                <div key={w.index} className="rounded-2xl border border-border p-4" data-testid={`waypoint-${w.index}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display font-bold tracking-tight">Night {w.day} · {w.name}</p>
                      <p className="text-xs text-muted-foreground">{w.suggested_night_date ? `Suggested: ${new Date(w.suggested_night_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ` : ""}Overnight stop near <strong>{w.name}</strong> · {plan?.legs?.find(l => l.day === w.day)?.distance_km ? `${plan.legs.find(l => l.day === w.day).distance_km} km from previous stop` : "along your route"}</p>
                    </div>
                    <button data-testid={`find-hotels-btn-${w.index}`} onClick={() => (hotelsFor?.index === w.index ? setHotelsFor(null) : openHotels(w))}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                      <Bed size={15} weight="bold" /> {hotelsFor?.index === w.index ? "Hide hotels" : "Find live hotels"}
                    </button>
                  </div>
                  {stay && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-accent p-3" data-testid={`saved-stay-${w.index}`}>
                      <Bed size={18} weight="bold" className="text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-1">{stay.hotel_name}</p>
                        {stay.website && <a href={stay.website} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">Website <ArrowSquareOut size={11} /></a>}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground text-xs">{sym}/night</span>
                        <input data-testid={`stay-price-input-${w.index}`} type="number" min={0} defaultValue={stay.price_estimate || 0}
                          onBlur={(e) => updateStayPrice(stay, e.target.value)}
                          className="w-24 rounded-lg border border-border bg-card px-2 py-1 text-sm font-semibold" />
                      </div>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${stay.lat},${stay.lon}`} target="_blank" rel="noreferrer" className="text-primary hover:opacity-70 inline-flex items-center gap-1 text-xs font-semibold"><MapTrifold size={15} weight="bold" /> Map</a>
                      <button data-testid={`delete-stay-btn-${w.index}`} onClick={() => deleteStay(stay)} className="text-destructive hover:opacity-70"><Trash size={17} weight="bold" /></button>
                    </div>
                  )}
                  {hotelsFor?.index === w.index && (
                    <div className="mt-3" data-testid={`hotel-results-${w.index}`}>
                      {hotelsLoading ? (
                        <div className="py-5 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><CircleNotch size={16} className="animate-spin" /> Searching live hotels within 20 km…</div>
                      ) : hotels.length === 0 ? (
                        <p className="py-3 text-sm text-muted-foreground">No hotels found on OpenStreetMap near this stop. Try a different max-drive setting.</p>
                      ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {hotels.slice(0, 12).map((h) => (
                            <div key={h.external_place_id} className="rounded-xl border border-border overflow-hidden bg-background flex flex-col">
                              <img src={h.photo_url} alt={h.name} className="h-24 w-full object-cover" />
                              <div className="p-3 flex flex-col flex-1">
                                <p className="text-sm font-semibold line-clamp-1">{h.name}</p>
                                <p className="text-xs text-muted-foreground">{h.distance_km} km from stop{h.rating ? ` · ⭐ ${h.rating}` : ""}</p>
                                <div className="mt-auto pt-3 flex gap-1.5">
                                  <button data-testid={`select-hotel-btn-${h.external_place_id}`} onClick={() => saveStay(h)}
                                    className="flex-1 rounded-full bg-secondary px-1 py-1.5 text-[10px] font-semibold text-secondary-foreground hover:opacity-90 transition-opacity whitespace-nowrap">Stay here</button>
                                  <a href={h.website || `https://www.google.com/search?q=${encodeURIComponent(h.name + ' hotel booking')}`} target="_blank" rel="noreferrer"
                                    className="flex-1 text-center rounded-full bg-primary/10 text-primary px-1 py-1.5 text-[10px] font-semibold hover:bg-primary/20 transition-colors whitespace-nowrap">🔗 Book Now</a>
                                  <a href={`https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lon}`} target="_blank" rel="noreferrer"
                                    className="flex-1 text-center rounded-full bg-accent text-accent-foreground px-1 py-1.5 text-[10px] font-semibold hover:bg-accent/80 transition-colors whitespace-nowrap">📍 View on Map</a>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fuel + transport comparison */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-3xl border border-border bg-card p-6" data-testid="fuel-profile-panel">
          <h2 className="overline text-primary flex items-center gap-2 mb-4"><GasPump size={16} weight="bold" /> Travel profile</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Travelers</label>
              <input data-testid="travelers-input" type="number" min={1} max={20} value={fuel.travelers}
                onChange={(e) => setFuel({ ...fuel, travelers: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Vehicle</label>
              <select data-testid="fuel-vehicle-select" value={fuel.vehicle_type} onChange={(e) => setFuel({ ...fuel, vehicle_type: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <option value="car">Car</option><option value="suv">SUV</option><option value="bike">Bike</option><option value="ev">EV (kWh basis)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Mileage (km per litre)</label>
              <input data-testid="fuel-mileage-input" type="number" min={1} value={fuel.mileage_kmpl} placeholder="e.g. 15"
                onChange={(e) => setFuel({ ...fuel, mileage_kmpl: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Fuel price ({sym} per litre)</label>
              <input data-testid="fuel-price-input" type="number" min={1} value={fuel.fuel_price_per_liter} placeholder="e.g. 105"
                onChange={(e) => setFuel({ ...fuel, fuel_price_per_liter: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <button data-testid="save-fuel-btn" onClick={saveFuel}
              className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">Save & recalculate</button>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2" data-testid="transport-panel">
          <h2 className="overline text-primary mb-4">Getting there — compare modes{transport?.travelers > 1 ? ` (${transport.travelers} travelers)` : ""}</h2>
          {!transport ? <p className="text-sm text-muted-foreground">Loading transport options…</p> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {transport.options.map((o) => {
                const Icon = MODE_ICON[o.mode] || Car;
                return (
                  <div key={o.mode} className="rounded-2xl border border-border p-4" data-testid={`transport-option-${o.mode}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="rounded-xl bg-accent p-2 text-accent-foreground"><Icon size={18} weight="bold" /></div>
                      <p className="font-semibold text-sm">{o.label}</p>
                    </div>
                    <p className="font-display font-black text-2xl tracking-tighter">{sym}{Number(o.cost_estimate).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{fmtDur(o.duration_minutes)}{o.mode === "drive" && o.cost_detail?.fuel_liters ? ` · ${o.cost_detail.fuel_liters} L fuel + ${sym}${o.cost_detail.toll_estimate} tolls (est.)` : ""}{o.cost_detail?.per_person && o.cost_detail?.travelers > 1 ? ` · ${sym}${Number(o.cost_detail.per_person).toLocaleString()} × ${o.cost_detail.travelers}` : ""}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{o.note}</p>
                    <a data-testid={`transport-link-${o.mode}`} href={o.deep_link} target="_blank" rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                      {o.mode === "drive" ? "Open route" : "Check live prices"} <ArrowSquareOut size={12} weight="bold" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Final AI budget */}
      <div className="rounded-3xl border border-border bg-card p-6" data-testid="final-budget-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="overline text-primary flex items-center gap-2"><Sparkle size={16} weight="fill" /> Final trip budget</h2>
          <button data-testid="generate-ai-budget-btn" onClick={generateAI} disabled={aiLoading}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
            {aiLoading ? <><CircleNotch size={15} className="animate-spin" /> Generating…</> : <><Sparkle size={15} weight="fill" /> ✨ Smart Budget Analysis</>}
          </button>
        </div>
        {num && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[["Itinerary spend", num.itinerary_costs.total_estimated],
              ["Overnight stays", num.overnight_stays.total_cost],
              ["Drive cost (est.)", num.drive_costs?.total || 0],
              ["Grand total", num.grand_total]].map(([k, v], i) => (
              <div key={k} className={`rounded-2xl p-4 ${i === 3 ? "bg-secondary text-secondary-foreground" : "bg-muted"}`}>
                <p className={`text-xs font-semibold ${i === 3 ? "text-secondary-foreground/70" : "text-muted-foreground"}`}>{k}</p>
                <p className="font-display font-black text-2xl tracking-tighter" data-testid={`budget-stat-${i}`}>{sym}{Number(v).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
        {num && (
          <p className="text-xs text-muted-foreground mb-4" data-testid="budget-perday">
            {sym}{Number(num.per_day).toLocaleString()} / day over {num.days} day(s)
            {num.trip_budget > 0 && <> · trip budget {sym}{Number(num.trip_budget).toLocaleString()}{num.over_budget ? " — ⚠️ over budget!" : " — ✅ within budget"}</>}
          </p>
        )}
        {budget?.narrative ? (
          <div className="rounded-2xl bg-accent p-5 whitespace-pre-line text-sm leading-relaxed" data-testid="ai-narrative">
            {budget.narrative}
            {budget.generated_at && <p className="mt-3 text-[11px] text-muted-foreground">AI summary generated {budget.generated_at.slice(0, 16).replace("T", " ")} UTC — numbers above are computed live.</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Click <strong>✨ Smart Budget Analysis</strong> to get an AI breakdown of your exact computed costs — never invents prices.</p>
        )}
      </div>

      {/* Collaborators Modal */}
      <CollaboratorsModal
        tripId={id}
        isOpen={isCollabOpen}
        onClose={() => setIsCollabOpen(false)}
      />
      </div>
    </div>
  );
}
