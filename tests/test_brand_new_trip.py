import requests
import sys
import json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8001/api"
s = requests.Session()
errors = []

def step(title):
    print(f"\n=======================================================")
    print(f"  >> {title}")
    print(f"=======================================================")

def check(label, r, exp=200):
    ok = r.status_code == exp
    print(f"  {'[PASS]' if ok else '[FAIL]'} {label} -> HTTP {r.status_code}")
    if not ok:
        errors.append(f"{label}: expected {exp} got {r.status_code} | {r.text[:150]}")
    return ok

# =======================================================
step("1. User Auth & Profile Setup")
# =======================================================
r = s.post(f"{BASE}/auth/demo-login", json={"role": "traveler"})
check("Traveler Demo Login", r)
token = r.json().get("session_token")
s.headers["Authorization"] = f"Bearer {token}"
user = r.json().get("user", {})
print(f"    Logged in as: {user.get('name')} ({user.get('email')})")

r = s.put(f"{BASE}/auth/profile", json={
    "first_name": "Arjun",
    "last_name": "Mehta",
    "city": "Bengaluru",
    "country": "India",
    "phone": "+91 98765 43210",
    "additional_info": "Culinary explorer & cultural heritage enthusiast."
})
check("Update User Profile", r)

# =======================================================
step("2. Browse Templates & Clone Golden Triangle")
# =======================================================
r = s.get(f"{BASE}/templates")
check("Fetch Curated Templates", r)
tmpls = r.json()
print(f"    Available templates: {len(tmpls)} found")

r = s.post(f"{BASE}/templates/tmpl-golden-triangle/clone")
check("Clone 'The Golden Triangle' Template", r)
print(f"    Message: {r.json().get('message')}")

# =======================================================
step("3. Live Place Autocomplete & City Search & Bookmarks")
# =======================================================
r = s.get(f"{BASE}/places/autocomplete", params={"q": "Kochi", "limit": 5})
check("Autocomplete Search for 'Kochi'", r)

r = s.get(f"{BASE}/places/city-info", params={"q": "Kochi"})
check("City Info for 'Kochi'", r)

r = s.post(f"{BASE}/saved-destinations", json={"place_name": "Kochi", "lat": 9.9312, "lon": 76.2673})
check("Save Bookmark: Kochi", r)

r = s.get(f"{BASE}/saved-destinations")
check("List Saved Bookmarks", r)
print(f"    Saved destinations count: {len(r.json())}")

# =======================================================
step("4. Route Preview & Create New Master Trip: South India Coastal Trail")
# =======================================================
r = s.get(f"{BASE}/route-preview", params={"lat1": 12.9716, "lon1": 77.5946, "lat2": 8.3988, "lon2": 76.9782})
check("Route Preview: Bengaluru -> Kovalam", r)
preview = r.json()
print(f"    Distance: {preview.get('distance_km', 0):.1f} km | Drive: {int(preview.get('duration_minutes', 0))//60}h {int(preview.get('duration_minutes', 0))%60}m")

r = s.post(f"{BASE}/trips", json={
    "name": "South India Spice, Sea & Heritage Trail",
    "description": "7-day road trip from Bengaluru to Kovalam via Mysore palaces, Wayanad spice plantations, Kochi fish markets, Munnar tea hills, and Alleppey backwaters.",
    "starting_point": "Bengaluru",
    "destination": "Kovalam",
    "start_lat": 12.9716,
    "start_lon": 77.5946,
    "dest_lat": 8.3988,
    "dest_lon": 76.9782,
    "start_date": "2026-11-10",
    "end_date": "2026-11-17",
    "total_budget": 60000,
    "cover_image": "https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg"
})
check("Create Master Trip", r)
trip_id = r.json().get("id")
print(f"    Trip ID: {trip_id} | Name: {r.json().get('name')}")

