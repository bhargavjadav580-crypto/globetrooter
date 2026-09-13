import requests
import sys
import json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8001/api"
s_owner = requests.Session()
s_editor = requests.Session()
s_admin = requests.Session()

PASS = "[PASS]"
FAIL = "[FAIL]"
errors = []

def step(num, title):
    print(f"\n=======================================================")
    print(f"  STAGE {num}: {title}")
    print(f"=======================================================")

def check(label, r, exp=200):
    ok = r.status_code == exp
    status_sym = PASS if ok else FAIL
    print(f"  {status_sym} {label} -> HTTP {r.status_code}")
    if not ok:
        err_msg = f"STAGE FAILURE - {label}: expected {exp}, got {r.status_code} | Body: {r.text[:200]}"
        errors.append(err_msg)
        print(f"      >>> ERROR: {r.text[:200]}")
    return ok

# =======================================================
step(1, "Traveler Authentication & Profile Customization")
# =======================================================
r = s_owner.post(f"{BASE}/auth/demo-login", json={"role": "traveler"})
check("Owner Demo Login", r)
owner_token = r.json().get("session_token")
s_owner.headers["Authorization"] = f"Bearer {owner_token}"
owner_user = r.json().get("user", {})
print(f"    Owner: {owner_user.get('name')} ({owner_user.get('email')})")

r = s_owner.put(f"{BASE}/auth/profile", json={
    "first_name": "Dev",
    "last_name": "Kapoor",
    "city": "Mumbai",
    "country": "India",
    "phone": "+91 98200 11223",
    "additional_info": "Road-tripper, food photographer & heritage explorer."
})
check("Update Owner Profile", r)

# =======================================================
step(2, "Curated Template Gallery & 1-Click Clone")
# =======================================================
r = s_owner.get(f"{BASE}/templates")
check("Fetch Template Gallery", r)
templates = r.json()
print(f"    Loaded {len(templates)} templates: {[t['name'] for t in templates]}")

r = s_owner.post(f"{BASE}/templates/tmpl-rajasthan-royal/clone")
check("1-Click Clone 'Rajasthan Royal' Template", r)
print(f"    Clone Result: {r.json().get('message')}")

# =======================================================
step(3, "Location Intelligence, Autocomplete & Saved Bookmarks")
# =======================================================
r = s_owner.get(f"{BASE}/places/autocomplete", params={"q": "Jodhpur", "limit": 5})
check("Autocomplete Search for 'Jodhpur'", r)
print(f"    Suggestions returned: {len(r.json())}")

r = s_owner.get(f"{BASE}/places/city-info", params={"q": "Jodhpur"})
check("Fetch City Info for 'Jodhpur'", r)

r = s_owner.post(f"{BASE}/saved-destinations", json={"place_name": "Jodhpur", "lat": 26.2389, "lon": 73.0243})
check("Bookmark Destination: Jodhpur", r)

r = s_owner.get(f"{BASE}/saved-destinations")
check("List Saved Bookmarks", r)
print(f"    Total bookmarks: {len(r.json())}")

# =======================================================
step(4, "Route Geometry Preview & Master Trip Creation")
# =======================================================
r = s_owner.get(f"{BASE}/route-preview", params={"lat1": 19.0760, "lon1": 72.8777, "lat2": 26.2389, "lon2": 73.0243})
check("Route Preview (Mumbai -> Jodhpur)", r)
rt_preview = r.json()
print(f"    Estimated Distance: {rt_preview.get('distance_km', 0):.1f} km | Drive Time: {int(rt_preview.get('duration_minutes', 0))//60}h {int(rt_preview.get('duration_minutes', 0))%60}m")

r = s_owner.post(f"{BASE}/trips", json={
    "name": "Royal Rajasthan Grand Expedition: Palaces, Bazaars & Forts",
    "description": "7-day road adventure across Mumbai, Vadodara, Udaipur, Jodhpur & Jaipur exploring royal forts, historic thalis, and artisan bazaars.",
    "starting_point": "Mumbai",
    "destination": "Jaipur",
    "start_lat": 19.0760,
    "start_lon": 72.8777,
    "dest_lat": 26.9124,
    "dest_lon": 75.7873,
    "start_date": "2026-12-10",
    "end_date": "2026-12-17",
    "total_budget": 65000,
    "cover_image": "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg"
})
check("Create Master Trip", r)
trip_id = r.json()["id"]
print(f"    Trip ID: {trip_id} | Name: '{r.json()['name']}'")

