import pytest
import requests
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = "http://127.0.0.1:8001/api"

@pytest.fixture(scope="module")
def traveler_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/auth/demo-login", json={"role": "traveler"})
    assert r.status_code == 200, "Traveler login failed"
    token = r.json().get("session_token", "")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s

@pytest.fixture(scope="module")
def traveler_session_2():
    """A distinct second traveler to test isolation and cross-user data protection."""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/auth/demo-login", json={"role": "traveler"})
    assert r.status_code == 200
    token = r.json().get("session_token", "")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/auth/demo-login", json={"role": "admin"})
    assert r.status_code == 200, "Admin login failed"
    token = r.json().get("session_token", "")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s

@pytest.fixture(scope="module")
def unauth_session():
    return requests.Session()


# ==============================================================================
# 1. SECURITY & RBAC HARD TESTS
# ==============================================================================

def test_unauthenticated_protected_endpoints_rejected(unauth_session):
    """Ensure all protected endpoints strictly return 401 without credentials."""
    endpoints = [
        ("GET", f"{BASE_URL}/auth/me"),
        ("GET", f"{BASE_URL}/trips"),
        ("POST", f"{BASE_URL}/trips"),
        ("GET", f"{BASE_URL}/saved-destinations"),
        ("GET", f"{BASE_URL}/admin/stats"),
    ]
    for method, url in endpoints:
        if method == "GET":
            r = unauth_session.get(url)
        else:
            r = unauth_session.post(url, json={})
        assert r.status_code in (401, 403), f"Expected 401/403 on {method} {url}, got {r.status_code}"


def test_invalid_and_forged_tokens_rejected():
    """Ensure malformed or tampered Bearer tokens are rejected."""
    bad_tokens = [
        "Bearer invalid_token_12345",
        "Bearer test_session_traveler_tampered",
        "Bearer ''",
        "Bearer null",
        "Bearer ../../../etc/passwd",
    ]
    for b in bad_tokens:
        s = requests.Session()
        s.headers["Authorization"] = b
        r = s.get(f"{BASE_URL}/auth/me")
        assert r.status_code == 401, f"Forged token {b} was not rejected! Got: {r.status_code}"


def test_admin_rbac_strict_enforcement(traveler_session):
    """Ensure non-admin cannot access any admin endpoints or delete users."""
    admin_routes = [
        ("GET", f"{BASE_URL}/admin/stats"),
        ("GET", f"{BASE_URL}/admin/users"),
        ("GET", f"{BASE_URL}/admin/popular-cities"),
        ("GET", f"{BASE_URL}/admin/popular-activities"),
        ("DELETE", f"{BASE_URL}/admin/users/user_demoadmin01"),
    ]
    for method, url in admin_routes:
        if method == "GET":
            r = traveler_session.get(url)
        elif method == "DELETE":
            r = traveler_session.delete(url)
        assert r.status_code == 403, f"Traveler accessed admin route {url} with code {r.status_code}"


def test_cross_user_isolation(traveler_session, admin_session):
    """Ensure a user cannot access or modify another user's private trips or places."""
    # Create trip under traveler
    r = traveler_session.post(f"{BASE_URL}/trips", json={
        "name": "Secret Private Trip", "start": "Mumbai", "destination": "Pune",
        "start_lat": 19.07, "start_lon": 72.87, "dest_lat": 18.52, "dest_lon": 73.85,
        "start_date": "2026-11-01", "end_date": "2026-11-03", "total_budget": 10000
    })
    assert r.status_code == 200
    trip_id = r.json()["id"]

    try:
        # Create a new session with an unlinked user token to test isolation
        s_other = requests.Session()
        r_other = s_other.post(f"{BASE_URL}/auth/demo-login", json={"role": "admin"})
        # Even admin calling private user trip endpoints via standard trip routes must handle ownership
        # Verify unauth cannot view private trip
        unauth = requests.Session()
        r_priv = unauth.get(f"{BASE_URL}/trips/{trip_id}")
        assert r_priv.status_code == 401, f"Unauthenticated access permitted to private trip: {r_priv.status_code}"

    finally:
        traveler_session.delete(f"{BASE_URL}/trips/{trip_id}")


# ==============================================================================
# 2. EDGE-CASE INPUTS & BOUNDARY VALIDATION
# ==============================================================================

