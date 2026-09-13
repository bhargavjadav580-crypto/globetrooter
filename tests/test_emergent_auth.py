import requests

try:
    r = requests.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": "test_id"}, timeout=10)
    print(f"Status: {r.status_code}, Body: {r.text[:200]}")
except Exception as e:
    print(f"Error: {e}")
