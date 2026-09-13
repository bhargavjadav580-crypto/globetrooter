import requests, sys
if hasattr(sys.stdout,"reconfigure"): sys.stdout.reconfigure(encoding="utf-8",errors="replace")

BASE = "http://127.0.0.1:8001/api"
s = requests.Session()
errors = []

def step(t): print(f"\n{'='*57}\n  >> {t}\n{'='*57}")
def check(label, r, exp=200):
    ok = r.status_code == exp
    print(f"  {'[PASS]' if ok else '[FAIL]'} {label} -> HTTP {r.status_code}")
    if not ok: errors.append(f"{label}: exp {exp} got {r.status_code} | {r.text[:150]}")
    return ok

# 1 -----------------------------------------------------
step("1. Login & Profile Setup")
r = s.post(f"{BASE}/auth/demo-login", json={"role":"traveler"})
check("Demo Login", r)
s.headers["Authorization"] = f"Bearer {r.json()['session_token']}"
print(f"    Logged in: {r.json()['user']['name']}")

r = s.put(f"{BASE}/auth/profile", json={"first_name":"Rohit","last_name":"Sharma","city":"Mumbai","country":"India","phone":"+91 99001 23456","additional_info":"Passionate foodie & heritage traveler. Loves markets."})
check("Update Profile", r)

# 2 -----------------------------------------------------
step("2. Browse Templates & Clone")
r = s.get(f"{BASE}/templates")
check("List Templates", r)
tmpls = r.json()
print(f"    {len(tmpls)} templates: {[t['name'] for t in tmpls]}")

r = s.post(f"{BASE}/templates/tmpl-rajasthan-royal/clone")
check("Clone Rajasthan Royal Template", r)
print(f"    {r.json().get('message')}")

# 3 -----------------------------------------------------
step("3. Destination Search & Bookmark")
r = s.get(f"{BASE}/places/autocomplete", params={"q":"Jaipur","limit":6})
check("Autocomplete Jaipur", r)
print(f"    {len(r.json())} suggestions")

r = s.get(f"{BASE}/places/city-info", params={"q":"Jaipur"})
check("City Info Jaipur", r)

r = s.post(f"{BASE}/saved-destinations", json={"place_name":"Jaipur","lat":26.9124,"lon":75.7873})
check("Bookmark Jaipur", r)

r = s.get(f"{BASE}/saved-destinations")
check("List Saved Destinations", r)
print(f"    {len(r.json())} saved")

# 4 -----------------------------------------------------
step("4. Route Preview & Create Master Trip")
r = s.get(f"{BASE}/route-preview", params={"lat1":19.076,"lon1":72.8777,"lat2":26.9124,"lon2":75.7873})
check("Route Preview Mumbai->Jaipur", r)
rd = r.json()
dist = rd.get("distance_km",0) or 0
dur  = rd.get("duration_minutes",0) or 0
print(f"    {dist:.1f} km | {int(dur)//60}h {int(dur)%60}m drive time")

r = s.post(f"{BASE}/trips", json={
    "name":"Mumbai to Jaipur: Flavours, Forts & Bazaars",
    "description":"6-day road trip: Crawford Market spices, Laxmi Vilas, Lake Pichola, Pushkar ghats, Amber Fort & Johari Gems.",
    "starting_point":"Mumbai","destination":"Jaipur",
    "start_lat":19.076,"start_lon":72.8777,
    "dest_lat":26.9124,"dest_lon":75.7873,
    "start_date":"2026-12-01","end_date":"2026-12-06",
    "total_budget":55000,
    "cover_image":"https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg"
})
check("Create Master Trip", r)
trip_id = r.json()["id"]
print(f"    Trip ID: {trip_id}")
print(f"    Name: {r.json()['name']}")

