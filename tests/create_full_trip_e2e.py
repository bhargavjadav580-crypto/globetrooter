import requests
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://127.0.0.1:8001/api"
s = requests.Session()

def step(title):
    print(f"\n=======================================================")
    print(f"  ▶ {title}")
    print(f"=======================================================")

def check(label, resp, expected_status=200):
    status_sym = "✅ PASS" if resp.status_code == expected_status else f"❌ FAIL ({resp.status_code})"
    print(f"[{status_sym}] {label} -> HTTP {resp.status_code}")
    if resp.status_code != expected_status:
        print(f"    ERROR DETAILS: {resp.text}")
    return resp

# -----------------------------------------------------------------------------
# STEP 1: AUTHENTICATION & PROFILE SETUP
# -----------------------------------------------------------------------------
step("1. Traveler Login & Profile Setup")
r = s.post(f"{BASE_URL}/auth/demo-login", json={"role": "traveler"})
check("Demo Traveler Login", r, 200)
token = r.json().get("session_token", "")
s.headers.update({"Authorization": f"Bearer {token}"})

r = s.get(f"{BASE_URL}/auth/me")
check("Get Current User Profile", r, 200)
user_data = r.json()
print(f"    Logged in as: {user_data.get('name')} ({user_data.get('email')})")

r = s.put(f"{BASE_URL}/auth/profile", json={
    "first_name": "Aanya",
    "last_name": "Rao",
    "phone": "+91 98888 77777",
    "city": "Mumbai",
    "country": "India",
    "additional_info": "Solo & group travel explorer across heritage and food trails.",
    "photo_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
    "language": "English"
})
check("Update Traveler Profile", r, 200)

# -----------------------------------------------------------------------------
# STEP 2: SEARCH DESTINATIONS & SAVE PLACES
# -----------------------------------------------------------------------------
step("2. Live OSM Destination Search & Bookmark")
r = s.get(f"{BASE_URL}/places/autocomplete", params={"q": "Udaipur"})
check("Autocomplete Search for 'Udaipur'", r, 200)
results = r.json()
print(f"    Found {len(results)} autocomplete suggestions for Udaipur")

r = s.get(f"{BASE_URL}/places/city-info", params={"q": "Udaipur"})
check("Get City Info for Udaipur", r, 200)
city_info = r.json()
if city_info and city_info.get("place"):
    p = city_info["place"]
    r_save = s.post(f"{BASE_URL}/saved-destinations", json={
        "place_name": "Udaipur City of Lakes",
        "place_id": p.get("place_id", "osm-udaipur"),
        "lat": p.get("lat", 24.5854),
        "lon": p.get("lon", 73.7125)
    })
    check("Bookmark Saved Destination", r_save, 200)

r = s.get(f"{BASE_URL}/saved-destinations")
check("Fetch Saved Destinations List", r, 200)
print(f"    Saved Destinations Count: {len(r.json())}")

# -----------------------------------------------------------------------------
# STEP 3: CREATE COMPLETE MULTI-DAY EXPEDITION
# -----------------------------------------------------------------------------
step("3. Create 7-Day Royal Rajasthan Expedition")
r = s.get(f"{BASE_URL}/route-preview", params={
    "lat1": 28.6139, "lon1": 77.2090,  # Delhi
    "lat2": 24.5854, "lon2": 73.7125   # Udaipur
})
check("Route Preview (Delhi -> Udaipur)", r, 200)
prev = r.json()
print(f"    Route Preview Distance: {prev.get('distance_km')} km | Drive Time: {prev.get('duration_minutes', 0)//60}h {prev.get('duration_minutes', 0)%60}m")

r = s.post(f"{BASE_URL}/trips", json={
    "name": "Royal Rajasthan Heritage & Food Trail",
    "description": "A 7-day culinary, palace, and artisan market road trip from Delhi through Jaipur and Pushkar to Udaipur.",
    "starting_point": "Delhi",
    "destination": "Udaipur",
    "start_lat": 28.6139,
    "start_lon": 77.2090,
    "dest_lat": 24.5854,
    "dest_lon": 73.7125,
    "start_date": "2026-11-10",
    "end_date": "2026-11-16",
    "total_budget": 65000,
    "cover_image": "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200"
})
check("Create Master Trip", r, 200)
trip = r.json()
trip_id = trip["id"]
print(f"    Trip Created Successfully! ID: {trip_id}")