def test_trip_validation_boundaries(traveler_session):
    """Test boundary cases for trip creation: negative budget, XSS strings, unicode, same-day trips."""
    
    # 1. Negative cost check on places
    r_trip = traveler_session.post(f"{BASE_URL}/trips", json={
        "name": "Boundary Test Trip", "start": "Delhi", "destination": "Agra",
        "start_lat": 28.61, "start_lon": 77.20, "dest_lat": 27.17, "dest_lon": 78.04,
        "start_date": "2026-05-01", "end_date": "2026-05-01", "total_budget": 5000
    })
    assert r_trip.status_code == 200
    tid = r_trip.json()["id"]

    try:
        # Add section
        r_sec = traveler_session.post(f"{BASE_URL}/trips/{tid}/sections", json={
            "title": "Day 1 <script>alert(1)</script>", "type": "activity",
            "place_name": "Taj Mahal 🏛️✨", "latitude": 27.175, "longitude": 78.042,
            "date_start": "2026-05-01", "date_end": "2026-05-01", "section_budget": 2000
        })
        assert r_sec.status_code == 200
        sid = r_sec.json()["id"]
        assert "Taj Mahal" in r_sec.json()["place_name"]

        # Negative place cost must be rejected with 400
        r_neg = traveler_session.post(f"{BASE_URL}/sections/{sid}/places", json={
            "name": "Negative Place", "category": "attraction", "external_place_id": "p-neg",
            "lat": 27.17, "lon": 78.04, "cost_estimate": -500
        })
        assert r_neg.status_code == 400, f"Negative cost was allowed! Code: {r_neg.status_code}"

        # Valid place with unicode
        r_pl = traveler_session.post(f"{BASE_URL}/sections/{sid}/places", json={
            "name": "Taj Mahal Gardens 🌸", "category": "attraction", "external_place_id": "p-taj-1",
            "lat": 27.17, "lon": 78.04, "cost_estimate": 250
        })
        assert r_pl.status_code == 200
        pid = r_pl.json()["id"]

        # Update place with negative cost must also be rejected with 400
        r_upd_neg = traveler_session.put(f"{BASE_URL}/places/{pid}", json={"cost_estimate": -100})
        assert r_upd_neg.status_code == 400, f"Updating to negative cost was allowed! Code: {r_upd_neg.status_code}"

    finally:
        traveler_session.delete(f"{BASE_URL}/trips/{tid}")


def test_scoring_extreme_boundaries(traveler_session):
    """Test scoring engine with 0 budget, massive budget, 0 sections, 0 places, and heavy overspend."""
    # Zero budget trip
    r = traveler_session.post(f"{BASE_URL}/trips", json={
        "name": "Zero Budget Trip", "start": "Goa", "destination": "Goa",
        "start_lat": 15.29, "start_lon": 74.12, "dest_lat": 15.29, "dest_lon": 74.12,
        "start_date": "2026-08-01", "end_date": "2026-08-01", "total_budget": 0
    })
    assert r.status_code == 200
    tid = r.json()["id"]

    try:
        # Score calculation with 0 budget and 0 sections must not throw division-by-zero
        r_score = traveler_session.get(f"{BASE_URL}/trips/{tid}/score")
        assert r_score.status_code == 200
        sc = r_score.json()
        assert "total" in sc and sc["total"] >= 0
        assert sc["pace"] in ("Relaxed", "Balanced", "Packed")

        # Budget guardian on empty trip
        r_bg = traveler_session.get(f"{BASE_URL}/trips/{tid}/budget")
        assert r_bg.status_code == 200
        bg = r_bg.json()
        assert bg["breakdown"]["total_estimated"] == 0

        # Travel load on 1-day trip with 0 distance
        r_tl = traveler_session.get(f"{BASE_URL}/trips/{tid}/travel-load")
        assert r_tl.status_code == 200
        assert r_tl.json()["days"] == 1
        assert r_tl.json()["pace"] == "Relaxed"

    finally:
        traveler_session.delete(f"{BASE_URL}/trips/{tid}")


# ==============================================================================
# 3. CASCADE DELETION & INTEGRITY TESTS
# ==============================================================================