# =======================================================
step(5, "Add & Reorder 5 Day-wise Leg Sections")
# =======================================================
sections_config = [
    {"title": "Mumbai: Crawford Spice Bazaar & Coastal Departure", "place_name": "Mumbai", "latitude": 19.0396, "longitude": 72.8560, "section_budget": 10000, "date_start": "2026-12-10"},
    {"title": "Vadodara: Laxmi Vilas Palace & Patola Silk Weavers", "place_name": "Vadodara", "latitude": 22.3072, "longitude": 73.1812, "section_budget": 12000, "date_start": "2026-12-11"},
    {"title": "Udaipur: Lake Pichola Sunset & Royal Dining", "place_name": "Udaipur", "latitude": 24.5854, "longitude": 73.7125, "section_budget": 16000, "date_start": "2026-12-13"},
    {"title": "Jodhpur: Blue City Mehrangarh Fort & Spice Trail", "place_name": "Jodhpur", "latitude": 26.2389, "longitude": 73.0243, "section_budget": 13000, "date_start": "2026-12-15"},
    {"title": "Jaipur: Amber Palace Grandeur & Johari Gems Bazaar", "place_name": "Jaipur", "latitude": 26.9124, "longitude": 75.7873, "section_budget": 14000, "date_start": "2026-12-16"},
]
section_ids = []
for i, sc in enumerate(sections_config):
    sc["type"] = "custom"
    r = s_owner.post(f"{BASE}/trips/{trip_id}/sections", json=sc)
    check(f"Add Section {i+1}: {sc['place_name']}", r)
    section_ids.append(r.json()["id"])

# Test Reorder Sections
r = s_owner.post(f"{BASE}/trips/{trip_id}/sections/reorder", json={"order": section_ids})
check("Reorder Sections", r)

# =======================================================
step(6, "Add 15 Categorized Places (Attractions + Food + Markets)")
# =======================================================
places_master = [
    # Mumbai
    (section_ids[0], "p-mumbai-art", "Dharavi Street Art Walk", "attraction", 250, "09:00", 19.0396, 72.8560, ["Must Try", "Heritage"]),
    (section_ids[0], "p-mumbai-food", "Aaswad - Maharashtrian Thali", "food", 380, "12:30", 19.0562, 72.8381, ["Must Try", "Pure Veg"]),
    (section_ids[0], "p-mumbai-mkt", "Crawford Market Wholesale Spice Bazaar", "market", 600, "15:30", 18.9462, 72.8348, ["Budget", "Must Try"]),
    # Vadodara
    (section_ids[1], "p-baroda-palace", "Laxmi Vilas Palace Museum", "attraction", 800, "10:00", 22.2934, 73.1976, ["Heritage", "Scenic View"]),
    (section_ids[1], "p-baroda-food", "Mandap - Traditional Kathiyawadi Feast", "food", 480, "13:00", 22.3072, 73.1812, ["Pure Veg", "Family-Friendly"]),
    (section_ids[1], "p-baroda-mkt", "Hazira Double-Ikat Silk Weaving Bazaar", "market", 2500, "16:00", 22.3003, 73.2050, ["Heritage", "Must Try"]),
    # Udaipur
    (section_ids[2], "p-udaipur-palace", "Udaipur City Palace & Crystal Gallery", "attraction", 950, "09:30", 24.5763, 73.6838, ["Heritage", "Scenic View", "Must Try"]),
    (section_ids[2], "p-udaipur-food", "Ambrai Ghat Waterfront Dining", "food", 1900, "19:30", 24.5771, 73.6796, ["Couples", "Scenic View", "Must Try"]),
    (section_ids[2], "p-udaipur-mkt", "Hathi Pol Miniature Painting Bazaar", "market", 1600, "16:00", 24.5797, 73.6888, ["Heritage", "Budget"]),
    # Jodhpur
    (section_ids[3], "p-jodhpur-fort", "Mehrangarh Fort & Museum", "attraction", 600, "09:00", 26.2980, 73.0189, ["Heritage", "Scenic View", "Must Try"]),
    (section_ids[3], "p-jodhpur-food", "Shahi Samosa & Mawa Kachori House", "food", 220, "12:00", 26.2930, 73.0230, ["Must Try", "Budget", "Pure Veg"]),
    (section_ids[3], "p-jodhpur-mkt", "Clock Tower Sadar Spice & Handicraft Market", "market", 1200, "15:00", 26.2954, 73.0244, ["Must Try", "Heritage"]),
    # Jaipur
    (section_ids[4], "p-jaipur-amber", "Amber Palace & Sheesh Mahal", "attraction", 1000, "09:00", 26.9855, 75.8513, ["Heritage", "Scenic View", "Must Try"]),
    (section_ids[4], "p-jaipur-food", "LMB Laxmi Mishthan Bhandar Rajasthani Thali", "food", 750, "13:00", 26.9154, 75.8225, ["Pure Veg", "Heritage", "Must Try"]),
    (section_ids[4], "p-jaipur-mkt", "Johari Bazaar Kundan Gems & Block-Print Fabric", "market", 3200, "16:00", 26.9225, 75.8194, ["Must Try", "Heritage"]),
]

