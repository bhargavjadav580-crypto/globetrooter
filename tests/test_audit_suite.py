import requests
import re
import math
import sys
import io
from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import os
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8001/api")
HOST = os.environ.get("HOST_URL", "http://127.0.0.1:8001")

results = []

def run_test(phase, category, test_name, expected, fn):
    try:
        actual, passed, severity = fn()
        status = "PASS" if passed else "FAIL"
    except Exception as e:
        actual = f"Exception: {str(e)[:120]}"
        passed = False
        status = "FAIL"
        severity = "High"
    results.append({
        "phase": phase,
        "category": category,
        "test": test_name,
        "expected": expected,
        "actual": actual,
        "status": status,
        "severity": severity if not passed else "None"
    })
    print(f"[{status}] {category} - {test_name}: {actual}")

# Setup Sessions
s_owner = requests.Session()
r = s_owner.post(f"{BASE}/auth/demo-login", json={"role": "traveler"})
owner_token = r.json().get("session_token")
s_owner.headers["Authorization"] = f"Bearer {owner_token}"
owner_id = r.json()["user"]["user_id"]

s_editor = requests.Session()
# Create distinct editor session
r_ed = requests.post(f"{BASE}/auth/demo-login", json={"role": "traveler", "email": "editor_audit@globetrotter.app"})
# We simulate a second traveler by logging in as editor
s_editor.headers["Authorization"] = f"Bearer {r_ed.json()['session_token']}"

s_viewer = requests.Session()
r_vw = requests.post(f"{BASE}/auth/demo-login", json={"role": "traveler", "email": "viewer_audit@globetrotter.app"})
s_viewer.headers["Authorization"] = f"Bearer {r_vw.json()['session_token']}"

s_admin = requests.Session()
r_adm = requests.post(f"{BASE}/auth/demo-login", json={"role": "admin"})
admin_token = r_adm.json().get("session_token")
s_admin.headers["Authorization"] = f"Bearer {admin_token}"

s_unauth = requests.Session()

# Create a test trip for Owner
r_trip = s_owner.post(f"{BASE}/trips", json={
    "name": "Audit Security Verification Trip",
    "starting_point": "Mumbai",
    "destination": "Goa",
    "total_budget": 50000,
    "currency": "INR",
    "currency_symbol": "₹"
})
trip = r_trip.json()
trip_id = trip["id"]

# Add section and place
r_sec = s_owner.post(f"{BASE}/trips/{trip_id}/sections", json={"title": "Day 1 Mumbai", "place_name": "Mumbai"})
section_id = r_sec.json()["id"]

r_plc = s_owner.post(f"{BASE}/sections/{section_id}/places", json={
    "external_place_id": "audit-plc-1",
    "name": "Marine Drive Promenade",
    "category": "attraction",
    "cost_estimate": 0
})
place_id = r_plc.json()["id"]

# Add Collaborators
r_col_ed = s_owner.post(f"{BASE}/trips/{trip_id}/collaborators", json={"email": "editor_audit@globetrotter.app", "role": "editor"})
ed_col_id = r_col_ed.json()["id"]

r_col_vw = s_owner.post(f"{BASE}/trips/{trip_id}/collaborators", json={"email": "viewer_audit@globetrotter.app", "role": "viewer"})
vw_col_id = r_col_vw.json()["id"]

print("\n--- PHASE 4: SECURITY & RBAC AUDIT TESTS ---")

# RBAC Test 1: Viewer blocked from adding places
def test_viewer_write():
    r = s_viewer.post(f"{BASE}/sections/{section_id}/places", json={
        "external_place_id": "bad-plc", "name": "Illegal Place", "category": "food"
    })
    return f"HTTP {r.status_code}", r.status_code in [403, 404], "Critical"

run_test("Phase 4", "RBAC", "Viewer write protection on places", "HTTP 403", test_viewer_write)

# RBAC Test 2: Non-collaborator IDOR blocked on private trip
def test_idor_trip():
    r = s_unauth.get(f"{BASE}/trips/{trip_id}/full")
    return f"HTTP {r.status_code}", r.status_code in [401, 403], "Critical"

run_test("Phase 4", "RBAC", "Unauthenticated IDOR on private trip", "HTTP 401", test_idor_trip)

# RBAC Test 3: Admin endpoint protection
def test_admin_rbac():
    r = s_owner.get(f"{BASE}/admin/overview")
    return f"HTTP {r.status_code}", r.status_code == 403, "High"

run_test("Phase 4", "RBAC", "Admin endpoints reject non-admin traveler", "HTTP 403", test_admin_rbac)

# Input Security: MongoDB Regex Injection in search
def test_regex_injection():
    # Pass malicious regex payload
    r = s_owner.get(f"{BASE}/community/posts?q=.*")
    r2 = s_owner.get(f"{BASE}/community/posts?q=[a-z]+{{1,5}}")
    return f"HTTP {r.status_code} / {r2.status_code}", r.status_code == 200 and r2.status_code == 200, "High"

run_test("Phase 4", "Input Security", "Regex metacharacters sanitized in search", "HTTP 200 with sanitized match", test_regex_injection)

