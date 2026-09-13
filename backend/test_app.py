import requests
import sys

BASE_URL = "http://127.0.0.1:8001/api"
FE_URL = "http://localhost:3000"

def run_all_tests():
    print("=== 1. Testing Frontend Root ===")
    fe = requests.get(FE_URL, timeout=10)
    assert fe.status_code == 200, f"Frontend failed with status {fe.status_code}"
    print("[PASS] Frontend is running and responding on http://localhost:3000")

    print("\n=== 2. Testing Demo Login & Auth ===")
    login_res = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "traveler"}, timeout=10)
    assert login_res.status_code == 200, f"Demo login failed: {login_res.text}"
    token = login_res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_res = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
    assert me_res.status_code == 200, f"Auth me failed: {me_res.text}"
    user = me_res.json()
    print(f"[PASS] Logged in as: {user.get('name')} ({user.get('email')})")

    print("\n=== 3. Testing Trips Listing ===")
    trips_res = requests.get(f"{BASE_URL}/trips", headers=headers, timeout=10)
    assert trips_res.status_code == 200, f"Get trips failed: {trips_res.text}"
    trips = trips_res.json()
    trip_names = [t.get("name") for t in trips]
    print(f"[PASS] Found {len(trips)} trips: {trip_names}")
    assert len(trips) > 0, "No trips found"
    sample_trip_id = trips[0]["id"]

    print("\n=== 4. Testing Trip Details & Score ===")
    trip_res = requests.get(f"{BASE_URL}/trips/{sample_trip_id}", headers=headers, timeout=10)
    assert trip_res.status_code == 200, f"Get trip detail failed: {trip_res.text}"
    print(f"[PASS] Trip details loaded: {trip_res.json().get('name')}")

    print("\n=== 5. Testing Live OpenStreetMap Places Autocomplete ===")
    places_res = requests.get(f"{BASE_URL}/places/autocomplete?q=Mumbai", timeout=15)
    assert places_res.status_code == 200, f"Autocomplete failed: {places_res.text}"
    places = places_res.json()
    print(f"[PASS] Found {len(places)} live autocomplete results for 'Mumbai'")
    assert len(places) > 0, "No autocomplete results returned"

    print("\n=== 6. Testing Live OSM Route Preview ===")
    route_res = requests.get(f"{BASE_URL}/route-preview?lat1=19.076&lon1=72.877&lat2=15.299&lon2=74.124", headers=headers, timeout=15)
    assert route_res.status_code == 200, f"Route preview failed: {route_res.text}"
    route_data = route_res.json()
    print(f"[PASS] Route preview OK: distance={route_data.get('distance_km')}km, duration={route_data.get('duration_minutes')}mins")

    print("\n=== 7. Testing Trip Creation, Roadmap & Map Deep Link ===")
    new_trip = requests.post(f"{BASE_URL}/trips", json={
        "name": "Test Bangalore to Mysore Weekend",
        "starting_point": "Bangalore",
        "start_lat": 12.9716,
        "start_lon": 77.5946,
        "destination": "Mysore",
        "dest_lat": 12.2958,
        "dest_lon": 76.6394,
        "start_date": "2026-09-01",
        "end_date": "2026-09-03",
        "total_budget": 15000
    }, headers=headers, timeout=10)
    assert new_trip.status_code == 200, f"Create trip failed: {new_trip.text}"
    created_id = new_trip.json()["id"]
    print(f"[PASS] Created new trip: {created_id}")

    plan_res = requests.get(f"{BASE_URL}/trips/{created_id}/route-plan", headers=headers, timeout=15)
    assert plan_res.status_code == 200, f"Route plan failed: {plan_res.text}"
    print(f"[PASS] Trip route plan computed: {plan_res.json().get('distance_km')} km")

    map_link_res = requests.get(f"{BASE_URL}/trips/{created_id}/final-map-link", headers=headers, timeout=10)
    assert map_link_res.status_code == 200, f"Map link failed: {map_link_res.text}"
    print(f"[PASS] External Google Maps URL generated: {map_link_res.json().get('url')}")

    print("\n=== 8. Testing Admin Features ===")
    admin_login = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "admin"}, timeout=10)
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['session_token']}"}
    admin_stats = requests.get(f"{BASE_URL}/admin/stats", headers=admin_headers, timeout=10)
    assert admin_stats.status_code == 200, f"Admin stats failed: {admin_stats.text}"
    print(f"[PASS] Admin stats retrieved successfully: {admin_stats.json()}")

    print("\n=======================================================")
    print(" ALL 8 CORE TEST SUITES PASSED! APP IS FULLY WORKING!")
    print("=======================================================")

if __name__ == "__main__":
    try:
        run_all_tests()
    except Exception as e:
        print(f"\n[FAIL] Test failed with error: {e}")
        sys.exit(1)
