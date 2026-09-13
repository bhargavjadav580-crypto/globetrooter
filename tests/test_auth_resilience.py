import requests

BASE = "http://127.0.0.1:8001/api"

# 1. Test POST /auth/session with fallback
r_sess = requests.post(f"{BASE}/auth/session", json={"session_id": "test_session_offline"})
print(f"Session Exchange -> HTTP {r_sess.status_code} | Token: {r_sess.json().get('session_token')[:15]}... | User: {r_sess.json()['user']['name']}")

# 2. Test POST /auth/demo-login
r_demo = requests.post(f"{BASE}/auth/demo-login", json={"role": "traveler"})
print(f"Demo Login -> HTTP {r_demo.status_code} | User: {r_demo.json()['user']['name']}")

# 3. Test /auth/me
token = r_sess.json().get('session_token')
r_me = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
print(f"Auth Me -> HTTP {r_me.status_code} | Email: {r_me.json()['email']}")

assert r_sess.status_code == 200, "Session exchange failed"
assert r_demo.status_code == 200, "Demo login failed"
assert r_me.status_code == 200, "Auth me failed"
print("SUCCESS: ALL AUTH FLOWS ARE 100% OPERATIONAL!")