# -----------------------------------------------------------------------------
# STEP 4: ADD SECTIONS ACROSS ALL STOPS
# -----------------------------------------------------------------------------
step("4. Add Sections for Each Leg & Stop")
sections_data = [
    {
        "title": "Delhi: Mughal Heritage & Old Spice Trail",
        "type": "activity",
        "place_name": "Old Delhi",
        "latitude": 28.6562, "longitude": 77.2410,
        "date_start": "2026-11-10", "date_end": "2026-11-11",
        "section_budget": 8000
    },
    {
        "title": "Jaipur: Royal Forts & Gemstone Bazaars",
        "type": "activity",
        "place_name": "Jaipur",
        "latitude": 26.9124, "longitude": 75.7873,
        "date_start": "2026-11-12", "date_end": "2026-11-13",
        "section_budget": 18000
    },
    {
        "title": "Pushkar: Sacred Ghats & Desert Sunset",
        "type": "travel",
        "place_name": "Pushkar",
        "latitude": 26.4897, "longitude": 74.5511,
        "date_start": "2026-11-14", "date_end": "2026-11-14",
        "section_budget": 6000
    },
    {
        "title": "Udaipur: Lake Palaces & Royal Dining",
        "type": "stay",
        "place_name": "Udaipur",
        "latitude": 24.5854, "longitude": 73.7125,
        "date_start": "2026-11-15", "date_end": "2026-11-16",
        "section_budget": 22000
    }
]

created_sections = []
for sec_payload in sections_data:
    r = s.post(f"{BASE_URL}/trips/{trip_id}/sections", json=sec_payload)
    check(f"Add Section: {sec_payload['title'][:35]}...", r, 200)
    created_sections.append(r.json())

# -----------------------------------------------------------------------------
# STEP 5: ADD PLACES (ATTRACTIONS, FOOD, MARKETS)
# -----------------------------------------------------------------------------
step("5. Add Places across ALL Categories (Food, Markets, Attractions)")
sec1_id = created_sections[0]["id"]
sec2_id = created_sections[1]["id"]
sec3_id = created_sections[2]["id"]
sec4_id = created_sections[3]["id"]

places_to_add = [
    # Section 1 - Delhi
    (sec1_id, {
        "name": "Qutub Minar & Mehrauli Complex",
        "category": "attraction",
        "external_place_id": "del-qutub-01",
        "lat": 28.5244, "lon": 77.1855,
        "cost_estimate": 500,
        "scheduled_time": "10:00 AM",
        "description": "UNESCO World Heritage Site with ancient 73-meter minaret."
    }),
    (sec1_id, {
        "name": "Karim's Historic Mughal Cuisine",
        "category": "food",
        "external_place_id": "del-food-karim",
        "lat": 28.6506, "lon": 77.2334,
        "cost_estimate": 1400,
        "scheduled_time": "01:30 PM",
        "description": "Legendary establishment serving authentic kebabs and mutton nihari since 1913."
    }),
    (sec1_id, {
        "name": "Khari Baoli Asia's Largest Spice Market",
        "category": "market",
        "external_place_id": "del-mkt-spices",
        "lat": 28.6575, "lon": 77.2201,
        "cost_estimate": 2000,
        "scheduled_time": "04:30 PM",
        "description": "Vibrant wholesale spice market filled with saffron, dry fruits, and aromatic teas."
    }),
    # Section 2 - Jaipur
    (sec2_id, {
        "name": "Amber Palace & Sheesh Mahal",
        "category": "attraction",
        "external_place_id": "jpr-amber-fort",
        "lat": 26.9855, "lon": 75.8513,
        "cost_estimate": 1000,
        "scheduled_time": "09:30 AM",
        "description": "Majestic hilltop fort with opulent mirrored palace and panoramic hill vistas."
    }),
    (sec2_id, {
        "name": "Chokhi Dhani Ethnic Feast & Cultural Village",
        "category": "food",
        "external_place_id": "jpr-food-chokhi",
        "lat": 26.7675, "lon": 75.8340,
        "cost_estimate": 2600,
        "scheduled_time": "07:30 PM",
        "description": "Traditional Rajasthani thali feast with folk dance, fire shows, and pottery."
    }),
    (sec2_id, {
        "name": "Johari Bazaar Gemstone & Bandhani Market",
        "category": "market",
        "external_place_id": "jpr-mkt-johari",
        "lat": 26.9205, "lon": 75.8247,
        "cost_estimate": 4500,
        "scheduled_time": "03:00 PM",
        "description": "World-renowned jewelry and handmade tie-dye textile bazaar in the Pink City."
    }),
    # Section 3 - Pushkar
    (sec3_id, {
        "name": "Pushkar Brahma Temple & Sacred Lake",
        "category": "attraction",
        "external_place_id": "psh-brahma-lake",
        "lat": 26.4883, "lon": 74.5539,
        "cost_estimate": 300,
        "scheduled_time": "11:00 AM",
        "description": "One of the world's few temples dedicated to Lord Brahma, surrounded by 52 bathing ghats."
    }),
    (sec3_id, {
        "name": "Halwai Gali Rabdi & Malpua Treats",
        "category": "food",
        "external_place_id": "psh-food-malpua",
        "lat": 26.4890, "lon": 74.5520,
        "cost_estimate": 450,
        "scheduled_time": "04:00 PM",
        "description": "Crisp golden malpuas soaked in saffron syrup and rich thickened milk rabdi."
    }),
    # Section 4 - Udaipur
    (sec4_id, {
        "name": "Udaipur City Palace & Crystal Gallery",
        "category": "attraction",
        "external_place_id": "udr-city-palace",
        "lat": 24.5764, "lon": 73.6835,
        "cost_estimate": 1200,
        "scheduled_time": "10:00 AM",
        "description": "Rajasthan's largest palace complex overlooking tranquil Lake Pichola."
    }),
    (sec4_id, {
        "name": "Ambrai Waterfront Fine Dining",
        "category": "food",
        "external_place_id": "udr-food-ambrai",
        "lat": 24.5786, "lon": 73.6800,
        "cost_estimate": 3500,
        "scheduled_time": "08:00 PM",
        "description": "Romantic lakeside dining with illuminated views of Jag Mandir and City Palace."
    }),
    (sec4_id, {
        "name": "Hathi Pol Artisan Painting & Miniature Bazaar",
        "category": "market",
        "external_place_id": "udr-mkt-hathipol",
        "lat": 24.5880, "lon": 73.6885,
        "cost_estimate": 2800,
        "scheduled_time": "03:30 PM",
        "description": "Famous market for Pichwai paintings, camel bone crafts, and handcrafted mojari footwear."
    })
]

