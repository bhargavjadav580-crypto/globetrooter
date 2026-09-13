import requests
import io
import sys
from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8001/api"
HOST = "http://127.0.0.1:8001"
s = requests.Session()

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
print("  TESTING REAL PHOTO & RECEIPT UPLOADS (CAMERA/FILE)")
print("=======================================================")

# 1. Login
r = s.post(f"{BASE}/auth/demo-login", json={"role": "traveler"})
check("Traveler Login", r)
s.headers["Authorization"] = f"Bearer {r.json()['session_token']}"

# 2. Generate a test PNG image in-memory
img_buffer = io.BytesIO()
test_img = Image.new("RGB", (400, 300), color=(255, 120, 60))
test_img.save(img_buffer, format="PNG")
img_bytes = img_buffer.getvalue()

# Upload PNG photo
files = {"file": ("amber_fort_sunset.png", img_bytes, "image/png")}
r_up1 = s.post(f"{BASE}/upload/image", files=files)
check("Upload PNG Photo via Multipart Form", r_up1)
up1_data = r_up1.json()
print(f"    Uploaded URL: {up1_data.get('url')} | Size: {up1_data.get('size_bytes')} bytes | Dims: {up1_data.get('width')}x{up1_data.get('height')}")

# 3. Generate a test receipt JPEG image in-memory
receipt_buffer = io.BytesIO()
receipt_img = Image.new("RGB", (600, 800), color=(240, 240, 245))
receipt_img.save(receipt_buffer, format="JPEG", quality=90)
receipt_bytes = receipt_buffer.getvalue()

files2 = {"file": ("restaurant_bill_receipt.jpg", receipt_bytes, "image/jpeg")}
r_up2 = s.post(f"{BASE}/upload/image", files=files2)
check("Upload Receipt JPEG via Multipart Form", r_up2)
up2_data = r_up2.json()
print(f"    Receipt URL: {up2_data.get('url')} | Size: {up2_data.get('size_bytes')} bytes")

# 4. Verify Static File Serving over HTTP
r_serve1 = requests.get(f"{HOST}{up1_data['url']}")
check("Static File HTTP Serving (Photo)", r_serve1)
print(f"    Fetched content length: {len(r_serve1.content)} bytes | Content-Type: {r_serve1.headers.get('content-type')}")

r_serve2 = requests.get(f"{HOST}{up2_data['url']}")
check("Static File HTTP Serving (Receipt)", r_serve2)

# 5. Test Expense with Receipt Photo Attachment
r_trips = s.get(f"{BASE}/trips")
trip_id = r_trips.json()[0]["id"]

r_exp = s.post(f"{BASE}/trips/{trip_id}/expenses", json={
    "description": "Taj Mahal Entry Ticket & Audio Guide 2x",
    "amount": 2200,
    "category": "activity",
    "paid_by": "Aanya",
    "split_among": ["Aanya", "Dev"],
    "receipt_url": up2_data["url"]
})
check("Log Expense with Attached Receipt Photo", r_exp)
exp_saved = r_exp.json()
print(f"    Saved Expense Receipt URL: {exp_saved.get('receipt_url')}")

# 6. Test Place Review with Traveler Photo Attachment
r_full = s.get(f"{BASE}/trips/{trip_id}/full")
places = r_full.json().get("places", [])
if places:
    place_id = places[0]["id"]
    r_rev = s.post(f"{BASE}/places/{place_id}/reviews", json={
        "rating": 5,
        "comment": "Mesmerizing sunset views from the terrace!",
        "visit_tip": "Carry a camera with wide zoom lens.",
        "photo_url": up1_data["url"]
    })
    check("Submit Review with Attached Photo", r_rev)
    rev_saved = r_rev.json()
    print(f"    Saved Review Photo URL: {rev_saved.get('photo_url')}")

# 7. Test Community Story Post with Uploaded Travel Photo
r_comm = s.post(f"{BASE}/community/posts", json={
    "title": "Golden Hour at the Desert Fortress ??",
    "body": "Captured this breathtaking frame right before twilight.",
    "place_name": "Jodhpur",
    "image": up1_data["url"]
})
check("Create Community Post with Uploaded Photo", r_comm)
print(f"    Community Post Image URL: {r_comm.json().get('image')}")

# 8. Test Trip Creation with Custom Uploaded Cover Image
r_trip_custom = s.post(f"{BASE}/trips", json={
    "name": "Custom Photo Cover Expedition",
    "starting_point": "Mumbai",
    "destination": "Goa",
    "cover_image": up1_data["url"]
})
check("Create Trip with Uploaded Cover Photo", r_trip_custom)
print(f"    Created Trip Cover: {r_trip_custom.json().get('cover_image')}")

print("\n=======================================================")
if errors:
    print(f"FAILED with {len(errors)} error(s):")
    for e in errors:
        print(f"  [ERROR] {e}")
else:
    print("ALL REAL PHOTO & RECEIPT UPLOAD TESTS PASSED 100%!")
print("=======================================================")
