import requests

BASE = "http://127.0.0.1:8001/api"

# Let's verify admin endpoints:
s_traveler = requests.Session()
r_t = s_traveler.post(f"{BASE}/auth/demo-login", json={"role": "traveler"})
s_traveler.headers["Authorization"] = f"Bearer {r_t.json()['session_token']}"

r_adm_stat = s_traveler.get(f"{BASE}/admin/stats")
print(f"Traveler accessing /api/admin/stats -> HTTP {r_adm_stat.status_code}")

r_adm_cities = s_traveler.get(f"{BASE}/admin/popular-cities")
print(f"Traveler accessing /api/admin/popular-cities -> HTTP {r_adm_cities.status_code}")

s_admin = requests.Session()
r_a = s_admin.post(f"{BASE}/auth/demo-login", json={"role": "admin"})
s_admin.headers["Authorization"] = f"Bearer {r_a.json()['session_token']}"

r_adm_ok = s_admin.get(f"{BASE}/admin/stats")
print(f"Admin accessing /api/admin/stats -> HTTP {r_adm_ok.status_code}")