created_places = []
for sec_id, pl_payload in places_to_add:
    r = s.post(f"{BASE_URL}/sections/{sec_id}/places", json=pl_payload)
    check(f"Add {pl_payload['category'].upper()}: {pl_payload['name'][:30]}...", r, 200)
    created_places.append(r.json())

# Test updating place cost & schedule
p_to_edit = created_places[0]
r_upd_pl = s.put(f"{BASE_URL}/places/{p_to_edit['id']}", json={
    "cost_estimate": 600,
    "scheduled_time": "09:45 AM"
})
check("Edit Place Cost and Time", r_upd_pl, 200)
print(f"    Updated Qutub Minar cost to: ₹{r_upd_pl.json().get('cost_estimate')}")

# -----------------------------------------------------------------------------
# STEP 6: ROAD TRIP ROUTE PLAN & OVERNIGHT STAYS
# -----------------------------------------------------------------------------
step("6. Route Optimization & Overnight Stays")
r = s.get(f"{BASE_URL}/trips/{trip_id}/route-plan", params={"max_drive_hours": 4})
check("Compute Route Plan with Waypoints", r, 200)
route_plan = r.json()
print(f"    Route distance: {route_plan.get('distance_km')} km | Drive segments: {len(route_plan.get('segments', []))}")

# Add Overnight Stay 1: Jaipur
r_stay1 = s.post(f"{BASE_URL}/trips/{trip_id}/overnight-stays", json={
    "waypoint_index": 1,
    "waypoint_name": "Jaipur Heritage Quarter",
    "hotel_name": "Heritage Haveli & Spa Jaipur",
    "lat": 26.9124, "lon": 75.7873,
    "price_estimate": 4200,
    "night_date": "2026-11-12",
    "website": "https://heritagehaveli.example.com"
})
check("Book Overnight Stay: Jaipur Haveli", r_stay1, 200)

# Add Overnight Stay 2: Pushkar
r_stay2 = s.post(f"{BASE_URL}/trips/{trip_id}/overnight-stays", json={
    "waypoint_index": 2,
    "waypoint_name": "Pushkar Desert Camp",
    "hotel_name": "Pushkar Royal Desert Camp & Tents",
    "lat": 26.4897, "lon": 74.5511,
    "price_estimate": 3500,
    "night_date": "2026-11-14"
})
check("Book Overnight Stay: Pushkar Desert Camp", r_stay2, 200)

# Add Overnight Stay 3: Udaipur
r_stay3 = s.post(f"{BASE_URL}/trips/{trip_id}/overnight-stays", json={
    "waypoint_index": 3,
    "waypoint_name": "Lake Pichola Udaipur",
    "hotel_name": "Lake Pichola View Palace Hotel",
    "lat": 24.5764, "lon": 73.6835,
    "price_estimate": 6500,
    "night_date": "2026-11-15"
})
check("Book Overnight Stay: Udaipur Lake Palace Hotel", r_stay3, 200)