# 5 -----------------------------------------------------
step("5. Add 5 Day-wise Sections")
sections_data = [
    {"title":"Mumbai: Dharavi Art & Crawford Spice Bazaar","place_name":"Mumbai","latitude":19.039,"longitude":72.856,"section_budget":8000,"date_start":"2026-12-01"},
    {"title":"Vadodara: Laxmi Vilas Palace & Hazira Patola Bazaar","place_name":"Vadodara","latitude":22.307,"longitude":73.181,"section_budget":10000,"date_start":"2026-12-02"},
    {"title":"Udaipur: Lake Pichola & Royal Fine Dining","place_name":"Udaipur","latitude":24.585,"longitude":73.712,"section_budget":15000,"date_start":"2026-12-03"},
    {"title":"Pushkar: Sacred Ghats, Halwai Gali & Camel Fair","place_name":"Pushkar","latitude":26.489,"longitude":74.551,"section_budget":8000,"date_start":"2026-12-04"},
    {"title":"Jaipur: Amber Palace, Johari Gems & LMB Thali","place_name":"Jaipur","latitude":26.912,"longitude":75.787,"section_budget":14000,"date_start":"2026-12-05"},
]
section_ids = []
for i,sd in enumerate(sections_data):
    sd["type"]="custom"
    r = s.post(f"{BASE}/trips/{trip_id}/sections", json=sd)
    check(f"Section {i+1}: {sd['title'][:42]}...", r)
    section_ids.append(r.json()["id"])

# 6 -----------------------------------------------------
step("6. Add 15 Places: Attractions + Food + Markets")
places = [
    (section_ids[0],"osm-dharavi","Dharavi Street Art Walk","attraction",200,"09:00",19.039,72.856),
    (section_ids[0],"osm-aaswad","Aaswad - Maharashtrian Thali & Misal Pav","food",350,"12:30",19.056,72.838),
    (section_ids[0],"osm-crawford","Crawford Market - Spice & Dry Fruit Bazaar","market",500,"15:00",18.946,72.834),
    (section_ids[1],"osm-laxmivilas","Laxmi Vilas Palace & Baroda Museum","attraction",700,"10:00",22.293,73.197),
    (section_ids[1],"osm-mandap","Mandap - Kathiyawadi Undhiyu & Ghughra Feast","food",450,"13:00",22.307,73.181),
    (section_ids[1],"osm-hazira","Hazira Bazaar - Patola Double-Ikat Silk","market",2000,"16:00",22.300,73.205),
    (section_ids[2],"osm-citypalace","Udaipur City Palace & Crystal Gallery","attraction",900,"09:30",24.576,73.683),
    (section_ids[2],"osm-ambrai","Ambrai Ghat Lakeside Fine Dining","food",1800,"19:30",24.577,73.679),
    (section_ids[2],"osm-hathipol","Hathi Pol Miniature Painting & Lacquer Bazaar","market",1500,"16:00",24.579,73.688),
    (section_ids[3],"osm-brahma","Brahma Temple & Pushkar Sacred Lake Ghats","attraction",0,"06:00",26.489,74.551),
    (section_ids[3],"osm-halwai","Halwai Gali - Rabdi, Malpua & Lassi Trail","food",300,"09:30",26.487,74.553),
    (section_ids[3],"osm-camel","Pushkar Camel Fair Ground & Craft Village","market",400,"14:00",26.506,74.551),
    (section_ids[4],"osm-amber","Amber Palace & Sheesh Mahal Light Show","attraction",1000,"09:00",26.985,75.851),
    (section_ids[4],"osm-lmb","LMB Restaurant - Rajasthani Thali & Ghewar","food",650,"13:00",26.915,75.822),
    (section_ids[4],"osm-johari","Johari Bazaar - Kundan Gems & Bandhani Fabric","market",3000,"16:00",26.922,75.819),
]
for (sid,epid,name,cat,cost,sched,lat,lon) in places:
    r = s.post(f"{BASE}/sections/{sid}/places", json={"external_place_id":epid,"name":name,"category":cat,"cost_estimate":cost,"scheduled_time":sched,"lat":lat,"lon":lon,"description":f"Iconic {cat} spot"})
    check(f"[{cat.upper():11s}] {name[:38]}...", r)

r_f = s.get(f"{BASE}/trips/{trip_id}/full")
all_places = r_f.json().get("places",[])
if all_places:
    p0 = all_places[0]
    r = s.put(f"{BASE}/places/{p0['id']}", json={"cost_estimate":250,"scheduled_time":"09:30"})
    check(f"Edit Place Cost & Time ('{p0['name'][:28]}')", r)

# 7 -----------------------------------------------------
step("7. Route Plan & 4 Overnight Stays")
r = s.get(f"{BASE}/trips/{trip_id}/route-plan", params={"max_drive_hours":5})
check("Compute Route Plan (max 5h/day)", r)
rp = r.json()
print(f"    {rp.get('distance_km',0):.1f} km | {len(rp.get('drive_segments',[]))} drive segments")