# =======================================================
step("5. Add 5 Day-wise Leg Sections")
# =======================================================
legs = [
    {"title": "Mysore: Royal Palace & Devaraja Heritage Market", "place_name": "Mysore", "latitude": 12.2958, "longitude": 76.6394, "section_budget": 9000, "date_start": "2026-11-10"},
    {"title": "Wayanad: Western Ghats Spices & Tribal Honey", "place_name": "Wayanad", "latitude": 11.6854, "longitude": 76.1320, "section_budget": 11000, "date_start": "2026-11-11"},
    {"title": "Kochi: Fort Kochi Chinese Nets & Mattancherry Spice Bazaar", "place_name": "Kochi", "latitude": 9.9312, "longitude": 76.2673, "section_budget": 13000, "date_start": "2026-11-12"},
    {"title": "Munnar: Rolling Tea Gardens & Cloud Mist Trails", "place_name": "Munnar", "latitude": 10.0889, "longitude": 77.0595, "section_budget": 14000, "date_start": "2026-11-14"},
    {"title": "Alleppey: Backwater Houseboat & Toddy Shop Seafood", "place_name": "Alleppey", "latitude": 9.4981, "longitude": 76.3388, "section_budget": 13000, "date_start": "2026-11-16"},
]
section_ids = []
for i, leg in enumerate(legs):
    leg["type"] = "custom"
    r = s.post(f"{BASE}/trips/{trip_id}/sections", json=leg)
    check(f"Add Leg {i+1}: {leg['place_name']}", r)
    section_ids.append(r.json()["id"])

# =======================================================
step("6. Add 15 Rich Places (Attractions + Food + Markets)")
# =======================================================
all_places = [
    # Mysore
    (section_ids[0], "osm-mysore-palace", "Mysore Palace Grand Durbar Hall", "attraction", 400, "10:00", 12.3051, 76.6551),
    (section_ids[0], "osm-mylar-dosa", "Mylari Hotel - Butter Dosa & Filter Coffee", "food", 180, "12:30", 12.3080, 76.6620),
    (section_ids[0], "osm-devaraja-mkt", "Devaraja Market - Sandalwood, Flowers & Spices", "market", 1200, "15:30", 12.3115, 76.6508),
    # Wayanad
    (section_ids[1], "osm-edakkal-caves", "Edakkal Prehistoric Rock Engraving Caves", "attraction", 350, "09:30", 11.6288, 76.2345),
    (section_ids[1], "osm-wayanad-malabar", "1980's A Nostalgic Restaurant - Malabar Biryani", "food", 450, "13:00", 11.6854, 76.1320),
    (section_ids[1], "osm-wayanad-spices", "Sulthan Bathery Spices & Organic Honey Market", "market", 1500, "16:30", 11.6627, 76.2570),
    # Kochi
    (section_ids[2], "osm-jew-synagogue", "Paradesi Synagogue & Jew Town Dutch Palace", "attraction", 250, "10:00", 9.9579, 76.2598),
    (section_ids[2], "osm-seagull-kochi", "Seagull Waterfront Restaurant - Karimeen Pollichathu", "food", 1200, "13:30", 9.9678, 76.2443),
    (section_ids[2], "osm-mattancherry-spices", "Mattancherry Wholesale Spice & Antiques Bazaar", "market", 2200, "16:00", 9.9582, 76.2590),
    # Munnar
    (section_ids[3], "osm-kolukkumalai", "Kolukkumalai Sunrise Highest Tea Plantation", "attraction", 800, "06:30", 10.0889, 77.0595),
    (section_ids[3], "osm-munnar-roti", "Rapsy Restaurant - Kerala Parotta & Beef Fry", "food", 350, "12:30", 10.0869, 77.0597),
    (section_ids[3], "osm-munnar-tea-mkt", "KDHP Tea & Homemade Chocolate Factory Bazaar", "market", 1800, "15:00", 10.0800, 77.0600),
    # Alleppey
    (section_ids[4], "osm-marari-beach", "Marari Pristine Coconut Palm Beach", "attraction", 0, "08:00", 9.6000, 76.2990),
    (section_ids[4], "osm-mullakkal-toddy", "Mullakkal Toddy Parlour - Duck Roast & Crab Curry", "food", 950, "13:00", 9.4981, 76.3388),
    (section_ids[4], "osm-coir-village", "Alleppey Canal Coir & Handmade Craft Bazaar", "market", 1100, "16:30", 9.4900, 76.3300),
]

for (sid, ext_id, name, cat, cost, sched, lat, lon) in all_places:
    r = s.post(f"{BASE}/sections/{sid}/places", json={
        "external_place_id": ext_id,
        "name": name,
        "category": cat,
        "cost_estimate": cost,
        "scheduled_time": sched,
        "lat": lat,
        "lon": lon,
        "description": f"Featured {cat} stop along South India road trip."
    })
    check(f"[{cat.upper():11s}] {name[:38]}", r)

