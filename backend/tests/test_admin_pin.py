"""Backend tests for the Admin PIN lock feature (verify-pin, change-pin, rate-limit)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE_URL:
    # Fallback to reading frontend/.env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break

ADMIN_PIN = "24681357"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- verify-pin ---
class TestVerifyPin:
    def test_wrong_pin_returns_401(self, api):
        r = api.post(f"{BASE_URL}/api/admin/verify-pin", json={"pin": "11111111"})
        assert r.status_code == 401, r.text
        assert "Incorrect" in r.text or "PIN" in r.text

    def test_correct_pin_returns_session_token(self, api):
        r = api.post(f"{BASE_URL}/api/admin/verify-pin", json={"pin": ADMIN_PIN})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_token" in data and len(data["session_token"]) > 20
        assert data.get("expires_in") == 3600

    def test_rate_limit_after_5_wrong_attempts(self, api):
        # Wait for previous rate-limit window (per-IP, 1 min) if any prior attempts consumed it.
        # We already made 1 wrong + 1 correct above → 2 attempts in bucket. Fire 4 more wrong.
        codes = []
        for i in range(6):
            r = api.post(f"{BASE_URL}/api/admin/verify-pin", json={"pin": "00000000"})
            codes.append(r.status_code)
        # At least one 429 expected before we've done all 6
        assert 429 in codes, f"Expected 429 rate-limit within 6 quick wrong attempts, got {codes}"


# --- change-pin (auth required) ---
class TestChangePin:
    def test_missing_session_header_returns_401(self, api):
        # Wait for rate-limit window to expire so we don't hit 429 while getting a fresh session later
        time.sleep(62)
        r = api.post(
            f"{BASE_URL}/api/admin/change-pin",
            json={"current_pin": ADMIN_PIN, "new_pin": "654321"},
        )
        assert r.status_code == 401, r.text

    def test_change_pin_roundtrip_and_restore(self, api):
        # Fresh session
        r = api.post(f"{BASE_URL}/api/admin/verify-pin", json={"pin": ADMIN_PIN})
        assert r.status_code == 200, r.text
        token = r.json()["session_token"]

        # Change 24681357 -> 654321
        r = api.post(
            f"{BASE_URL}/api/admin/change-pin",
            json={"current_pin": ADMIN_PIN, "new_pin": "654321"},
            headers={"X-Admin-Session": token},
        )
        assert r.status_code == 200, r.text

        # Old PIN should now fail
        r = api.post(f"{BASE_URL}/api/admin/verify-pin", json={"pin": ADMIN_PIN})
        assert r.status_code == 401, r.text

        # New PIN should unlock
        r = api.post(f"{BASE_URL}/api/admin/verify-pin", json={"pin": "654321"})
        assert r.status_code == 200, r.text
        new_token = r.json()["session_token"]

        # Restore original PIN 24681357 (CRITICAL — else creds file becomes stale)
        r = api.post(
            f"{BASE_URL}/api/admin/change-pin",
            json={"current_pin": "654321", "new_pin": ADMIN_PIN},
            headers={"X-Admin-Session": new_token},
        )
        assert r.status_code == 200, r.text

        # Verify restore
        r = api.post(f"{BASE_URL}/api/admin/verify-pin", json={"pin": ADMIN_PIN})
        assert r.status_code == 200, r.text


# --- regression smoke ---
class TestRegressionSmoke:
    def test_products_endpoint(self, api):
        r = api.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