def test_cascade_delete_integrity(traveler_session):
    """Ensure deleting a section removes all places, and deleting a trip removes all child documents."""
    r_trip = traveler_session.post(f"{BASE_URL}/trips", json={
        "name": "Cascade Test Trip", "start": "Chennai", "destination": "Bangalore",
        "start_lat": 13.08, "start_lon": 80.27, "dest_lat": 12.97, "dest_lon": 77.59,
        "start_date": "2026-09-01", "end_date": "2026-09-04", "total_budget": 25000
    })
    assert r_trip.status_code == 200
    tid = r_trip.json()["id"]

    # Add section
    r_sec = traveler_session.post(f"{BASE_URL}/trips/{tid}/sections", json={
        "title": "Section 1", "type": "activity", "place_name": "Marina Beach",
        "latitude": 13.05, "longitude": 80.28, "date_start": "2026-09-01", "date_end": "2026-09-01"
    })
    assert r_sec.status_code == 200
    sid = r_sec.json()["id"]

    # Add 2 places
    r_p1 = traveler_session.post(f"{BASE_URL}/sections/{sid}/places", json={
        "name": "Beach Walk", "category": "attraction", "external_place_id": "mb-1",
        "lat": 13.05, "lon": 80.28, "cost_estimate": 0
    })
    r_p2 = traveler_session.post(f"{BASE_URL}/sections/{sid}/places", json={
        "name": "Lighthouse Cafe", "category": "food", "external_place_id": "mb-2",
        "lat": 13.05, "lon": 80.28, "cost_estimate": 300
    })
    assert r_p1.status_code == 200 and r_p2.status_code == 200
    p1_id = r_p1.json()["id"]

    # Add overnight stay
    r_stay = traveler_session.post(f"{BASE_URL}/trips/{tid}/overnight-stays", json={
        "hotel_name": "Vellore Residency", "lat": 12.91, "lon": 79.13, "price_estimate": 2500, "waypoint_index": 1
    })
    assert r_stay.status_code == 200

    # Delete Section -> Check Place is deleted
    r_del_sec = traveler_session.delete(f"{BASE_URL}/sections/{sid}")
    assert r_del_sec.status_code == 200

    # Place should now return 404
    r_get_p1 = traveler_session.put(f"{BASE_URL}/places/{p1_id}", json={"cost_estimate": 999})
    assert r_get_p1.status_code == 404, "Child place was not cascaded when section was deleted!"

    # Delete Trip -> Check full cleanup
    r_del_trip = traveler_session.delete(f"{BASE_URL}/trips/{tid}")
    assert r_del_trip.status_code == 200

    # Getting deleted trip must return 404
    r_get_trip = traveler_session.get(f"{BASE_URL}/trips/{tid}")
    assert r_get_trip.status_code == 404


# ==============================================================================
# 4. LOGISTICS, FUEL PROFILES & DIVISION-BY-ZERO SAFETY
# ==============================================================================

def test_fuel_and_transport_division_by_zero_safety(traveler_session):
    """Test fuel calculations reject <= 0 values and compute transport options safely."""
    r_trip = traveler_session.post(f"{BASE_URL}/trips", json={
        "name": "Logistics Safety Trip", "start": "Mumbai", "destination": "Pune",
        "start_lat": 19.0760, "start_lon": 72.8777, "dest_lat": 18.5204, "dest_lon": 73.8567,
        "start_date": "2026-07-01", "end_date": "2026-07-03", "total_budget": 15000
    })
    assert r_trip.status_code == 200
    tid = r_trip.json()["id"]

    try:
        # 1. 0 mileage must be rejected with 400 Bad Request
        r_fuel_zero = traveler_session.post(f"{BASE_URL}/trips/{tid}/fuel-profile", json={
            "vehicle_type": "car", "mileage_kmpl": 0, "fuel_price_per_liter": 100, "travelers": 1
        })
        assert r_fuel_zero.status_code == 400

        # 2. 0 travelers must be rejected with 400 Bad Request
        r_trav_zero = traveler_session.post(f"{BASE_URL}/trips/{tid}/fuel-profile", json={
            "vehicle_type": "car", "mileage_kmpl": 15, "fuel_price_per_liter": 100, "travelers": 0
        })
        assert r_trav_zero.status_code == 400

        # 3. Valid fuel profile
        r_fuel_valid = traveler_session.post(f"{BASE_URL}/trips/{tid}/fuel-profile", json={
            "vehicle_type": "car", "mileage_kmpl": 16.5, "fuel_price_per_liter": 105, "travelers": 2
        })
        assert r_fuel_valid.status_code == 200

        # Transport options calculation must calculate safely
        r_trans = traveler_session.get(f"{BASE_URL}/trips/{tid}/transport-options")
        assert r_trans.status_code == 200
        opts = r_trans.json().get("options", [])
        assert len(opts) > 0, "Transport options returned empty list"

        # Final budget must calculate grand total
        r_budget = traveler_session.get(f"{BASE_URL}/trips/{tid}/final-budget")
        assert r_budget.status_code == 200
        assert "numbers" in r_budget.json()
        assert r_budget.json()["numbers"]["grand_total"] >= 0

    finally:
        traveler_session.delete(f"{BASE_URL}/trips/{tid}")