# Edit a place cost/time to verify mutation
r_full = s.get(f"{BASE}/trips/{trip_id}/full")
places_list = r_full.json().get("places", [])
if places_list:
    p = places_list[0]
    r = s.put(f"{BASE}/places/{p['id']}", json={"cost_estimate": 450, "scheduled_time": "10:15"})
    check(f"Update Place ('{p['name'][:30]}')", r)

# =======================================================
step("7. Route Planning, Overnight Stays & Google Maps Link")
# =======================================================
r = s.get(f"{BASE}/trips/{trip_id}/route-plan", params={"max_drive_hours": 4})
check("Compute Route Plan (4h drive cap)", r)
print(f"    Computed Distance: {r.json().get('distance_km', 0):.1f} km")

hotel_bookings = [
    {"waypoint_index": 1, "waypoint_name": "Mysore", "night_date": "2026-11-10", "hotel_name": "Radisson Blu Plaza Hotel Mysore", "lat": 12.3000, "lon": 76.6600, "price_estimate": 4500},
    {"waypoint_index": 2, "waypoint_name": "Wayanad", "night_date": "2026-11-11", "hotel_name": "Vythiri Rainforest Resort", "lat": 11.5500, "lon": 76.0400, "price_estimate": 6200},
    {"waypoint_index": 3, "waypoint_name": "Kochi", "night_date": "2026-11-12", "hotel_name": "Brunton Boatyard Heritage Hotel", "lat": 9.9678, "lon": 76.2443, "price_estimate": 8900},
    {"waypoint_index": 4, "waypoint_name": "Munnar", "night_date": "2026-11-14", "hotel_name": "Fragrant Nature Munnar Mist Resort", "lat": 10.0889, "lon": 77.0595, "price_estimate": 5800},
    {"waypoint_index": 5, "waypoint_name": "Alleppey", "night_date": "2026-11-16", "hotel_name": "Lake Palace Backwater Resort", "lat": 9.4981, "lon": 76.3388, "price_estimate": 7500},
]
stay_ids = []
for h in hotel_bookings:
    r = s.post(f"{BASE}/trips/{trip_id}/overnight-stays", json=h)
    check(f"Book Overnight Stay: {h['hotel_name'][:35]}", r)
    stay_ids.append(r.json()["id"])

r = s.put(f"{BASE}/overnight-stays/{stay_ids[0]}", json={"price_estimate": 4800})
check("Update Stay Price (Radisson Mysore -> Rs.4800)", r)

r = s.get(f"{BASE}/trips/{trip_id}/overnight-stays")
check("Fetch All Booked Stays", r)
print(f"    Total overnight stays: {len(r.json())}")

r = s.get(f"{BASE}/trips/{trip_id}/final-map-link")
check("Generate Google Maps Live Route URL", r)
print(f"    Navigation URL: {str(r.json().get('url',''))[:75]}...")

# =======================================================
step("8. Fuel Profile & Multi-Modal Transport Comparison")
# =======================================================
r = s.post(f"{BASE}/trips/{trip_id}/fuel-profile", json={
    "vehicle_type": "car",
    "mileage_kmpl": 16.0,
    "fuel_price_per_liter": 102.5,
    "travelers": 3
})
check("Save Fuel Profile (Car, 16 kmpl, Rs.102.5/L, 3 travelers)", r)

r = s.get(f"{BASE}/trips/{trip_id}/transport-options")
check("Fetch Transport Mode Estimates", r)
t_opts = r.json().get("options", [])
for opt in t_opts:
    print(f"    - {opt.get('mode','').upper():8s}: Rs.{opt.get('cost_estimate',0):,.0f} | {int(opt.get('duration_minutes',0))//60}h {int(opt.get('duration_minutes',0))%60}m")

# =======================================================
step("9. Health Score, Travel Load Index & AI Budget Narrative")
# =======================================================
r = s.get(f"{BASE}/trips/{trip_id}/score")
check("Trip Health Score", r)
sc = r.json()
print(f"    Score: {sc.get('total')}/100 | Pace: {sc.get('pace')}")

r = s.get(f"{BASE}/trips/{trip_id}/travel-load")
check("Travel Load Index", r)
tl = r.json()
print(f"    Load: {tl.get('index')} | {tl.get('activities_per_day')} acts/day")

r = s.get(f"{BASE}/trips/{trip_id}/final-budget")
check("Budget Guardian Summary", r)
bg = r.json()
print(f"    Planned Spend: Rs.{bg.get('total_planned_spend',0):,.0f} / Total Budget: Rs.{bg.get('total_budget',0):,.0f}")

