import pytest
import requests

BASE_URL = "http://127.0.0.1:8001/api"
FE_URL = "http://localhost:3000"


@pytest.fixture(scope="session")
def traveler_session():
    res = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "traveler"})
    assert res.status_code == 200
    token = res.json()["session_token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def admin_session():
    res = requests.post(f"{BASE_URL}/auth/demo-login", json={"role": "admin"})
    assert res.status_code == 200
    token = res.json()["session_token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def test_frontend_reachable():
    r = requests.get(FE_URL, timeout=10)
    assert r.status_code == 200


def test_auth_me(traveler_session):
    r = traveler_session.get(f"{BASE_URL}/auth/me")
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "traveler@globetrotter.app"
    assert data["name"] == "Aanya Rao"


def test_trips_listing(traveler_session):
    r = traveler_session.get(f"{BASE_URL}/trips")
    assert r.status_code == 200
    trips = r.json()
    assert isinstance(trips, list)
    assert len(trips) > 0


def test_osm_autocomplete():
    r = requests.get(f"{BASE_URL}/places/autocomplete?q=Delhi")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_route_preview(traveler_session):
    r = traveler_session.get(f"{BASE_URL}/route-preview?lat1=28.6139&lon1=77.2090&lat2=32.2396&lon2=77.1887")
    assert r.status_code == 200
    data = r.json()
    assert "distance_km" in data
    assert "duration_minutes" in data


def test_create_and_delete_trip(traveler_session):
    r = traveler_session.post(f"{BASE_URL}/trips", json={
        "name": "Pytest Temporary Trip",
        "starting_point": "Delhi",
        "start_lat": 28.6139,
        "start_lon": 77.2090,
        "destination": "Agra",
        "dest_lat": 27.1767,
        "dest_lon": 78.0081,
        "start_date": "2026-11-01",
        "end_date": "2026-11-02",
        "total_budget": 10000
    })
    assert r.status_code == 200
    trip_id = r.json()["id"]

    # Delete
    del_r = traveler_session.delete(f"{BASE_URL}/trips/{trip_id}")
    assert del_r.status_code == 200


def test_admin_stats(admin_session):
    r = admin_session.get(f"{BASE_URL}/admin/stats")
    assert r.status_code == 200
    stats = r.json()
    assert "users" in stats
    assert "trips" in stats