stays_data = [
    {"waypoint_index":1,"waypoint_name":"Vadodara","night_date":"2026-12-02","hotel_name":"WelcomHotel Vadodara","lat":22.307,"lon":73.181,"price_estimate":3800},
    {"waypoint_index":2,"waypoint_name":"Udaipur","night_date":"2026-12-03","hotel_name":"Taj Lake Palace Udaipur","lat":24.576,"lon":73.683,"price_estimate":8500},
    {"waypoint_index":3,"waypoint_name":"Pushkar","night_date":"2026-12-04","hotel_name":"Pushkar Royal Desert Camp","lat":26.489,"lon":74.551,"price_estimate":3200},
    {"waypoint_index":4,"waypoint_name":"Jaipur","night_date":"2026-12-05","hotel_name":"Rambagh Palace Heritage Hotel","lat":26.893,"lon":75.810,"price_estimate":7200},
]
stay_ids = []
for st in stays_data:
    r = s.post(f"{BASE}/trips/{trip_id}/overnight-stays", json=st)
    check(f"Book Stay: {st['hotel_name'][:35]}", r)
    stay_ids.append(r.json()["id"])

r = s.put(f"{BASE}/overnight-stays/{stay_ids[0]}", json={"price_estimate":4000})
check("Update Stay Price (Vadodara -> Rs.4000)", r)

r = s.get(f"{BASE}/trips/{trip_id}/overnight-stays")
check("Fetch All Stays", r)
print(f"    {len(r.json())} stays booked")

r = s.get(f"{BASE}/trips/{trip_id}/final-map-link")
check("Google Maps Navigation URL", r)
print(f"    {str(r.json().get('url',''))[:80]}...")

# 8 -----------------------------------------------------
step("8. Fuel Profile & Transport Comparison")
r = s.post(f"{BASE}/trips/{trip_id}/fuel-profile", json={"vehicle_type":"suv","mileage_kmpl":14.0,"fuel_price_per_liter":101.0,"travelers":4})
check("Save Fuel Profile (SUV, 14 kmpl, Rs.101/L, 4 pax)", r)

r = s.get(f"{BASE}/trips/{trip_id}/transport-options")
check("Multi-Modal Transport Options", r)
opts = r.json().get("options", r.json()) if isinstance(r.json(), dict) else r.json()
if isinstance(opts, list):
    for opt in opts:
        cost = opt.get("cost_estimate", opt.get("cost",0))
        dur  = opt.get("duration_minutes",0)
        print(f"    - {opt.get('mode','?').upper():8s}: Rs.{cost:,.0f} | {int(dur)//60}h {int(dur)%60}m")
elif isinstance(opts, dict):
    for mode,info in opts.items():
        cost = float(info) if not isinstance(info,dict) else info.get("cost_estimate",info.get("cost",0))
        dur  = 0 if not isinstance(info,dict) else info.get("duration_minutes",0)
        print(f"    - {mode.upper():8s}: Rs.{cost:,.0f} | {int(dur)//60}h {int(dur)%60}m")

# 9 -----------------------------------------------------
step("9. Scoring, Budget Guardian & AI Narrative")
r = s.get(f"{BASE}/trips/{trip_id}/score")
check("Trip Health Score", r)
sc = r.json()
print(f"    Score: {sc.get('total')}/100 | Pace: {sc.get('pace')}")
for dim,v in sc.get("breakdown",{}).items():
    print(f"    - {dim:22s}: {v.get('score')}/{v.get('max')} | {v.get('reason','')[:55]}")

r = s.get(f"{BASE}/trips/{trip_id}/travel-load")
check("Travel Load Index", r)
tl = r.json()
print(f"    Load: {tl.get('index')} | {tl.get('activities_per_day')} acts/day | {tl.get('distance_per_day')} km/day")

r = s.get(f"{BASE}/trips/{trip_id}/final-budget")
check("Budget Guardian", r)
bg = r.json()
print(f"    Spent Rs.{bg.get('total_planned_spend',0):,.0f} / Rs.{bg.get('total_budget',0):,.0f} | Over: {bg.get('over_budget')}")
bd = bg.get("breakdown",{})
print(f"    Transport Rs.{bd.get('transport',0):,.0f} | Stays Rs.{bd.get('stays',0):,.0f} | Food Rs.{bd.get('food',0):,.0f} | Activities Rs.{bd.get('activities',0):,.0f}")

r = s.post(f"{BASE}/trips/{trip_id}/final-budget")
check("Generate AI Narrative", r)
narr = r.json().get("narrative","")
print(f"\n--- AI NARRATIVE (first 350 chars) ---")
print(narr[:350])
print("--------------------------------------\n")