r = s.post(f"{BASE}/trips/{trip_id}/final-budget")
check("Generate AI Budget Narrative", r)
narr = r.json().get("narrative","")
print(f"\n--- AI NARRATIVE EXCERPT ---\n{narr[:320]}...\n----------------------------\n")

# =======================================================
step("10. Live Weather Forecast per Stop (Open-Meteo)")
# =======================================================
r = s.get(f"{BASE}/trips/{trip_id}/weather")
check("Fetch 7-Day Live Weather for All Stops", r)
wx = r.json()
print(f"    Stops with weather data: {len(wx)}")
for stop in wx[:4]:
    fc = stop.get("forecast", [])
    if fc:
        print(f"    - {stop['stop_name'][:35]}: {fc[0].get('emoji')} {fc[0].get('condition')} | {fc[0].get('temp_max')}C / {fc[0].get('temp_min')}C | Rain: {fc[0].get('precipitation_mm',0)}mm")

# =======================================================
step("11. Calendar Export (.ics)")
# =======================================================
r = s.get(f"{BASE}/trips/{trip_id}/export/ics")
check("Export RFC 5545 iCalendar (.ics)", r)
ics_valid = b"BEGIN:VCALENDAR" in r.content and b"BEGIN:VEVENT" in r.content
ev_count = r.content.count(b"BEGIN:VEVENT")
print(f"    Valid iCal: {ics_valid} | Calendar Events: {ev_count} | Size: {len(r.content)} bytes")

# =======================================================
step("12. GPX Route Export (.gpx)")
# =======================================================
r = s.get(f"{BASE}/trips/{trip_id}/export/gpx")
check("Export GPS Track (.gpx)", r)
gpx_valid = b"<?xml" in r.content and b"<gpx" in r.content and b"<wpt" in r.content
wpt_count = r.content.count(b"<wpt")
print(f"    Valid GPX 1.1: {gpx_valid} | Waypoints: {wpt_count} | Size: {len(r.content)} bytes")

# =======================================================
step("13. Expense Logger & Bill Split Settlements")
# =======================================================
group_expenses = [
    {"description": "Mysore Butter Dosa & Filter Coffee Breakfast", "amount": 540, "category": "food", "paid_by": "Arjun", "split_among": ["Arjun", "Kavya", "Nikhil"]},
    {"description": "Wayanad Organic Spices & Wild Honey", "amount": 3200, "category": "shopping", "paid_by": "Kavya", "split_among": ["Kavya"]},
    {"description": "Fort Kochi Seafood Feast at Seagull", "amount": 3600, "category": "food", "paid_by": "Nikhil", "split_among": ["Arjun", "Kavya", "Nikhil"]},
    {"description": "Brunton Boatyard Kochi Stay", "amount": 8900, "category": "stay", "paid_by": "Arjun", "split_among": ["Arjun", "Kavya", "Nikhil"]},
    {"description": "Kolukkumalai 4x4 Jeep Safari Trek", "amount": 2400, "category": "activity", "paid_by": "Kavya", "split_among": ["Arjun", "Kavya", "Nikhil"]},
    {"description": "Highway Fuel Refill (Full Tank)", "amount": 4200, "category": "transport", "paid_by": "Nikhil", "split_among": ["Arjun", "Kavya", "Nikhil"]},
]
exp_ids = []
for exp in group_expenses:
    r = s.post(f"{BASE}/trips/{trip_id}/expenses", json=exp)
    check(f"Log Expense: {exp['description'][:40]}", r)
    exp_ids.append(r.json().get("id"))

r = s.get(f"{BASE}/trips/{trip_id}/expenses")
check("List All Trip Expenses", r)
print(f"    Total receipts logged: {len(r.json())}")

r = s.get(f"{BASE}/trips/{trip_id}/expenses/summary")
check("Compute Bill Split Settlements", r)
summ = r.json()
print(f"    Total Spent: Rs.{summ['total_spent']:,.2f}")
print(f"    By Category: {summ['by_category']}")
for settle in summ.get("settlements", []):
    print(f"      {settle['from']} owes {settle['to']}: Rs.{settle['amount']:,.2f}")

# =======================================================
step("14. Publish to Public Web & Unauthenticated Verification")
# =======================================================
r = s.post(f"{BASE}/trips/{trip_id}/publish")
check("Publish Trip Publicly", r)
slug = r.json().get("public_slug", "")
print(f"    Public URL slug: {slug}")

