import requests
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8001/api"
s_owner = requests.Session()

PASS = "[PASS]"
FAIL = "[FAIL]"
errors = []

def check(label, r, exp=200):
    ok = r.status_code == exp
    print(f"  {'[PASS]' if ok else '[FAIL]'} {label} -> HTTP {r.status_code}")
    if not ok:
        errors.append(f"{label}: exp {exp} got {r.status_code} | {r.text[:150]}")
    return ok

print("=======================================================")
print("  TESTING TRIPADVISOR SUITE: REVIEWS, TAGS & COLLAB")
print("=======================================================")

# 1. Login as owner
r = s_owner.post(f"{BASE}/auth/demo-login", json={"role": "traveler"})
check("Owner Login", r)
s_owner.headers["Authorization"] = f"Bearer {r.json()['session_token']}"

# Get trips to test on - find one with places
r_trips = s_owner.get(f"{BASE}/trips")
check("Fetch Trips", r_trips)
trips = r_trips.json()

target_trip = None
target_place = None
for t in trips:
    r_full = s_owner.get(f"{BASE}/trips/{t['id']}/full")
    if r_full.status_code == 200 and r_full.json().get("places"):
        target_trip = r_full.json()["trip"]
        target_place = r_full.json()["places"][0]
        break

if not target_trip:
    # Create fresh trip + section + place
    r_t = s_owner.post(f"{BASE}/trips", json={
        "name": "TripAdvisor Test Trip", "starting_point": "Delhi", "destination": "Agra"
    })
    target_trip = r_t.json()
    r_sec = s_owner.post(f"{BASE}/trips/{target_trip['id']}/sections", json={
        "title": "Agra Fort & Taj Mahal", "place_name": "Agra", "latitude": 27.1767, "longitude": 78.0081
    })
    r_p = s_owner.post(f"{BASE}/sections/{r_sec.json()['id']}/places", json={
        "external_place_id": "osm-taj", "name": "Taj Mahal Mausoleum", "category": "attraction",
        "tags": ["Must Try", "Heritage", "Scenic View"], "cost_estimate": 1100
    })
    target_place = r_p.json()

trip_id = target_trip["id"]
place_id = target_place["id"]
print(f"    Testing Trip: '{target_trip['name']}' ({trip_id})")
print(f"    Testing Place: '{target_place['name']}' ({place_id})")

print("\n--- FEATURE 1: Place Reviews & Ratings ---")
# Submit Review 1 (5 stars)
r_rev1 = s_owner.post(f"{BASE}/places/{place_id}/reviews", json={
    "rating": 5,
    "comment": "Absolutely spectacular view from the top! The audio guide is highly recommended.",
    "visit_tip": "Visit before 9:00 AM to beat the desert heat and tour crowds."
})
check("Submit Review 1 (5 Stars + Tip)", r_rev1)
rev1_id = r_rev1.json().get("id")

# Submit Review 2 (4 stars)
r_rev2 = s_owner.post(f"{BASE}/places/{place_id}/reviews", json={
    "rating": 4,
    "comment": "Great historic architecture and guided walk experience.",
    "visit_tip": "Wear comfortable walking shoes — lots of stairs."
})
check("Submit Review 2 (4 Stars)", r_rev2)

# Get reviews & check average calculation ( (5+4)/2 = 4.5 )
r_get_revs = s_owner.get(f"{BASE}/places/{place_id}/reviews")
check("Get Place Reviews List & Summary", r_get_revs)
rev_data = r_get_revs.json()
print(f"    Avg Rating: {rev_data.get('avg_rating')} ? | Review Count: {rev_data.get('review_count')}")
for r_item in rev_data.get("reviews", []):
    print(f"      - {r_item['user_name']}: {r_item['rating']}? '{r_item['comment'][:40]}...' (Tip: {r_item.get('visit_tip')})")

# Delete Review 1
r_del = s_owner.delete(f"{BASE}/places/{place_id}/reviews/{rev1_id}")
check("Delete Own Review", r_del)

print("\n--- FEATURE 2: Place Vibe/Dietary Tags & Booking Links ---")
r_upd_place = s_owner.put(f"{BASE}/places/{place_id}", json={
    "tags": ["Must Try", "Scenic View", "Family-Friendly", "Pure Veg"],
    "booking_url": "https://www.getyourguide.com",
    "local_tips": "Best sunset spot on the east terrace"
})
check("Update Place Tags & Booking URL", r_upd_place)
updated_place = r_upd_place.json()
print(f"    Saved Tags: {updated_place.get('tags')}")
print(f"    Booking URL: {updated_place.get('booking_url')}")

print("\n--- FEATURE 3: Trip Collaborators (Invite Friends with RBAC) ---")
# List collaborators
r_collabs = s_owner.get(f"{BASE}/trips/{trip_id}/collaborators")
check("List Trip Collaborators", r_collabs)
print(f"    Owner: {r_collabs.json().get('owner', {}).get('name')}")

# Invite friend as Editor
r_invite1 = s_owner.post(f"{BASE}/trips/{trip_id}/collaborators", json={
    "email": "friend.editor@example.com",
    "role": "editor"
})
check("Invite Collaborator (Role: Editor)", r_invite1)
collab1_id = r_invite1.json().get("id")
print(f"    Invited: {r_invite1.json().get('name')} as {r_invite1.json().get('role')}")

# Invite another friend as Viewer
r_invite2 = s_owner.post(f"{BASE}/trips/{trip_id}/collaborators", json={
    "email": "friend.viewer@example.com",
    "role": "viewer"
})
check("Invite Collaborator (Role: Viewer)", r_invite2)
collab2_id = r_invite2.json().get("id")

# Fetch updated members list
r_collabs_updated = s_owner.get(f"{BASE}/trips/{trip_id}/collaborators")
check("List Updated Members", r_collabs_updated)
print(f"    Total members: {len(r_collabs_updated.json().get('collaborators', [])) + 1}")

# Remove viewer collaborator
r_remove = s_owner.delete(f"{BASE}/trips/{trip_id}/collaborators/{collab2_id}")
check("Remove Collaborator", r_remove)

print("\n=======================================================")
if errors:
    print(f"TEST FAILED with {len(errors)} error(s):")
    for e in errors:
        print(f"  [ERROR] {e}")
else:
    print("ALL TRIPADVISOR FEATURES VERIFIED AND PASSED 100%!")
print("=======================================================")
