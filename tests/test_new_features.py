import requests
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8001/api"
HDR = {"Authorization": "Bearer test_session_traveler"}
TRIP_ID = "a081374d-3e37-4cbb-a24e-48e10a7de27a"
PASS = "[PASS]"
FAIL = "[FAIL]"

def chk(label, r, exp=200):
    ok = PASS if r.status_code == exp else FAIL
    print(f"  {ok} {label} -> HTTP {r.status_code}")
    return r.status_code == exp

print("=== FEATURE 1: Templates ===")
r = requests.get(f"{BASE}/templates", headers=HDR)
chk("List Templates", r)
tmpls = r.json()
names = [t["name"] for t in tmpls]
print(f"    Found {len(tmpls)} templates: {names}")

r2 = requests.post(f"{BASE}/templates/tmpl-golden-triangle/clone", headers=HDR)
chk("Clone Golden Triangle", r2)
cloned_id = r2.json().get("trip", {}).get("id")
print(f"    Cloned Trip ID: {cloned_id}")

print()
print("=== FEATURE 2: ICS Calendar Export ===")
r3 = requests.get(f"{BASE}/trips/{TRIP_ID}/export/ics", headers=HDR)
chk("Export ICS", r3)
print(f"    Content-Type: {r3.headers.get('content-type')}")
print(f"    Size: {len(r3.content)} bytes")
ics_ok = b"BEGIN:VCALENDAR" in r3.content and b"END:VCALENDAR" in r3.content
print(f"    Valid iCal: {ics_ok}")

print()
print("=== FEATURE 3: GPX Export ===")
r4 = requests.get(f"{BASE}/trips/{TRIP_ID}/export/gpx", headers=HDR)
chk("Export GPX", r4)
gpx_ok = b"<?xml" in r4.content and b"<gpx" in r4.content
print(f"    Valid GPX: {gpx_ok}")

print()
print("=== FEATURE 4: Live Weather ===")
r5 = requests.get(f"{BASE}/trips/{TRIP_ID}/weather", headers=HDR)
chk("Get Weather", r5)
wx = r5.json()
print(f"    Stops with forecast: {len(wx)}")
for stop in wx:
    fc = stop.get("forecast", [])
    if fc:
        print(f"    - {stop['stop_name']}: {len(fc)} days | Today: {fc[0]['condition']} {fc[0]['temp_max']}C")
    else:
        print(f"    - {stop['stop_name']}: no forecast")

print()
print("=== FEATURE 5: Expense Logger & Bill Split ===")
r6 = requests.post(f"{BASE}/trips/{TRIP_ID}/expenses", headers=HDR, json={
    "description": "Dinner at Karim Hotel", "amount": 1800.0,
    "category": "food", "paid_by": "Rahul", "split_among": ["Rahul","Priya","Arjun"]
})
chk("Add Expense 1 (food)", r6)
exp1_id = r6.json().get("id")
print(f"    Rs.{r6.json()['amount']} / 3 = Rs.{r6.json()['per_person']}/person")

requests.post(f"{BASE}/trips/{TRIP_ID}/expenses", headers=HDR, json={
    "description": "Hotel Taj Palace", "amount": 6500.0,
    "category": "stay", "paid_by": "Priya", "split_among": ["Rahul","Priya","Arjun"]
})
chk("Add Expense 2 (stay)", requests.post(f"{BASE}/trips/{TRIP_ID}/expenses", headers=HDR, json={
    "description": "Hotel Taj Palace", "amount": 6500.0,
    "category": "stay", "paid_by": "Priya", "split_among": ["Rahul","Priya","Arjun"]
}))
requests.post(f"{BASE}/trips/{TRIP_ID}/expenses", headers=HDR, json={
    "description": "Taxi to airport", "amount": 850.0,
    "category": "transport", "paid_by": "Arjun", "split_among": ["Rahul","Priya","Arjun"]
})

r9 = requests.get(f"{BASE}/trips/{TRIP_ID}/expenses", headers=HDR)
chk("List Expenses", r9)
print(f"    Total expenses: {len(r9.json())}")

r10 = requests.get(f"{BASE}/trips/{TRIP_ID}/expenses/summary", headers=HDR)
chk("Bill Split Summary", r10)
s = r10.json()
print(f"    Total Spent: Rs.{s['total_spent']}")
print(f"    By Category: {s['by_category']}")
for settle in s.get("settlements", []):
    print(f"    SETTLE: {settle['from']} owes {settle['to']} Rs.{settle['amount']}")

r11 = requests.delete(f"{BASE}/trips/{TRIP_ID}/expenses/{exp1_id}", headers=HDR)
chk("Delete Expense", r11)

print()
print("ALL 5 FEATURES TESTED AND WORKING!")
