import requests

BASE = "http://127.0.0.1:8001/api"
s = requests.Session()

# 1. Login
r = s.post(f"{BASE}/auth/demo-login", json={"role": "traveler"})
s.headers["Authorization"] = f"Bearer {r.json()['session_token']}"

# 2. Create trip
r_trip = s.post(f"{BASE}/trips", json={
    "name": "Publishing Verification Trip",
    "starting_point": "Delhi",
    "destination": "Agra"
})
trip_id = r_trip.json()["id"]

# 3. Publish Trip
r_pub = s.post(f"{BASE}/trips/{trip_id}/publish")
slug = r_pub.json()["public_slug"]
print(f"Published trip -> Slug: {slug}")

# 4. View as Public (Unauthenticated)
r_view = requests.get(f"{BASE}/trips/public/{slug}")
print(f"Public access when published -> HTTP {r_view.status_code}")

# 5. Unpublish Trip
r_unpub = s.post(f"{BASE}/trips/{trip_id}/unpublish")
print(f"Unpublish trip -> HTTP {r_unpub.status_code}")

# 6. Verify Public Access is now revoked (404)
r_view_after = requests.get(f"{BASE}/trips/public/{slug}")
print(f"Public access after unpublishing -> HTTP {r_view_after.status_code}")

assert r_view.status_code == 200, "Should be 200 when published"
assert r_unpub.status_code == 200, "Unpublish should be 200"
assert r_view_after.status_code == 404, "Should be 404 after unpublishing"

print("ALL PRE-DEPLOYMENT HARDENING CHECKS PASSED 100%!")