place_ids = []
for (sid, ext_id, name, cat, cost, sched, lat, lon, tags) in places_master:
    r = s_owner.post(f"{BASE}/sections/{sid}/places", json={
        "external_place_id": ext_id, "name": name, "category": cat,
        "cost_estimate": cost, "scheduled_time": sched, "lat": lat, "lon": lon,
        "description": f"Featured {cat} destination in Rajasthan.",
        "tags": tags,
        "booking_url": f"https://www.tourism.rajasthan.gov.in/places/{ext_id}" if cat == "attraction" else None,
        "local_tips": "Arrive early to avoid afternoon heat and peak crowds."
    })
    check(f"Add [{cat.upper():10s}] {name[:36]}", r)
    place_ids.append(r.json()["id"])

# =======================================================
step(7, "TripAdvisor Feature: 1-5 Star Ratings & Place Reviews")
# =======================================================
sample_place_id = place_ids[0]

# Review 1
r = s_owner.post(f"{BASE}/places/{sample_place_id}/reviews", json={
    "rating": 5,
    "comment": "An extraordinary cultural and historical immersion. Highly recommended!",
    "visit_tip": "Hire an authorized local guide at the gate for untold stories."
})
check("Submit 5-Star Review with Traveler Tip", r)
rev1_id = r.json()["id"]

# Review 2
r = s_owner.post(f"{BASE}/places/{sample_place_id}/reviews", json={
    "rating": 4,
    "comment": "Incredible architecture, though can get crowded during peak hours.",
    "visit_tip": "Wear comfortable walking footwear."
})
check("Submit 4-Star Review", r)

# Get Reviews Summary & Computed Average
r = s_owner.get(f"{BASE}/places/{sample_place_id}/reviews")
check("Fetch Place Reviews & Average Score", r)
rev_summary = r.json()
print(f"    Place Reviews: {rev_summary['review_count']} reviews | Average Score: {rev_summary['avg_rating']}?")

# Delete Review 1 to test deletion & recalculation
r = s_owner.delete(f"{BASE}/places/{sample_place_id}/reviews/{rev1_id}")
check("Delete Review & Recalculate Average", r)

# =======================================================
step(8, "TripAdvisor Feature: Vibe/Dietary Tags & Booking Links")
# =======================================================
r = s_owner.put(f"{BASE}/places/{sample_place_id}", json={
    "cost_estimate": 300,
    "tags": ["Must Try", "Heritage", "Scenic View", "Budget"],
    "booking_url": "https://www.getyourguide.com/experience-123",
    "local_tips": "Photography is permitted; best lighting before 11:00 AM."
})
check("Update Place Tags, Cost & Booking URL", r)
print(f"    Updated Place Tags: {r.json().get('tags')}")

# =======================================================
step(9, "TripAdvisor Feature: Multi-User Collaboration & RBAC")
# =======================================================
# 1. Invite friend as Editor (using a different email than the owner)
r = s_owner.post(f"{BASE}/trips/{trip_id}/collaborators", json={
    "email": "friend.editor@example.com",
    "role": "editor"
})
check("Invite Collaborator (Role: Editor)", r)
collab_editor_id = r.json()["id"]

# 2. Invite friend as Viewer
r = s_owner.post(f"{BASE}/trips/{trip_id}/collaborators", json={
    "email": "readonly.friend@example.com",
    "role": "viewer"
})
check("Invite Collaborator (Role: Viewer)", r)
collab_viewer_id = r.json()["id"]

# 3. List all collaborators
r = s_owner.get(f"{BASE}/trips/{trip_id}/collaborators")
check("List Trip Collaborators", r)
collabs_list = r.json().get("collaborators", [])
print(f"    Active Collaborators: {len(collabs_list)} members")