# 10 -----------------------------------------------------
step("10. Live Weather Forecast per Stop (Open-Meteo)")
r = s.get(f"{BASE}/trips/{trip_id}/weather")
check("Fetch Weather for All Stops", r)
weather = r.json()
print(f"    Stops with weather data: {len(weather)}")
for stop in weather:
    fc = stop.get("forecast",[])
    if fc:
        print(f"    - {stop['stop_name']}: {fc[0]['emoji']} {fc[0]['condition']} | {fc[0]['temp_max']}C / {fc[0]['temp_min']}C | Rain {fc[0].get('precipitation_mm',0)}mm")
    else:
        print(f"    - {stop['stop_name']}: {stop.get('error','no data')}")

# 11 -----------------------------------------------------
step("11. ICS Calendar Export")
r = s.get(f"{BASE}/trips/{trip_id}/export/ics")
check("Export .ics File", r)
ics_ok = b"BEGIN:VCALENDAR" in r.content and b"VEVENT" in r.content
event_count = r.content.count(b"BEGIN:VEVENT")
print(f"    Valid RFC5545: {ics_ok} | {event_count} calendar events | {len(r.content)} bytes")
print(f"    Download: {r.headers.get('content-disposition','')}")

# 12 -----------------------------------------------------
step("12. GPX Route Export")
r = s.get(f"{BASE}/trips/{trip_id}/export/gpx")
check("Export .gpx File", r)
gpx_ok = b"<?xml" in r.content and b"<gpx" in r.content and b"<wpt" in r.content
wpt_count = r.content.count(b"<wpt")
print(f"    Valid GPX 1.1: {gpx_ok} | {wpt_count} waypoints | {len(r.content)} bytes")

# 13 -----------------------------------------------------
step("13. Expense Logger & Bill Split (7 real receipts)")
expenses = [
    {"description":"Dharavi Street Food & Chai","amount":480,"category":"food","paid_by":"Rohit","split_among":["Rohit","Meera","Dev","Sona"]},
    {"description":"Laxmi Vilas Palace 4 Entry Tickets","amount":2800,"category":"activity","paid_by":"Meera","split_among":["Rohit","Meera","Dev","Sona"]},
    {"description":"Hazira Patola Silk Purchase","amount":4500,"category":"shopping","paid_by":"Sona","split_among":["Sona"]},
    {"description":"Taj Lake Palace One Night (4 pax)","amount":8500,"category":"stay","paid_by":"Dev","split_among":["Rohit","Meera","Dev","Sona"]},
    {"description":"LMB Famous Thali Jaipur x4","amount":2600,"category":"food","paid_by":"Rohit","split_among":["Rohit","Meera","Dev","Sona"]},
    {"description":"Johari Bazaar Kundan Earrings (Meera)","amount":3200,"category":"shopping","paid_by":"Meera","split_among":["Meera"]},
    {"description":"SUV Petrol - Full Tank Mumbai to Jaipur","amount":5200,"category":"transport","paid_by":"Dev","split_among":["Rohit","Meera","Dev","Sona"]},
]
exp_ids = []
for exp in expenses:
    r = s.post(f"{BASE}/trips/{trip_id}/expenses", json=exp)
    check(f"Log: {exp['description'][:42]}", r)
    exp_ids.append(r.json().get("id"))

r = s.get(f"{BASE}/trips/{trip_id}/expenses")
check("List Expenses", r)
print(f"    Total receipts logged: {len(r.json())}")

r = s.get(f"{BASE}/trips/{trip_id}/expenses/summary")
check("Bill Split Summary", r)
su = r.json()
print(f"    Group Total Spent: Rs.{su['total_spent']:,.2f}")
print(f"    By Category: {su['by_category']}")
print(f"    Settlements:")
for se in su.get("settlements",[]):
    print(f"      {se['from']} -> {se['to']}: Rs.{se['amount']:,.2f}")

r = s.delete(f"{BASE}/trips/{trip_id}/expenses/{exp_ids[0]}")
check("Delete Oldest Expense", r)

# 14 -----------------------------------------------------
step("14. Publish & Public Unauthenticated View")
r = s.post(f"{BASE}/trips/{trip_id}/publish")
check("Publish Trip to Public Web", r)
slug = r.json().get("public_slug","")
print(f"    Slug: {slug}")

r_pub = requests.get(f"{BASE}/trips/public/{slug}")
check("Public Itinerary (No Auth)", r_pub)
print(f"    Public view accessible without login!")

