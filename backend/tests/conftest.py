import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
PREVIEW_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
LOCAL_URL = "http://localhost:8001"


def _pick_base_url():
    """Preview URL is hibernated in this fork; fall back to the local backend."""
    for url in (PREVIEW_URL, LOCAL_URL):
        if not url:
            continue
        try:
            r = requests.get(f"{url}/api/", timeout=10)
            if r.status_code == 200:
                return url
        except Exception:
            continue
    raise RuntimeError("No reachable backend base URL")


BASE_URL = _pick_base_url()
TRIP_ID = "a081374d-3e37-4cbb-a24e-48e10a7de27a"


def _token():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    m = re.search(r"Bearer token:\s*`([^`]+)`", content)
    if not m:
        pytest.fail("No Bearer token found in /app/memory/test_credentials.md")
    return m.group(1)


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def trip_id():
    return TRIP_ID


@pytest.fixture(scope="session")
def token():
    return _token()


@pytest.fixture(scope="class")
def api(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="class")
def anon():
    return requests.Session()