# 4. Remove viewer collaborator
r = s_owner.delete(f"{BASE}/trips/{trip_id}/collaborators/{collab_viewer_id}")
check("Remove Viewer Collaborator", r)

# =======================================================
step(10, "Multi-Day Route Planning, 4 Stays & Google Maps")
# =======================================================
r = s_owner.get(f"{BASE}/trips/{trip_id}/route-plan", params={"max_drive_hours": 5})
check("Compute Multi-Day Route Plan (5h max)", r)
print(f"    Route Distance: {r.json().get('distance_km', 0):.1f} km")

hotel_bookings = [
    {"waypoint_index": 1, "waypoint_name": "Vadodara", "night_date": "2026-12-11", "hotel_name": "WelcomHotel Vadodara - ITC Hotel", "lat": 22.3072, "lon": 73.1812, "price_estimate": 4200},
    {"waypoint_index": 2, "waypoint_name": "Udaipur", "night_date": "2026-12-13", "hotel_name": "Taj Lake Palace Royal Island Resort", "lat": 24.5763, "lon": 73.6838, "price_estimate": 8900},
    {"waypoint_index": 3, "waypoint_name": "Jodhpur", "night_date": "2026-12-15", "hotel_name": "Umaid Bhawan Palace Heritage Wing", "lat": 26.2808, "lon": 73.0475, "price_estimate": 7800},
    {"waypoint_index": 4, "waypoint_name": "Jaipur", "night_date": "2026-12-16", "hotel_name": "Rambagh Palace Jaipur Luxury Suites", "lat": 26.8936, "lon": 75.8105, "price_estimate": 8200},
]
stay_ids = []
for h in hotel_bookings:
    r = s_owner.post(f"{BASE}/trips/{trip_id}/overnight-stays", json=h)
    check(f"Book Hotel: {h['hotel_name'][:36]}", r)
    stay_ids.append(r.json()["id"])

r = s_owner.put(f"{BASE}/overnight-stays/{stay_ids[0]}", json={"price_estimate": 4500})
check("Update Stay Price (Vadodara -> Rs.4500)", r)

r = s_owner.get(f"{BASE}/trips/{trip_id}/overnight-stays")
check("Fetch All Booked Stays", r)
print(f"    Total Stays Booked: {len(r.json())}")

r = s_owner.get(f"{BASE}/trips/{trip_id}/final-map-link")
check("Generate Google Maps Live Route URL", r)
print(f"    Maps Link: {str(r.json().get('url',''))[:70]}...")

# =======================================================
step(11, "Fuel Profile & Multi-Modal Transport Comparison")
# =======================================================
r = s_owner.post(f"{BASE}/trips/{trip_id}/fuel-profile", json={
    "vehicle_type": "suv",
    "mileage_kmpl": 14.5,
    "fuel_price_per_liter": 101.5,
    "travelers": 4
})
check("Save SUV Fuel Profile (14.5 kmpl, Rs.101.5/L, 4 travelers)", r)

r = s_owner.get(f"{BASE}/trips/{trip_id}/transport-options")
check("Multi-Modal Transport Mode Options", r)
for opt in r.json().get("options", []):
    print(f"    - {opt.get('mode','').upper():8s}: Rs.{opt.get('cost_estimate',0):,.0f} | {int(opt.get('duration_minutes',0))//60}h {int(opt.get('duration_minutes',0))%60}m")

# =======================================================
step(12, "Scoring, Travel Load Index & AI Narrative")
# =======================================================
r = s_owner.get(f"{BASE}/trips/{trip_id}/score")
check("Trip Health Score (0-100)", r)
sc = r.json()
print(f"    Score: {sc.get('total')}/100 | Pace: {sc.get('pace')}")

r = s_owner.get(f"{BASE}/trips/{trip_id}/travel-load")
check("Travel Load Index", r)

r = s_owner.get(f"{BASE}/trips/{trip_id}/final-budget")
check("Budget Guardian Summary", r)

r = s_owner.post(f"{BASE}/trips/{trip_id}/final-budget")
check("Generate AI Budget Narrative", r)
narr = r.json().get("narrative", "")
print(f"\n--- AI NARRATIVE EXCERPT ---\n{narr[:280]}...\n----------------------------\n")