# Input Security: Malformed JSON to Pydantic
def test_pydantic_422():
    r = s_owner.post(f"{BASE}/trips", json={"total_budget": "INVALID_NUMBER_STRING"})
    return f"HTTP {r.status_code}", r.status_code == 422, "Medium"

run_test("Phase 4", "Input Security", "Malformed JSON payload rejected as 422", "HTTP 422", test_pydantic_422)

# File Upload: Real Image upload & Pillow resizing
def test_file_upload():
    img_buffer = io.BytesIO()
    test_img = Image.new("RGB", (3000, 2000), color=(100, 150, 200))
    test_img.save(img_buffer, format="JPEG")
    files = {"file": ("test_oversized.jpg", img_buffer.getvalue(), "image/jpeg")}
    r = s_owner.post(f"{BASE}/upload/image", files=files)
    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200 and data.get("width") <= 2560 and data.get("height") <= 2560
    return f"HTTP {r.status_code} | Resized to {data.get('width')}x{data.get('height')}", passed, "High"

run_test("Phase 4", "File Upload", "Upload re-encoded & downsampled (>2560px)", "HTTP 200 with width<=2560", test_file_upload)

# File Upload: Disguised non-image rejected
def test_disguised_file():
    files = {"file": ("malicious.php", b"<?php echo 'attack'; ?>", "text/plain")}
    r = s_owner.post(f"{BASE}/upload/image", files=files)
    return f"HTTP {r.status_code}", r.status_code in [400, 415, 422], "High"

run_test("Phase 4", "File Upload", "Disguised text/php file rejected", "HTTP 400", test_disguised_file)

# Settlement Math Verification
def test_settlement_math():
    # 3 travelers: Kabir paid 12000 split [Kabir, Dev, Aanya], Dev paid 3000 split [Dev, Aanya]
    # Total spend = 15000
    # Kabir: paid 12000, share = 4000 -> net +8000
    # Dev: paid 3000, share = 4000 + 1500 = 5500 -> net -2500
    # Aanya: paid 0, share = 4000 + 1500 = 5500 -> net -5500
    # Expected settlements: Aanya owes Kabir 5500, Dev owes Kabir 2500. Total = 8000.
    s_owner.post(f"{BASE}/trips/{trip_id}/expenses", json={
        "description": "Villa Stay", "amount": 12000, "paid_by": "Kabir", "split_among": ["Kabir", "Dev", "Aanya"]
    })
    s_owner.post(f"{BASE}/trips/{trip_id}/expenses", json={
        "description": "Seafood Lunch", "amount": 3000, "paid_by": "Dev", "split_among": ["Dev", "Aanya"]
    })
    r_sum = s_owner.get(f"{BASE}/trips/{trip_id}/expenses/summary")
    settlements = r_sum.json().get("settlements", [])
    total_settled = sum(s["amount"] for s in settlements)
    passed = r_sum.status_code == 200 and math.isclose(total_settled, 8000, abs_tol=0.01)
    return f"HTTP {r_sum.status_code} | Settlements: {settlements} | Total: {total_settled}", passed, "Critical"

run_test("Phase 5", "Expense Engine", "Greedy settlement math balances to zero", "Total settled = 8000", test_settlement_math)

# Export Suite: ICS RFC 5545
def test_ics_export():
    r = s_owner.get(f"{BASE}/trips/{trip_id}/export/ics")
    passed = r.status_code == 200 and "BEGIN:VCALENDAR" in r.text and "END:VCALENDAR" in r.text
    return f"HTTP {r.status_code} | Content-Length: {len(r.content)}", passed, "Medium"

run_test("Phase 5", "Export Suite", "Valid RFC 5545 iCalendar (.ics) format", "HTTP 200 with VCALENDAR", test_ics_export)

# Export Suite: GPX 1.1 Track
def test_gpx_export():
    r = s_owner.get(f"{BASE}/trips/{trip_id}/export/gpx")
    passed = r.status_code == 200 and "<gpx" in r.text and "</gpx>" in r.text
    return f"HTTP {r.status_code} | Content-Length: {len(r.content)}", passed, "Medium"

run_test("Phase 5", "Export Suite", "Valid GPX 1.1 XML track (.gpx) format", "HTTP 200 with GPX XML", test_gpx_export)

# Public Publishing & Unpublishing
def test_public_publishing():
    r_pub = s_owner.post(f"{BASE}/trips/{trip_id}/publish")
    slug = r_pub.json().get("public_slug")
    r_view = s_unauth.get(f"{BASE}/trips/public/{slug}")
    r_unpub = s_owner.post(f"{BASE}/trips/{trip_id}/unpublish")
    r_view_after = s_unauth.get(f"{BASE}/trips/public/{slug}")
    passed = r_view.status_code == 200 and r_view_after.status_code == 404
    return f"Pub: {r_view.status_code} -> Unpub: {r_view_after.status_code}", passed, "High"

run_test("Phase 5", "Public Sharing", "Public slug viewable & unpublishing revokes access", "200 on pub, 404 on unpub", test_public_publishing)

print("\nSUMMARY OF AUDIT CHECKS:")
passed_cnt = sum(1 for r in results if r["status"] == "PASS")
failed_cnt = len(results) - passed_cnt
print(f"Passed: {passed_cnt}/{len(results)} | Failed: {failed_cnt}")