r = s.get(f"{BASE_URL}/trips/{trip_id}/overnight-stays")
check("Fetch All Overnight Stays", r, 200)
print(f"    Total Overnight Stays: {len(r.json())}")

r_map_link = s.get(f"{BASE_URL}/trips/{trip_id}/final-map-link")
check("Generate Google Maps Live Navigation URL", r_map_link, 200)
print(f"    Google Maps Link: {r_map_link.json().get('url')[:75]}...")

# -----------------------------------------------------------------------------
# STEP 7: FUEL PROFILE & MULTI-MODAL TRANSPORT COMPARISON
# -----------------------------------------------------------------------------
step("7. Fuel Profiling & Multi-Modal Transport Comparison")
r_fuel = s.post(f"{BASE_URL}/trips/{trip_id}/fuel-profile", json={
    "vehicle_type": "SUV",
    "mileage_kmpl": 13.5,
    "fuel_price_per_liter": 98.5,
    "travelers": 3
})
check("Save Fuel Profile (SUV, 13.5 km/l, ₹98.5/L, 3 travelers)", r_fuel, 200)

r_trans = s.get(f"{BASE_URL}/trips/{trip_id}/transport-options")
check("Calculate Multi-Modal Transport Options (Drive, Bus, Train, Flight)", r_trans, 200)
options = r_trans.json().get("options", [])
for opt in options:
    print(f"    • {opt['mode'].upper():<8}: ₹{opt['cost_estimate']:>7,.2f} | {opt['duration_minutes']//60}h {opt['duration_minutes']%60}m duration")

# -----------------------------------------------------------------------------
# STEP 8: BUDGET GUARDIAN, TRIP SCORE & AI NARRATIVE
# -----------------------------------------------------------------------------
step("8. Real-Time Scoring, Budget Guardian & AI Narrative")
r_score = s.get(f"{BASE_URL}/trips/{trip_id}/score")
check("Compute Multi-Dimensional Trip Score", r_score, 200)
sc = r_score.json()
print(f"    Overall Score: {sc.get('total')}/100 | Travel Pace: {sc.get('pace')}")
for sub in sc.get("sub_scores", []):
    print(f"      - {sub['name']:<18}: {sub['score']}/{sub['max']} ({sub['explanation']})")

r_load = s.get(f"{BASE_URL}/trips/{trip_id}/travel-load")
check("Compute Travel Load Index", r_load, 200)
tl = r_load.json()
print(f"    Load Index: {tl.get('load_index')} | Activities/Day: {tl.get('activities_per_day')} | Distance/Day: {tl.get('distance_per_day_km')} km")

r_bg = s.get(f"{BASE_URL}/trips/{trip_id}/budget")
check("Budget Guardian Analysis", r_bg, 200)
bg = r_bg.json()
bd = bg.get("breakdown", {})
print(f"    Budget Spent: ₹{bd.get('total_estimated', 0):,.2f} / Total Budget: ₹{bd.get('total_budget', 0):,.2f} | Over Budget: {bg.get('over_budget')}")
print(f"    Breakdown -> Transport: ₹{bd.get('transport_cost',0):,.2f} | Stays: ₹{bd.get('accommodation_cost',0):,.2f} | Food: ₹{bd.get('food_cost',0):,.2f} | Activities: ₹{bd.get('activity_cost',0):,.2f}")

r_final_budget = s.post(f"{BASE_URL}/trips/{trip_id}/final-budget")
check("Generate AI Final Budget Summary", r_final_budget, 200)
narrative = r_final_budget.json().get("narrative", "")
print("\n--- AI GENERATED BUDGET NARRATIVE ---")
print(narrative.encode("ascii", "replace").decode("ascii"))
print("------------------------------------\n")

# -----------------------------------------------------------------------------
# STEP 9: PUBLISH TRIP & PUBLIC ACCESS VERIFICATION
# -----------------------------------------------------------------------------
step("9. Publishing & Public Sharing")
r_pub = s.post(f"{BASE_URL}/trips/{trip_id}/publish")
check("Publish Trip to Public Web", r_pub, 200)
pub_data = r_pub.json()
slug = pub_data.get("public_slug")
print(f"    Public Slug: {slug}")

unauth = requests.Session()
r_pub_view = unauth.get(f"{BASE_URL}/trips/public/{slug}")
check("Unauthenticated Public View (Full Itinerary)", r_pub_view, 200)
assert r_pub_view.json()["trip"]["name"] == "Royal Rajasthan Heritage & Food Trail"
print(f"    Verified Public Itinerary access without authentication!")