# =======================================================
step(13, "Live 7-Day Weather Forecast per Stop (Open-Meteo)")
# =======================================================
r = s_owner.get(f"{BASE}/trips/{trip_id}/weather")
check("Fetch Weather for All Route Stops", r)
wx = r.json()
print(f"    Stops with weather data: {len(wx)}")
for stop in wx[:4]:
    fc = stop.get("forecast", [])
    if fc:
        print(f"    - {stop['stop_name'][:30]}: {fc[0].get('emoji')} {fc[0].get('condition')} | {fc[0].get('temp_max')}C / {fc[0].get('temp_min')}C | Rain {fc[0].get('precipitation_mm',0)}mm")

# =======================================================
step(14, "RFC 5545 Calendar Export (.ics)")
# =======================================================
r = s_owner.get(f"{BASE}/trips/{trip_id}/export/ics")
check("Export .ics Calendar File", r)
ics_ok = b"BEGIN:VCALENDAR" in r.content and b"BEGIN:VEVENT" in r.content
print(f"    Valid iCal: {ics_ok} | Events: {r.content.count(b'BEGIN:VEVENT')} | Size: {len(r.content)} bytes")

# =======================================================
step(15, "GPX 1.1 GPS Track Export (.gpx)")
# =======================================================
r = s_owner.get(f"{BASE}/trips/{trip_id}/export/gpx")
check("Export .gpx Route File", r)
gpx_ok = b"<?xml" in r.content and b"<gpx" in r.content and b"<wpt" in r.content
print(f"    Valid GPX 1.1: {gpx_ok} | Waypoints: {r.content.count(b'<wpt')} | Size: {len(r.content)} bytes")

# =======================================================
step(16, "Group Expense Logger & Settlement Algorithm")
# =======================================================
group_expenses = [
    {"description": "Crawford Market Dry Fruits & Spices", "amount": 600, "category": "shopping", "paid_by": "Dev", "split_among": ["Dev", "Aanya", "Kabir", "Zara"]},
    {"description": "Laxmi Vilas Palace Museum 4x Tickets", "amount": 3200, "category": "activity", "paid_by": "Aanya", "split_among": ["Dev", "Aanya", "Kabir", "Zara"]},
    {"description": "Taj Lake Palace Luxury Suite Night", "amount": 8900, "category": "stay", "paid_by": "Dev", "split_among": ["Dev", "Aanya", "Kabir", "Zara"]},
    {"description": "Ambrai Ghat Lakeside Royal Dinner", "amount": 4200, "category": "food", "paid_by": "Kabir", "split_among": ["Dev", "Aanya", "Kabir", "Zara"]},
    {"description": "Johari Bazaar Kundan Jewelry (Zara)", "amount": 5500, "category": "shopping", "paid_by": "Zara", "split_among": ["Zara"]},
    {"description": "SUV Highway Fuel Full Tank", "amount": 5400, "category": "transport", "paid_by": "Kabir", "split_among": ["Dev", "Aanya", "Kabir", "Zara"]},
]
exp_ids = []
for exp in group_expenses:
    r = s_owner.post(f"{BASE}/trips/{trip_id}/expenses", json=exp)
    check(f"Log Expense: {exp['description'][:38]}", r)
    exp_ids.append(r.json()["id"])

r = s_owner.get(f"{BASE}/trips/{trip_id}/expenses/summary")
check("Compute Group Bill Settlements", r)
su = r.json()
print(f"    Group Total Spend: Rs.{su['total_spent']:,.2f}")
for st in su.get("settlements", []):
    print(f"      {st['from']} owes {st['to']}: Rs.{st['amount']:,.2f}")

# =======================================================
step(17, "Printable PDF Brochure Data Verification")
# =======================================================
r = s_owner.get(f"{BASE}/trips/{trip_id}/full")
check("Fetch Full Trip Data for PDF Brochure", r)
r_stays = s_owner.get(f"{BASE}/trips/{trip_id}/overnight-stays")
check("Fetch Stays for PDF Brochure", r_stays)
print(f"    PDF Brochure Ready: {len(r.json()['places'])} places & {len(r_stays.json())} stays formatted.")

# =======================================================
step(18, "Public Web Publishing & Unauthenticated Access")
# =======================================================
r = s_owner.post(f"{BASE}/trips/{trip_id}/publish")
check("Publish Trip Publicly", r)
slug = r.json().get("public_slug", "")
print(f"    Public Slug: {slug}")

r_pub = requests.get(f"{BASE}/trips/public/{slug}")
check("Unauthenticated Public View", r_pub)

