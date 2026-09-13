# GlobeTrotter — PRD

## Original Problem Statement
Live-data travel planning app ("GlobeTrotter — Final Master Build Prompt") with multi-day
road-trip logistics. Stack: React + FastAPI + MongoDB (explicitly NOT Supabase/PostgreSQL).
Maps: OpenStreetMap + Leaflet + OSRM + Nominatim + Overpass (Google Maps key not provided;
OSM fallback explicitly permitted). AI: Emergent LLM key (gpt-5.4 via emergentintegrations).

## Core Requirements
1. Multi-Day Road Trip & Overnight Stay Planning (waypoints, live hotel search, map route)
2. Fuel Cost & Multi-Modal Transport Estimator (drive vs bus/train/flight + booking deep links)
3. Global, Unrestricted Destination Discovery
4. Final AI-Generated Trip Budget (LLM narrates deterministic real numbers)

## What's Implemented
### Pre-existing (earlier sessions)
- Emergent Google auth (session cookie + Bearer fallback), profile setup, account delete
- Trips + sections + places CRUD, live OSM autocomplete/nearby/route, trip score,
  budget guardian, travel load, publish/copy/public trips, community posts, admin panel,
  calendar/list itinerary views, Leaflet trip map. Seeded demo data.

### 2026-06 (this session) — Road Trip Logistics (Master Prompt P1/P2)
- Backend `/app/backend/logistics_service.py` + endpoints in server.py:
  - GET /api/trips/{id}/route-plan?max_drive_hours= — OSRM route split into daily legs,
    waypoints reverse-geocoded via Nominatim, suggested night dates
  - GET /api/trips/{id}/hotels?lat=&lon= — live Overpass hotel search (20 km radius)
  - GET/POST /api/trips/{id}/overnight-stays, PUT/DELETE /api/overnight-stays/{id}
  - GET/POST /api/trips/{id}/fuel-profile (mileage, fuel price, vehicle)
  - GET /api/trips/{id}/transport-options — drive fuel+toll cost, bus/train/flight
    heuristic estimates + deep links (Google Maps, Rome2Rio, Google Flights)
  - GET /api/trips/{id}/final-map-link — Google Maps dir link incl. stay waypoints
  - GET/POST /api/trips/{id}/final-budget — deterministic totals + AI narrative
    (gpt-5.4, EMERGENT_LLM_KEY in backend/.env)
- Overpass mirror failover (overpass-api.de → maps.mail.ru → kumi.systems)
- Discovery: nearby results cap raised 18→48, radius param supported
- Frontend `/app/frontend/src/pages/RoadTrip.jsx` at /trips/:id/roadtrip:
  drive-plan stats + slider, per-waypoint live hotel picker, saved stays w/ price,
  fuel profile form, transport comparison cards, AI final budget panel,
  "Open full route in Google Maps". Entry button on ItineraryView.
- BUG FIX: "We couldn't sign you in" — frontend/.env REACT_APP_BACKEND_URL pointed to the
  old fork's preview host (2ac71dd4…, ingress 404). Platform pinned canonical URL
  https://open-app-15.preview.emergentagent.com (routes to this pod). Full auth chain
  verified live: browser POST /api/auth/session → backend → Emergent auth provider.
- Traveler Count Costs: fuel-profile stores `travelers` (default 1); bus/train/flight
  estimates multiply by traveler count (per-person breakdown shown on cards); drive cost
  stays shared. Verified live (3 travelers: bus 1046×3, train 726×3, flight 4940×3).

## Testing Status
- Backend: all new endpoints curl-verified via localhost + external URL (route-plan,
  hotels, stays, fuel, transport, final-budget AI narrative, map-link) — PASS
- Frontend: smoke-tested Road Trip page on live preview URL (plan, legs, map render) — PASS
- Full testing_agent E2E run: NOT yet done for road-trip features (offered to user)

## Backlog
- P2: Discovery pagination UI (load-more on Search page)
- P3: UI polish, richer community tab, calendar enhancements
- Optional: per-traveler count in transport costs, EV cost basis, hotel price scraping

### 2026-06 (this session) — Full Trip Plan map view
- New page `/app/frontend/src/pages/FullTripPlan.jsx` at route `/trips/:id/plan`:
  one combined Leaflet map + "Complete roadmap" list showing every point of the trip —
  starting point (A), in-between overnight-stay hotels (H1, H2…), all itinerary places
  with coordinates (1, 2…), and the destination (B), drawn on the real OSRM route line.
- Stops are ordered by true travel progress (haversine distance from start) so stays and
  itinerary stops interleave in real sequence, not grouped by type.
- "Open in Google Maps" builds the dir link client-side including all points (up to 9 waypoints).
- Entry button "Full trip plan" (data-testid=full-trip-plan-btn) added on ItineraryView.
- Route registered in App.js. Testing agent E2E: 100% of feature scenarios PASS.

### 2026-06 (this session) — Full Trip Plan enhancements
- Numbered route line: every stop is labelled with its sequence number (1→N) in true
  driving order on both the map markers and the roadmap list (legend explains it).
- Live ETA labels: each roadmap stop shows cumulative distance + drive time measured
  ALONG the real OSRM route from the starting point (nearest-vertex projection;
  avg speed derived from route distance/duration).
- Share map link: "Share map link" button publishes the trip and copies a public URL
  `/t/:slug/plan`. New backend endpoint GET /api/trips/public/{slug}/plan (no auth) +
  new App.js route `/t/:slug/plan` rendering FullTripPlan in shared read-only mode.
  Verified live on shared page (Mumbai→Goa: 3 numbered stops, 0/291/581 km + ETAs).

### 2026-06 (this session) — Clickable stops + Print/PDF
- Clickable stops (booking hub): every stop has a one-tap action link on both the map
  marker popup and the roadmap list — overnight stays → hotel website (or Booking.com
  search if none), itinerary stops → Google Maps details, start/dest → Open location.
  TripMap popups extended to render a `link`/`linkLabel`.
- Print / PDF: "Print / PDF" button calls window.print(); print CSS in index.css
  (@media print) hides the navbar + action buttons (.no-print), trims the map to 340px,
  drops Leaflet controls, giving a clean printable/offline sheet of the full plan.
  Verified live on shared page (links "Book this stay"/"Open location" render).
