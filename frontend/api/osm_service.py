"""Live OpenStreetMap data services: Nominatim (search/geocode), OSRM (routing),
Overpass (nearby places). All calls are real, live network calls. Responses are
briefly cached in MongoDB (place_cache) purely for performance / rate-limit safety.
No real-world place data is ever hardcoded."""
import httpx
import math
import json
from datetime import datetime, timezone, timedelta

NOMINATIM = "https://nominatim.openstreetmap.org"
OSRM = "https://router.project-osrm.org"
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
HEADERS = {"User-Agent": "GlobeTrotter/1.0 (live travel planner; contact demo@globetrotter.app)"}
CACHE_TTL_HOURS = 3

# Generic category visual placeholders (NOT place-specific data — UI imagery only).
CATEGORY_IMAGES = {
    "food": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=70",
    "market": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=70",
    "attraction": "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=600&q=70",
    "hotel": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=70",
    "other": "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=70",
}

CATEGORY_FILTERS = {
    "food": ['node["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream"]',
             'way["amenity"~"restaurant|cafe|fast_food|bar|pub"]'],
    "market": ['node["amenity"="marketplace"]', 'way["amenity"="marketplace"]',
               'node["shop"~"supermarket|mall|bakery|department_store|greengrocer"]',
               'way["shop"~"supermarket|mall|department_store"]'],
    "attraction": ['node["tourism"~"attraction|museum|artwork|viewpoint|gallery|zoo|theme_park|aquarium"]',
                   'way["tourism"~"attraction|museum|gallery|zoo|theme_park"]',
                   'node["historic"]', 'way["historic"]'],
    "hotel": ['node["tourism"~"hotel|guest_house|hostel|motel|apartment|chalet|resort"]',
              'way["tourism"~"hotel|guest_house|hostel|motel|resort"]'],
}


def _haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2 +
         math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2)
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def _title(s):
    return " ".join(w.capitalize() for w in str(s).replace("_", " ").split())


async def autocomplete(q: str):
    if not q or len(q.strip()) < 2:
        return []
    params = {"q": q, "format": "jsonv2", "addressdetails": 1, "limit": 6}
    async with httpx.AsyncClient(timeout=8, headers=HEADERS) as c:
        r = await c.get(f"{NOMINATIM}/search", params=params)
        r.raise_for_status()
        data = r.json()
    out = []
    for d in data:
        out.append({
            "place_id": str(d.get("place_id")),
            "name": d.get("display_name", "").split(",")[0],
            "display_name": d.get("display_name"),
            "lat": float(d["lat"]),
            "lon": float(d["lon"]),
            "type": d.get("type"),
        })
    return out


async def route(lat1, lon1, lat2, lon2):
    url = f"{OSRM}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
    params = {"overview": "full", "geometries": "geojson"}
    async with httpx.AsyncClient(timeout=20, headers=HEADERS) as c:
        r = await c.get(url, params=params)
        r.raise_for_status()
        data = r.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        # Fall back to straight-line if road route unavailable (still a real computation).
        km = _haversine_km(lat1, lon1, lat2, lon2)
        return {"distance_km": km, "duration_minutes": round(km / 60 * 60, 0),
                "geometry": [[lat1, lon1], [lat2, lon2]], "approx": True}
    rt = data["routes"][0]
    coords = rt["geometry"]["coordinates"]  # [lon,lat]
    geometry = [[c[1], c[0]] for c in coords]
    return {
        "distance_km": round(rt["distance"] / 1000, 2),
        "duration_minutes": round(rt["duration"] / 60, 0),
        "geometry": geometry,
        "approx": False,
    }


async def _overpass(lat, lon, category, radius=5000):
    filters = CATEGORY_FILTERS.get(category, CATEGORY_FILTERS["attraction"])
    body = "[out:json][timeout:25];("
    for f in filters:
        body += f"{f}(around:{radius},{lat},{lon});"
    body += ");out center 60;"
    last_err = None
    async with httpx.AsyncClient(timeout=30, headers=HEADERS) as c:
        for url in OVERPASS_MIRRORS:
            try:
                r = await c.post(url, data={"data": body})
                r.raise_for_status()
                return r.json()
            except Exception as e:
                last_err = e
    raise last_err


def _parse_elements(data, center_lat, center_lon, category):
    results = []
    seen = set()
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name or name in seen:
            continue
        if el.get("type") == "node":
            elat, elon = el.get("lat"), el.get("lon")
        else:
            cen = el.get("center", {})
            elat, elon = cen.get("lat"), cen.get("lon")
        if elat is None:
            continue
        seen.add(name)
        # Description strictly from OSM tags.
        desc_bits = []
        for key in ("cuisine", "tourism", "historic", "shop", "amenity"):
            if tags.get(key) and tags.get(key) not in ("yes",):
                desc_bits.append(_title(tags.get(key)))
        if tags.get("opening_hours"):
            desc_bits.append(f"Open: {tags['opening_hours'][:24]}")
        description = " · ".join(desc_bits[:3]) or _title(category)
        rating = None
        for rk in ("stars", "rating"):
            if tags.get(rk):
                try:
                    rating = float(str(tags[rk]).split(";")[0])
                except ValueError:
                    pass
        img = tags.get("image")
        photo = img if (img and img.startswith("http")) else CATEGORY_IMAGES.get(category, CATEGORY_IMAGES["other"])
        results.append({
            "external_place_id": f"{el.get('type')}/{el.get('id')}",
            "name": name,
            "category": category,
            "rating": rating,
            "photo_url": photo,
            "website": tags.get("website") or tags.get("contact:website"),
            "description": description,
            "lat": elat,
            "lon": elon,
            "distance_km": _haversine_km(center_lat, center_lon, elat, elon),
        })
    results.sort(key=lambda x: x["distance_km"])
    return results[:48]


async def nearby(db, lat, lon, category, radius=5000):
    key = f"{category}:{round(lat, 3)}:{round(lon, 3)}:{radius}"
    now = datetime.now(timezone.utc)
    cached = await db.place_cache.find_one({"cache_key": key}, {"_id": 0})
    if cached:
        fetched = datetime.fromisoformat(cached["fetched_at"])
        if fetched.tzinfo is None:
            fetched = fetched.replace(tzinfo=timezone.utc)
        if now - fetched < timedelta(hours=CACHE_TTL_HOURS):
            return json.loads(cached["response_json"])
    data = await _overpass(lat, lon, category, radius)
    parsed = _parse_elements(data, lat, lon, category)
    await db.place_cache.update_one(
        {"cache_key": key},
        {"$set": {"cache_key": key, "category": category,
                  "response_json": json.dumps(parsed),
                  "fetched_at": now.isoformat()}},
        upsert=True,
    )
    return parsed