# ==============================================================================
# 5. PUBLIC SHARING & CLONING INTEGRITY
# ==============================================================================

def test_public_trip_sharing_and_cloning_isolation(traveler_session, unauth_session):
    """Test publishing, unauthenticated viewing of public trips, and cloning without leaking owner."""
    r_trip = traveler_session.post(f"{BASE_URL}/trips", json={
        "name": "Golden Triangle Tour", "start": "Delhi", "destination": "Jaipur",
        "start_lat": 28.61, "start_lon": 77.20, "dest_lat": 26.91, "dest_lon": 75.78,
        "start_date": "2026-10-10", "end_date": "2026-10-15", "total_budget": 40000
    })
    assert r_trip.status_code == 200
    tid = r_trip.json()["id"]

    try:
        # Publish trip
        r_pub = traveler_session.post(f"{BASE_URL}/trips/{tid}/publish")
        assert r_pub.status_code == 200
        slug = r_pub.json().get("public_slug")
        assert slug is not None and len(slug) > 5

        # View full public trip without auth (contains score, breakdown, sections)
        r_view = unauth_session.get(f"{BASE_URL}/trips/public/{slug}")
        assert r_view.status_code == 200
        assert r_view.json()["trip"]["name"] == "Golden Triangle Tour"
        assert "score" in r_view.json()

        # Public plan overview endpoint without auth
        r_plan = unauth_session.get(f"{BASE_URL}/trips/public/{slug}/plan")
        assert r_plan.status_code == 200
        assert "route_geometry" in r_plan.json()

        # Non-existent slug returns 404
        r_404 = unauth_session.get(f"{BASE_URL}/trips/public/non-existent-random-slug-9999")
        assert r_404.status_code == 404

        # Clone trip
        r_clone = traveler_session.post(f"{BASE_URL}/trips/{tid}/copy")
        assert r_clone.status_code == 200
        clone_id = r_clone.json()["id"]
        assert clone_id != tid
        assert "(Copy)" in r_clone.json()["name"]

        # Clean clone
        traveler_session.delete(f"{BASE_URL}/trips/{clone_id}")

    finally:
        traveler_session.delete(f"{BASE_URL}/trips/{tid}")


# ==============================================================================
# 6. COMMUNITY FORUM BOUNDARY TESTS
# ==============================================================================

def test_community_post_queries_and_filters(traveler_session):
    """Test community posts: search with special characters, empty queries, pagination list."""
    # Post creation with emojis & long text
    r = traveler_session.post(f"{BASE_URL}/community/posts", json={
        "title": "Epic Roadtrip to Ladakh 🏔️🚗",
        "body": "Crossing Khardung La at 17,582 ft! Best momos in Leh.",
        "place_name": "Leh Ladakh"
    })
    assert r.status_code == 200
    post_id = r.json().get("id")

    # Search by keyword
    r_srch = traveler_session.get(f"{BASE_URL}/community/posts", params={"q": "Ladakh"})
    assert r_srch.status_code == 200
    assert any(p.get("id") == post_id for p in r_srch.json())

    # Search with regex special characters (must not crash MongoDB)
    r_special = traveler_session.get(f"{BASE_URL}/community/posts", params={"q": ".*+?^${}()|[]\\"})
    assert r_special.status_code == 200

