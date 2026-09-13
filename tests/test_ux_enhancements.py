import requests
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8001/api"
s = requests.Session()

errors = []

def check(label, r, exp=200):
    ok = r.status_code == exp
    print(f"  {'[PASS]' if ok else '[FAIL]'} {label} -> HTTP {r.status_code}")
    if not ok:
        errors.append(f"{label}: exp {exp} got {r.status_code} | {r.text[:150]}")
    return ok

print("=======================================================")
print("  TESTING 5 UX ENHANCEMENTS & TRAVELER POLISH SUITE")
print("=======================================================")

# 1. Login
r = s.post(f"{BASE}/auth/demo-login", json={"role": "traveler"})
check("Traveler Login", r)
s.headers["Authorization"] = f"Bearer {r.json()['session_token']}"

# 2. Get or Create Trip
r_trips = s.get(f"{BASE}/trips")
check("Fetch Trips", r_trips)
if not r_trips.json():
    r_new = s.post(f"{BASE}/trips", json={"name": "European Grand Tour", "starting_point": "Paris", "destination": "Rome"})
    trip_id = r_new.json()["id"]
else:
    trip_id = r_trips.json()[0]["id"]

# 3. Test Multi-Currency Switcher
r_curr = s.put(f"{BASE}/trips/{trip_id}", json={
    "currency": "EUR",
    "currency_symbol": "�"
})
check("Switch Trip Currency to EUR (�)", r_curr)
trip_updated = r_curr.json()
print(f"    Active Currency: {trip_updated.get('currency')} ({trip_updated.get('currency_symbol')})")

# 4. Test Adding Custom / Secret Spot without OSM
r_full = s.get(f"{BASE}/trips/{trip_id}/full")
sections = r_full.json().get("sections", [])
if not sections:
    r_sec = s.post(f"{BASE}/trips/{trip_id}/sections", json={"type": "custom", "title": "Highway Day 1", "place_name": "Jaipur Highway"})
    section_id = r_sec.json()["id"]
else:
    section_id = sections[0]["id"]

r_custom_place = s.post(f"{BASE}/sections/{section_id}/places", json={
    "external_place_id": "custom-tea-stall-99",
    "name": "Sharma Ji Highway Kulhad Chai & Bun Maska",
    "category": "food",
    "description": "Legendary clay-cup tea stall at milestone 42 on the highway.",
    "cost_estimate": 150,
    "scheduled_time": "08:30",
    "tags": ["Must Try", "Hidden Gem", "Budget"]
})
check("Add Custom / Unlisted Hidden Gem Place", r_custom_place)
print(f"    Custom Place: {r_custom_place.json().get('name')} | Cost: {r_custom_place.json().get('cost_estimate')}")

# 5. Test Road Trip Packing Checklist Seeding
r_chk = s.get(f"{BASE}/trips/{trip_id}/checklist")
check("Fetch / Auto-Seed Default Packing Checklist", r_chk)
chk_items = r_chk.json()
print(f"    Seeded Checklist Items: {len(chk_items)} items")

# 6. Test Adding Custom Packing Item
r_add_chk = s.post(f"{BASE}/trips/{trip_id}/checklist", json={
    "title": "GoPro 4K Action Camera + Chest Mount",
    "category": "Electronics",
    "is_checked": False
})
check("Add Custom Packing Item", r_add_chk)
new_item = r_add_chk.json()
print(f"    Added: {new_item.get('title')} ({new_item.get('category')})")

# 7. Test Toggling Packing Item State
r_toggle = s.put(f"{BASE}/trips/{trip_id}/checklist/{new_item['id']}", json={
    "is_checked": True
})
check("Toggle Item State to Checked", r_toggle)
print(f"    Checked status: {r_toggle.json().get('is_checked')}")

# 8. Test Deleting Checklist Item
r_del_chk = s.delete(f"{BASE}/trips/{trip_id}/checklist/{new_item['id']}")
check("Delete Checklist Item", r_del_chk)

# 9. Test Expense with Interactive Friend Split
r_exp = s.post(f"{BASE}/trips/{trip_id}/expenses", json={
    "description": "Highway Toll Plaza Fastag Recharge",
    "amount": 750,
    "category": "transport",
    "paid_by": "Dev",
    "split_among": ["Dev", "Aanya", "Kabir", "Zara"]
})
check("Log Expense with Multi-Friend Split", r_exp)
print(f"    Logged Expense Per Person: �{r_exp.json().get('per_person')}")

print("\n=======================================================")
if errors:
    print(f"FAILED with {len(errors)} error(s):")
    for e in errors:
        print(f"  [ERROR] {e}")
else:
    print("ALL 5 UX ENHANCEMENTS & TRAVELER POLISH TESTS PASSED 100%!")
print("=======================================================")
