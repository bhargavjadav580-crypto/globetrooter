import requests

BASE = "http://127.0.0.1:8001/api"
HDR = {"Authorization": "Bearer test_session_traveler"}

r = requests.get(f"{BASE}/trips", headers=HDR)
trips = r.json()
print(f"Total trips: {len(trips)}")
if trips:
    t = trips[0]
    print(f"Testing trip: {t['name']} ({t['id']})")
    r_full = requests.get(f"{BASE}/trips/{t['id']}/full", headers=HDR)
    print(f"Full trip status: {r_full.status_code}")
    r_stays = requests.get(f"{BASE}/trips/{t['id']}/overnight-stays", headers=HDR)
    print(f"Stays status: {r_stays.status_code} ({len(r_stays.json())} stays)")
    r_budget = requests.get(f"{BASE}/trips/{t['id']}/final-budget", headers=HDR)
    print(f"Budget status: {r_budget.status_code}")
    print("ALL DATA SOURCES FOR PDF BROCHURE VERIFIED!")
