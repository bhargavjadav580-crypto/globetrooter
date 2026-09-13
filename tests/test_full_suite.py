import pytest
import requests
import uuid

BASE_URL = "http://127.0.0.1:8001/api"
FE_URL = "http://localhost:3000"

@pytest.fixture(scope="session")
def traveler_session():
    res = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "traveler"})
    assert res.status_code == 200
    token = res.json()["session_token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s

@pytest.fixture(scope="session")
def admin_session():
    res = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "admin"})
    assert res.status_code == 200
    token = res.json()["session_token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s

# 1. Frontend & SPA Routes
def test_frontend_routes():
    routes = ["/", "/dashboard", "/trips", "/calendar", "/community", "/search", "/admin"]
    for r in routes:
        res = requests.get(f"{FE_URL}{r}", timeout=5)
        assert res.status_code == 200, f"Route {r} returned {res.status_code}"

# 2. Auth & Profiles
def test_auth_me_and_profile_update(traveler_session):
    res = traveler_session.get(f"{BASE_URL}/auth/me")
    assert res.status_code == 200
    user = res.json()
    assert user["email"] == "traveler@globetrotter.app"

    # Update profile
    upd = traveler_session.put(f"{BASE_URL}/auth/profile", json={
        "city": "Mumbai",
        "country": "India",
        "additional_info": "Passionate traveler & food lover."
    })
    assert upd.status_code == 200
    assert upd.json()["additional_info"] == "Passionate traveler & food lover."

def test_admin_access_control(traveler_session, admin_session):
    # Traveler forbidden
    trav_res = traveler_session.get(f"{BASE_URL}/admin/stats")
    assert trav_res.status_code == 403

    # Admin allowed
    adm_res = admin_session.get(f"{BASE_URL}/admin/stats")
    assert adm_res.status_code == 200
    assert "trips" in adm_res.json()

# 3. Saved Destinations
def test_saved_destinations(traveler_session):
    dest_name = f"Test Destination {uuid.uuid4().hex[:6]}"
    save_res = traveler_session.post(f"{BASE_URL}/saved-destinations", json={
        "place_name": dest_name,
        "lat": 15.2993,
        "lon": 74.1240
    })
    assert save_res.status_code == 200
    sid = save_res.json()["id"]

    list_res = traveler_session.get(f"{BASE_URL}/saved-destinations")
    assert list_res.status_code == 200
    assert any(d["id"] == sid for d in list_res.json())

    del_res = traveler_session.delete(f"{BASE_URL}/saved-destinations/{sid}")
    assert del_res.status_code == 200

# 4. Live Places & OpenStreetMap
def test_live_places_and_routing(traveler_session):
    # Autocomplete
    auto = requests.get(f"{BASE_URL}/places/autocomplete?q=Goa")
    assert auto.status_code == 200
    assert len(auto.json()) > 0

    # City info
    info = traveler_session.get(f"{BASE_URL}/places/city-info?q=Jaipur")
    assert info.status_code == 200

    # Route preview
    route = traveler_session.get(f"{BASE_URL}/route-preview?lat1=19.076&lon1=72.877&lat2=15.299&lon2=74.124")
    assert route.status_code == 200
    assert route.json()["distance_km"] > 0

# 5. Full Trip Lifecycle, Sections & Places
def test_trip_crud_and_sections(traveler_session):
    # Create trip
    create_res = traveler_session.post(f"{BASE_URL}/trips", json={
        "name": "Full Suite Mumbai to Goa Roadtrip",
        "starting_point": "Mumbai",
        "start_lat": 19.0760,
        "start_lon": 72.8777,
        "destination": "Goa",
        "dest_lat": 15.2993,
        "dest_lon": 74.1240,
        "start_date": "2026-10-01",
        "end_date": "2026-10-05",
        "total_budget": 50000
    })
    assert create_res.status_code == 200
    trip = create_res.json()
    tid = trip["id"]

    # Read trip
    get_res = traveler_session.get(f"{BASE_URL}/trips/{tid}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Full Suite Mumbai to Goa Roadtrip"

    # Add section
    sec_res = traveler_session.post(f"{BASE_URL}/trips/{tid}/sections", json={
        "type": "custom",
        "title": "Stop 1: Mahabaleshwar Viewpoint",
        "latitude": 17.9307,
        "longitude": 73.6477,
        "section_budget": 5000
    })
    assert sec_res.status_code == 200
    sec_id = sec_res.json()["id"]

    # Add place to section
    place_res = traveler_session.post(f"{BASE_URL}/sections/{sec_id}/places", json={
        "external_place_id": "poi_123",
        "name": "Arthur's Seat",
        "category": "attraction",
        "lat": 17.9307,
        "lon": 73.6477,
        "cost_estimate": 200
    })
    assert place_res.status_code == 200
    place_id = place_res.json()["id"]

    # Full view
    full_res = traveler_session.get(f"{BASE_URL}/trips/{tid}/full")
    assert full_res.status_code == 200
    assert len(full_res.json()["sections"]) >= 1

    # Delete place
    del_p = traveler_session.delete(f"{BASE_URL}/places/{place_id}")
    assert del_p.status_code == 200

    # Delete section
    del_s = traveler_session.delete(f"{BASE_URL}/sections/{sec_id}")
    assert del_s.status_code == 200

    # Cleanup trip
    del_t = traveler_session.delete(f"{BASE_URL}/trips/{tid}")
    assert del_t.status_code == 200

# 6. Road Trip Multi-Day Plan & Logistics
def test_roadtrip_logistics_and_budget(traveler_session):
    # Create trip
    t_res = traveler_session.post(f"{BASE_URL}/trips", json={
        "name": "Delhi to Manali Expedition",
        "starting_point": "Delhi",
        "start_lat": 28.6139,
        "start_lon": 77.2090,
        "destination": "Manali",
        "dest_lat": 32.2396,
        "dest_lon": 77.1887,
        "start_date": "2026-11-10",
        "end_date": "2026-11-15",
        "total_budget": 40000
    })
    assert t_res.status_code == 200
    tid = t_res.json()["id"]

    # Route plan
    plan_res = traveler_session.get(f"{BASE_URL}/trips/{tid}/route-plan", params={"max_drive_hours": 5})
    assert plan_res.status_code == 200
    plan = plan_res.json()
    assert plan["distance_km"] > 0
    assert "driving_days" in plan

    # Overnight Stay
    stay_res = traveler_session.post(f"{BASE_URL}/trips/{tid}/overnight-stays", json={
        "waypoint_index": 1,
        "waypoint_name": "Chandigarh Stop",
        "night_date": "2026-11-11",
        "hotel_name": "Grand Himalayan View",
        "lat": 30.7333,
        "lon": 76.7794,
        "price_estimate": 3500
    })
    assert stay_res.status_code == 200
    stay_id = stay_res.json()["id"]

    # Update stay price
    upd_stay = traveler_session.put(f"{BASE_URL}/overnight-stays/{stay_id}", json={"price_estimate": 4000})
    assert upd_stay.status_code == 200
    assert upd_stay.json()["price_estimate"] == 4000

    # Fuel profile
    fuel_res = traveler_session.post(f"{BASE_URL}/trips/{tid}/fuel-profile", json={
        "vehicle_type": "car",
        "mileage_kmpl": 15.0,
        "fuel_price_per_liter": 96.5,
        "travelers": 2
    })
    assert fuel_res.status_code == 200

    # Transport options
    trans_res = traveler_session.get(f"{BASE_URL}/trips/{tid}/transport-options")
    assert trans_res.status_code == 200
    assert len(trans_res.json()["options"]) > 0

    # Final budget
    budget_res = traveler_session.get(f"{BASE_URL}/trips/{tid}/final-budget")
    assert budget_res.status_code == 200
    assert "numbers" in budget_res.json()

    # Map link
    map_link = traveler_session.get(f"{BASE_URL}/trips/{tid}/final-map-link")
    assert map_link.status_code == 200
    assert "google.com/maps/dir" in (map_link.json().get("url") or "")

    # Cleanup
    traveler_session.delete(f"{BASE_URL}/trips/{tid}")

# 7. Trip Publishing & Public Access
def test_trip_publishing_and_public_plan(traveler_session):
    t_res = traveler_session.post(f"{BASE_URL}/trips", json={
        "name": "Public Shared Kerala Tour",
        "starting_point": "Kochi",
        "start_lat": 9.9312,
        "start_lon": 76.2673,
        "destination": "Munnar",
        "dest_lat": 10.0889,
        "dest_lon": 77.0595,
        "start_date": "2026-12-01",
        "end_date": "2026-12-05",
        "total_budget": 30000
    })
    tid = t_res.json()["id"]

    # Publish
    pub_res = traveler_session.post(f"{BASE_URL}/trips/{tid}/publish")
    assert pub_res.status_code == 200
    slug = pub_res.json()["public_slug"]
    assert slug is not None

    # Anonymous public view
    anon = requests.Session()
    public_view = anon.get(f"{BASE_URL}/trips/public/{slug}")
    assert public_view.status_code == 200
    assert public_view.json()["trip"]["name"] == "Public Shared Kerala Tour"

    # Public plan view
    public_plan = anon.get(f"{BASE_URL}/trips/public/{slug}/plan")
    assert public_plan.status_code == 200
    assert "trip" in public_plan.json()

    # Copy trip
    copy_res = traveler_session.post(f"{BASE_URL}/trips/{tid}/copy")
    assert copy_res.status_code == 200
    assert "(Copy)" in copy_res.json()["name"]
    traveler_session.delete(f"{BASE_URL}/trips/{copy_res.json()['id']}")

    # Cleanup
    traveler_session.delete(f"{BASE_URL}/trips/{tid}")

# 8. Community Feed & Posts
def test_community_feed(traveler_session):
    # Create post
    post_res = traveler_session.post(f"{BASE_URL}/community/posts", json={
        "title": "Top Tips for Highway Driving in India",
        "body": "Always keep emergency numbers handy and plan fuel stops in advance!",
        "place_name": "NH48 Highway"
    })
    assert post_res.status_code == 200
    post_id = post_res.json()["id"]

    # List feed
    feed_res = traveler_session.get(f"{BASE_URL}/community/posts")
    assert feed_res.status_code == 200
    assert any(p["id"] == post_id for p in feed_res.json())

# 9. Admin Management Suite
def test_admin_user_and_analytics(admin_session):
    users_res = admin_session.get(f"{BASE_URL}/admin/users")
    assert users_res.status_code == 200
    assert len(users_res.json()) >= 1

    cities_res = admin_session.get(f"{BASE_URL}/admin/popular-cities")
    assert cities_res.status_code == 200
    assert isinstance(cities_res.json(), list)

    activities_res = admin_session.get(f"{BASE_URL}/admin/popular-activities")
    assert activities_res.status_code == 200
    assert isinstance(activities_res.json(), list)