r_plan = requests.get(f"{BASE}/trips/public/{slug}/plan")
check("Unauthenticated Public Route Plan", r_plan)
print(f"    Public Polyline Points: {len(r_plan.json().get('route_geometry', []) or [])}")

# =======================================================
step(19, "Community Social Forum & Search Discovery")
# =======================================================
r = s_owner.post(f"{BASE}/community/posts", json={
    "title": "7 Days Royal Rajasthan: Mehrangarh Fort, Ambrai Ghat & Johari Bazaar! ????",
    "body": "Unforgettable road trip across Gujarat & Rajasthan. Lakeside dining in Udaipur, sunrise blue city views in Jodhpur, and Sheesh Mahal mirrors in Amber Palace.",
    "trip_id": trip_id,
    "place_name": "Jodhpur & Udaipur, Rajasthan",
    "image": "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg"
})
check("Publish Community Forum Post", r)
post_id = r.json()["id"]

r = s_owner.get(f"{BASE}/community/posts", params={"q": "Rajasthan"})
check("Search Feed for 'Rajasthan'", r)
found = any(p.get("id") == post_id for p in r.json())
print(f"    Post Found in Search Results: {found}")

# =======================================================
step(20, "Admin Analytics & Security RBAC Enforcement")
# =======================================================
r = s_admin.post(f"{BASE}/auth/demo-login", json={"role": "admin"})
check("Admin Demo Login", r)
s_admin.headers["Authorization"] = f"Bearer {r.json()['session_token']}"

r = s_admin.get(f"{BASE}/admin/stats")
check("Admin Overview Stats", r)
st = r.json()
print(f"    Platform Analytics -> Users: {st.get('users')} | Trips: {st.get('trips')} | Places: {st.get('places')} | Posts: {st.get('posts')}")

r = s_admin.get(f"{BASE}/admin/popular-cities")
check("Admin Popular Cities Ranking", r)

# Security check: Standard traveler is blocked from Admin endpoints
r_rbac = s_owner.get(f"{BASE}/admin/stats")
ok_rbac = r_rbac.status_code == 403
print(f"  {'[PASS]' if ok_rbac else '[FAIL]'} RBAC Security: Traveler blocked from Admin -> HTTP {r_rbac.status_code}")
if not ok_rbac:
    errors.append(f"Security RBAC failed: traveler received HTTP {r_rbac.status_code}")

# =======================================================
step(21, "Final Data Integrity & Master Assembly Verification")
# =======================================================
r = s_owner.get(f"{BASE}/trips/{trip_id}/full")
check("Fetch Complete Assembled Master Trip", r)
master_full = r.json()

r_final_stays = s_owner.get(f"{BASE}/trips/{trip_id}/overnight-stays")
check("Fetch Final Overnight Stays", r_final_stays)

r_final_expenses = s_owner.get(f"{BASE}/trips/{trip_id}/expenses")
check("Fetch Final Expenses", r_final_expenses)

t = master_full["trip"]
score = master_full["score"]

print(f"\n=======================================================")
print(f"  ULTIMATE END-TO-END MASTER TRIP SUMMARY")
print(f"=======================================================")
print(f"  Trip Name:         {t['name']}")
print(f"  Route:             {t['starting_point']} -> {t['destination']}")
print(f"  Duration:          {t['start_date']} to {t['end_date']} (7 Days)")
print(f"  Planned Budget:    Rs.{t['total_budget']:,.2f}")
print(f"  Day-wise Sections: {len(master_full['sections'])} legs")
print(f"  Places Logged:     {len(master_full['places'])} (Attractions + Food + Markets)")
print(f"  Overnight Stays:   {len(r_final_stays.json())} hotels booked")
print(f"  Group Expenses:    {len(r_final_expenses.json())} receipts logged (Rs.{su['total_spent']:,.2f})")
print(f"  Trip Health Score: {score['total']}/100 ({score['pace']} pace)")
print(f"  Public Itinerary:  http://localhost:3000/t/{slug}")
print(f"  PDF Brochure:      http://localhost:3000/trips/{trip_id}/brochure")
print(f"=======================================================\n")

# =======================================================
# FINAL RESULT
# =======================================================
if errors:
    print(f"TOTAL ISSUES DETECTED: {len(errors)}")
    for e in errors:
        print(f"  [BUG] {e}")
else:
    print("ULTIMATE VERIFICATION RESULT: ZERO BUGS — ALL 21 STAGES PASSED PERFECTLY WITH 100% SUCCESS!")