r_pub = requests.get(f"{BASE}/trips/public/{slug}")
check("Unauthenticated Public Itinerary View", r_pub)

r_plan = requests.get(f"{BASE}/trips/public/{slug}/plan")
check("Unauthenticated Public Route Plan View", r_plan)
print(f"    Route polyline points: {len(r_plan.json().get('route_geometry', []) or [])}")

# =======================================================
step("15. Community Sharing & Feed Discovery")
# =======================================================
r = s.post(f"{BASE}/community/posts", json={
    "title": "7 Days South India Trail: Mysore Palaces, Munnar Teas & Alleppey Backwaters! ???",
    "body": "Unbelievable coastal road trip across Karnataka and Kerala! Fresh Karimeen fish in Kochi, sunrise over tea hills in Kolukkumalai, and sunset in Alleppey backwaters. Total 3-person budget under Rs.60k!",
    "trip_id": trip_id,
    "place_name": "Kochi, Kerala",
    "image": "https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg"
})
check("Create Community Post", r)
post_id = r.json().get("id", "")

r = s.get(f"{BASE}/community/posts", params={"q": "Kochi"})
check("Search Feed for 'Kochi'", r)
found = any(p.get("id") == post_id for p in r.json())
print(f"    Community post discoverable: {found} (Found {len(r.json())} result(s))")

# =======================================================
step("16. Admin Analytics & RBAC Security Check")
# =======================================================
r_admin_login = requests.post(f"{BASE}/auth/demo-login", json={"role": "admin"})
check("Admin Login", r_admin_login)
admin_headers = {"Authorization": f"Bearer {r_admin_login.json()['session_token']}"}

r = requests.get(f"{BASE}/admin/stats", headers=admin_headers)
check("Admin Overview Stats", r)
st = r.json()
print(f"    Platform Totals -> Users: {st.get('users')} | Trips: {st.get('trips')} | Places: {st.get('places')} | Posts: {st.get('posts')}")

r = requests.get(f"{BASE}/admin/popular-cities", headers=admin_headers)
check("Admin Popular Cities Ranking", r)

# Verify Traveler is blocked from Admin endpoints
r_rbac = s.get(f"{BASE}/admin/stats")
ok_rbac = r_rbac.status_code == 403
print(f"  {'[PASS]' if ok_rbac else '[FAIL]'} RBAC Check: Traveler blocked from Admin -> HTTP {r_rbac.status_code}")
if not ok_rbac:
    errors.append(f"RBAC failed: traveler got HTTP {r_rbac.status_code}")

# =======================================================
step("17. Full Trip Integrity Verification")
# =======================================================
r = s.get(f"{BASE}/trips/{trip_id}/full")
check("Fetch Complete Assembled Trip Object", r)
final_full = r.json()

r_final_stays = s.get(f"{BASE}/trips/{trip_id}/overnight-stays")
check("Fetch Final Stays", r_final_stays)

r_final_expenses = s.get(f"{BASE}/trips/{trip_id}/expenses")
check("Fetch Final Expenses", r_final_expenses)

t = final_full["trip"]
score = final_full["score"]

print(f"\n=======================================================")
print(f"  FULL END-TO-END TRIP SUMMARY")
print(f"=======================================================")
print(f"  Trip Name:         {t['name']}")
print(f"  Route:             {t['starting_point']} -> {t['destination']}")
print(f"  Dates:             {t['start_date']} to {t['end_date']} (7 Days)")
print(f"  Planned Budget:    Rs.{t['total_budget']:,.2f}")
print(f"  Leg Sections:      {len(final_full['sections'])} legs")
print(f"  Places Logged:     {len(final_full['places'])} (Attractions + Food + Markets)")
print(f"  Overnight Stays:   {len(r_final_stays.json())} hotels booked")
print(f"  Group Expenses:    {len(r_final_expenses.json())} receipts logged (Rs.{summ['total_spent']:,.2f})")
print(f"  Health Score:      {score['total']}/100 ({score['pace']} pace)")
print(f"  Public URL:        http://localhost:3000/t/{slug}")
print(f"  PDF Brochure:      http://localhost:3000/trips/{trip_id}/brochure")
print(f"=======================================================\n")

if errors:
    print(f"FAILED CHECKS ({len(errors)}):")
    for e in errors:
        print(f"  [ERROR] {e}")
else:
    print("ALL 17 STAGES PASSED WITH ZERO BUGS & ZERO ERRORS!")
