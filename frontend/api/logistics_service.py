"""Road-trip logistics: waypoint planning along the live OSRM route, transport
cost estimation (deterministic heuristics + live fuel profile), booking deep
links, and AI final-budget narrative. No real-world prices are fabricated as
facts — heuristics are labelled as estimates."""
import math
import os
import json
from urllib.parse import quote
from datetime import date, timedelta

import httpx

import osm_service as osm

RATES = {
    "bus": {"per_km": 1.8, "speed_kmh": 45, "overhead_min": 45},
    "train": {"per_km": 1.25, "speed_kmh": 55, "overhead_min": 60},
    "flight": {"base": 2500.0, "per_km": 4.2, "speed_kmh": 750, "overhead_min": 180, "min_km": 400},
}


async def reverse_geocode(lat, lon):
    params = {"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10}
    try:
        async with httpx.AsyncClient(timeout=15, headers=osm.HEADERS) as c:
            r = await c.get(f"{osm.NOMINATIM}/reverse", params=params)
            r.raise_for_status()
            d = r.json()
        addr = d.get("address", {})
        name = (addr.get("city") or addr.get("town") or addr.get("village") or
                addr.get("county") or addr.get("state_district") or addr.get("state"))
        return {"name": name or d.get("display_name", "").split(",")[0],
                "display_name": d.get("display_name")}
    except Exception:
        return {"name": f"{round(lat, 3)}, {round(lon, 3)}", "display_name": None}


def _point_at_fraction(geometry, fraction):
    if not geometry or len(geometry) < 2:
        return None
    seglens = []
    total = 0.0
    for i in range(len(geometry) - 1):
        d = osm._haversine_km(geometry[i][0], geometry[i][1], geometry[i + 1][0], geometry[i + 1][1])
        seglens.append(d)
        total += d
    target = total * fraction
    run = 0.0
    for i, d in enumerate(seglens):
        if run + d >= target:
            t = (target - run) / d if d else 0
            lat = geometry[i][0] + (geometry[i + 1][0] - geometry[i][0]) * t
            lon = geometry[i][1] + (geometry[i + 1][1] - geometry[i][1]) * t
            return [lat, lon]
        run += d
    return geometry[-1]


async def route_plan(trip, max_drive_hours=6.0):
    geometry = trip.get("route_geometry")
    dist = trip.get("distance_km")
    dur = trip.get("travel_time_minutes")
    if not geometry or dist is None or dur is None:
        rt = await osm.route(trip["start_lat"], trip["start_lon"], trip["dest_lat"], trip["dest_lon"])
        geometry, dist, dur = rt["geometry"], rt["distance_km"], rt["duration_minutes"]
    hours = (dur or 0) / 60.0
    days = max(1, math.ceil(hours / max_drive_hours))
    waypoints = []
    for i in range(1, days):
        pt = _point_at_fraction(geometry, i / days)
        geo = await reverse_geocode(pt[0], pt[1])
        night = None
        if trip.get("start_date"):
            try:
                night = (date.fromisoformat(trip["start_date"]) + timedelta(days=i - 1)).isoformat()
            except Exception:
                pass
        waypoints.append({"index": i - 1, "lat": round(pt[0], 5), "lon": round(pt[1], 5),
                          "name": geo["name"], "display_name": geo["display_name"],
                          "day": i, "suggested_night_date": night})
    names = [trip.get("starting_point") or "Start"] + [w["name"] for w in waypoints] + [trip.get("destination") or "Destination"]
    legs = [{"day": i + 1, "from": names[i], "to": names[i + 1],
             "distance_km": round(dist / days, 1), "drive_minutes": round((dur or 0) / days)}
            for i in range(days)]
    return {"distance_km": dist, "duration_minutes": dur, "driving_hours": round(hours, 1),
            "max_drive_hours": max_drive_hours, "driving_days": days,
            "overnight_stops_needed": days - 1, "waypoints": waypoints, "legs": legs,
            "geometry": geometry}


def transport_options(trip, fuel_profile=None):
    dist = float(trip.get("distance_km") or 0)
    dur = float(trip.get("travel_time_minutes") or 0)
    origin = trip.get("starting_point") or ""
    dest = trip.get("destination") or ""
    o = f"{trip.get('start_lat')},{trip.get('start_lon')}"
    d = f"{trip.get('dest_lat')},{trip.get('dest_lon')}"
    fp = fuel_profile or {}
    travelers = max(1, int(fp.get("travelers") or 1))
    mileage = float(fp.get("mileage_kmpl") or 15)
    fuel_price = float(fp.get("fuel_price_per_liter") or 105)
    liters = dist / mileage if mileage else 0
    fuel_cost = round(liters * fuel_price)
    toll = round(dist * 1.2) if dist > 100 else 0
    options = [{
        "mode": "drive", "label": "Drive (own vehicle)",
        "duration_minutes": round(dur), "cost_estimate": fuel_cost + toll,
        "cost_detail": {"fuel_liters": round(liters, 1), "fuel_cost": fuel_cost,
                        "toll_estimate": toll, "mileage_kmpl": mileage,
                        "fuel_price_per_liter": fuel_price},
        "deep_link": f"https://www.google.com/maps/dir/?api=1&origin={o}&destination={d}&travelmode=driving",
        "note": "Fuel from your vehicle profile; tolls are rough highway estimates.",
    }]
    for mode in ("bus", "train"):
        r = RATES[mode]
        per_person = round(dist * r["per_km"])
        options.append({
            "mode": mode, "label": mode.title(),
            "duration_minutes": round(dist / r["speed_kmh"] * 60 + r["overhead_min"]) if dist else 0,
            "cost_estimate": per_person * travelers,
            "cost_detail": {"per_km_rate": r["per_km"], "per_person": per_person, "travelers": travelers},
            "deep_link": f"https://www.rome2rio.com/map/{quote(origin)}/{quote(dest)}",
            "note": f"Heuristic fare × {travelers} traveler(s) — check live prices via the booking link.",
        })
    if dist >= RATES["flight"]["min_km"]:
        r = RATES["flight"]
        per_person = round(r["base"] + dist * r["per_km"])
        options.append({
            "mode": "flight", "label": "Flight",
            "duration_minutes": round(dist / r["speed_kmh"] * 60 + r["overhead_min"]),
            "cost_estimate": per_person * travelers,
            "cost_detail": {"base_fare": r["base"], "per_km_rate": r["per_km"],
                            "per_person": per_person, "travelers": travelers},
            "deep_link": f"https://www.google.com/travel/flights?q={quote(f'Flights from {origin} to {dest}')}",
            "note": f"Heuristic fare × {travelers} traveler(s) — check live prices via the booking link.",
        })
    return {"distance_km": dist, "origin": origin, "destination": dest,
            "travelers": travelers, "options": options}


def final_map_link(trip, stays):
    o = f"{trip.get('start_lat')},{trip.get('start_lon')}"
    d = f"{trip.get('dest_lat')},{trip.get('dest_lon')}"
    url = f"https://www.google.com/maps/dir/?api=1&origin={o}&destination={d}&travelmode=driving"
    ordered = sorted(stays, key=lambda s: s.get("waypoint_index", 0))
    if ordered:
        wps = "|".join(f"{s['lat']},{s['lon']}" for s in ordered)
        url += f"&waypoints={quote(wps, safe='|,')}"
    return url


async def ai_summary(trip, numbers):
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    system_prompt = (
        "You are a travel budget analyst. Summarize the provided REAL computed "
        "trip numbers into a short, friendly budget narrative. NEVER invent numbers; "
        "only reference figures present in the data. Use ₹ formatting. Write 120-180 "
        "words in 2-3 short paragraphs, ending with 2-3 practical money-saving tips "
        "grounded strictly in the data."
    )
    user_prompt = (
        f"Trip: {trip.get('name')} — {trip.get('starting_point')} to {trip.get('destination')}, "
        f"{trip.get('start_date')} to {trip.get('end_date')}.\n"
        f"Computed budget data (JSON):\n{json.dumps(numbers)}"
    )

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=key,
            session_id=f"final-budget-{trip['id']}",
            system_message=system_prompt,
        ).with_model("openai", "gpt-5.4")
        resp = await chat.send_message(UserMessage(text=user_prompt))
        return str(resp)
    except Exception:
        pass

    # High quality, rule-grounded budget narrative using the exact calculated data
    grand = numbers.get("grand_total", 0)
    per_day = numbers.get("per_day", 0)
    itin = numbers.get("itinerary_costs", {})
    stays_data = numbers.get("overnight_stays", {})
    drive_data = numbers.get("drive_costs") or {}
    trans_alt = numbers.get("transport_alternatives", [])
    
    parts = [
        f"Your {trip.get('name', 'trip')} from {trip.get('starting_point', 'origin')} to {trip.get('destination', 'destination')} "
        f"has an estimated grand total of ₹{grand:,.2f} (approx. ₹{per_day:,.2f} per day)."
    ]
    
    breakdown_parts = []
    if itin.get("transport_cost"):
        breakdown_parts.append(f"₹{itin['transport_cost']:,.2f} for transport")
    if itin.get("accommodation_cost") or stays_data.get("total_cost"):
        acc = (itin.get("accommodation_cost", 0) or 0) + (stays_data.get("total_cost", 0) or 0)
        breakdown_parts.append(f"₹{acc:,.2f} for accommodation & overnight stays")
    if itin.get("food_cost"):
        breakdown_parts.append(f"₹{itin['food_cost']:,.2f} for dining")
    if itin.get("activity_cost"):
        breakdown_parts.append(f"₹{itin['activity_cost']:,.2f} for activities & attractions")
    if drive_data.get("total"):
        breakdown_parts.append(f"₹{drive_data['total']:,.2f} estimated for fuel & drive costs")
        
    if breakdown_parts:
        parts.append(f"This includes {', '.join(breakdown_parts)}.")
        
    tips = ["Practical Tips to Optimize Your Budget:"]
    if drive_data.get("total"):
        tips.append("• Consider carpooling or choosing transit options to reduce per-person fuel expenses.")
    if stays_data.get("count", 0) > 0:
        tips.append("• Book overnight stays in advance near highway exits for more affordable room rates.")
    tips.append("• Balance high-spend attraction days with free local walking tours and public parks.")
    
    parts.append("\n".join(tips))
    return "\n\n".join(parts)