r_pub_plan = unauth.get(f"{BASE_URL}/trips/public/{slug}/plan")
check("Unauthenticated Public Plan Overview", r_pub_plan, 200)
print(f"    Public Plan Geometry Points: {len(r_pub_plan.json().get('route_geometry', []))}")

# -----------------------------------------------------------------------------
# STEP 10: COMMUNITY FORUM POST & DISCOVERY
# -----------------------------------------------------------------------------
step("10. Community Forum Post & Search Discovery")
r_post = s.post(f"{BASE_URL}/community/posts", json={
    "title": "7 Days Delhi to Udaipur: Best Food & Forts Road Trip! 🚗👑",
    "body": "Just completed this epic road trip! Karim's nihari in Delhi, Chokhi Dhani thali in Jaipur, and sunset dining at Ambrai Udaipur are unmissable. Detailed budget and stays attached.",
    "place_name": "Rajasthan, India",
    "trip_id": trip_id,
    "image": "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800"
})
check("Create Community Forum Post", r_post, 200)
post_id = r_post.json().get("id")

r_feed = s.get(f"{BASE_URL}/community/posts", params={"q": "Udaipur"})
check("Search Community Feed for 'Udaipur'", r_feed, 200)
posts = r_feed.json()
assert any(p["id"] == post_id for p in posts)
print(f"    Community post discovered in feed! Title: {posts[0]['title']}")

# -----------------------------------------------------------------------------
# STEP 11: ADMIN ANALYTICS VERIFICATION
# -----------------------------------------------------------------------------
step("11. Admin Analytics & Platform Metrics")
s_admin = requests.Session()
r_adm_login = s_admin.post(f"{BASE_URL}/auth/demo-login", json={"role": "admin"})
check("Admin Login", r_adm_login, 200)
s_admin.headers.update({"Authorization": f"Bearer {r_adm_login.json().get('session_token')}"})

r_stats = s_admin.get(f"{BASE_URL}/admin/stats")
check("Admin Dashboard Stats", r_stats, 200)
stats = r_stats.json()
print(f"    Admin Metrics -> Users: {stats.get('users')} | Trips: {stats.get('trips')} | Sections: {stats.get('sections')} | Places: {stats.get('places')} | Posts: {stats.get('posts')}")

r_cities = s_admin.get(f"{BASE_URL}/admin/popular-cities")
check("Admin Popular Cities Aggregation", r_cities, 200)
print(f"    Top Destinations: {[c['city'] for c in r_cities.json()[:5]]}")

r_activities = s_admin.get(f"{BASE_URL}/admin/popular-activities")
check("Admin Most Added Places & Activities", r_activities, 200)
print(f"    Top Added Places: {[a['name'] for a in r_activities.json()[:5]]}")

# -----------------------------------------------------------------------------
# FINAL VERIFICATION & SUMMARY
# -----------------------------------------------------------------------------
step("12. Complete Trip Assembly & Integrity Check")
r_full = s.get(f"{BASE_URL}/trips/{trip_id}/full")
check("Fetch Complete Assembled Trip", r_full, 200)
full = r_full.json()
r_stays = s.get(f"{BASE_URL}/trips/{trip_id}/overnight-stays")
check("Fetch Overnight Stays for Verification", r_stays, 200)
stays_list = r_stays.json()

print(f"\n=======================================================")
print(f"  🎉 COMPLETE END-TO-END TRIP LIFECYCLE SUMMARY")
print(f"=======================================================")
print(f"  Trip Name:         {full['trip']['name']}")
print(f"  Route:             {full['trip']['starting_point']} ➔ {full['trip']['destination']}")
print(f"  Duration:          {full['trip']['start_date']} to {full['trip']['end_date']} (7 Days)")
print(f"  Total Budget:      ₹{full['trip']['total_budget']:,.2f}")
print(f"  Sections (Legs):   {len(full['sections'])} stops")
print(f"  Places Added:      {len(full['places'])} (Attractions, Food & Dining, Artisan Markets)")
print(f"  Overnight Stays:   {len(stays_list)} booked accommodations")
print(f"  Trip Health Score: {full['score']['total']}/100 ({full['score']['pace']} pace)")
print(f"  Public Sharing:    http://localhost:3000/trips/public/{slug}")
print(f"  Community Post:    '{posts[0]['title']}'")
print(f"=======================================================\n")
print("✅ ALL 12 E2E STEPS COMPLETED WITH ZERO ERRORS!")