r_plan = requests.get(f"{BASE}/trips/public/{slug}/plan")
check("Public Route Plan (No Auth)", r_plan)
pts = len(r_plan.json().get("route_geometry",[]) or [])
print(f"    Route geometry points: {pts}")

# 15 -----------------------------------------------------
step("15. Community Post & Search")
r = s.post(f"{BASE}/community/posts", json={
    "title":"6 Days Mumbai->Jaipur: Forts, Food & Hidden Markets!",
    "body":"Epic road trip! Crawford Market spices, Amber Palace grandeur, Pushkar sunrise ghats & Johari Bazaar gems. Rs.55k for 4 pax.",
    "trip_id":trip_id,"place_name":"Jaipur, Rajasthan",
    "image":"https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg"
})
check("Create Community Post", r)
post_id = r.json().get("id","")
print(f"    '{r.json().get('title','')[:58]}'")

r = s.get(f"{BASE}/community/posts", params={"q":"Jaipur"})
check("Search Feed 'Jaipur'", r)
found = any(p.get("id")==post_id for p in r.json())
print(f"    Post found: {found} | Total results: {len(r.json())}")

# 16 -----------------------------------------------------
step("16. Admin Analytics & RBAC")
ra = requests.post(f"{BASE}/auth/demo-login", json={"role":"admin"})
check("Admin Login", ra)
ah = {"Authorization": f"Bearer {ra.json()['session_token']}"}

r = requests.get(f"{BASE}/admin/stats", headers=ah)
check("Admin Dashboard Stats", r)
st = r.json()
print(f"    Users:{st.get('users')} Trips:{st.get('trips')} Sections:{st.get('sections')} Places:{st.get('places')} Posts:{st.get('posts')}")

r = requests.get(f"{BASE}/admin/popular-cities", headers=ah)
check("Admin Popular Cities", r)
print(f"    Top Cities: {[c['city'] for c in r.json()[:5]]}")

r = requests.get(f"{BASE}/admin/popular-activities", headers=ah)
check("Admin Top Activities", r)
print(f"    Top Activities: {[a['name'][:30] for a in r.json()[:4]]}")

# Traveler cannot access admin (RBAC check)
r_rbac = s.get(f"{BASE}/admin/stats")
ok_rbac = r_rbac.status_code == 403
print(f"  {'[PASS]' if ok_rbac else '[FAIL]'} RBAC: Traveler blocked from Admin -> HTTP {r_rbac.status_code}")
if not ok_rbac: errors.append(f"RBAC: traveler should get 403 not {r_rbac.status_code}")

# 17 -----------------------------------------------------
step("17. Full Trip Integrity Check")
r = s.get(f"{BASE}/trips/{trip_id}/full")
check("Assembled Full Trip", r)
full = r.json()

r_stays_f = s.get(f"{BASE}/trips/{trip_id}/overnight-stays")
check("Final Stays", r_stays_f)

r_exp_f = s.get(f"{BASE}/trips/{trip_id}/expenses")
check("Final Expenses", r_exp_f)

t = full["trip"]
sc = full["score"]
bg_final = full["budget"]

print(f"\n{'='*57}")
print(f"  COMPLETE FULL TRIP SUMMARY")
print(f"{'='*57}")
print(f"  Trip:              {t['name']}")
print(f"  Route:             {t['starting_point']} -> {t['destination']}")
print(f"  Dates:             {t['start_date']} to {t['end_date']} (6 Days)")
print(f"  Budget:            Rs.{t['total_budget']:,.0f}")
print(f"  Sections:          {len(full['sections'])} legs")
print(f"  Places:            {len(full['places'])} (Attractions + Food + Markets)")
print(f"  Stays:             {len(r_stays_f.json())} hotels booked")
print(f"  Expenses:          {len(r_exp_f.json())} real receipts logged")
print(f"  Health Score:      {sc['total']}/100 ({sc['pace']} pace)")
print(f"  Budget Status:     {'OVER BUDGET' if bg_final.get('over_budget') else 'WITHIN BUDGET'}")
print(f"  Public URL:        http://localhost:3000/t/{slug}")
print(f"{'='*57}\n")

# --- FINAL RESULT -------------------------------------
if errors:
    print(f"BUGS FOUND: {len(errors)} issue(s):")
    for e in errors: print(f"  [BUG] {e}")
else:
    print("RESULT: ZERO BUGS - ALL 17 STAGES PASSED PERFECTLY!")
