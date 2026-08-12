"""Tests for Shiprocket integration + order status PATCH endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
    "https://product-store-app-7.preview.emergentagent.com"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Shiprocket ---

class TestShiprocket:
    def test_disconnect_first_idempotent(self, api_client):
        # ensure unlinked at start of suite
        r = api_client.post(f"{API}/shiprocket/disconnect")
        assert r.status_code == 200
        assert r.json() == {"connected": False}

    def test_status_unlinked(self, api_client):
        r = api_client.get(f"{API}/shiprocket/status")
        assert r.status_code == 200
        d = r.json()
        assert d["connected"] is False
        assert d.get("email") is None

    def test_sync_unlinked_returns_409(self, api_client):
        r = api_client.post(f"{API}/shiprocket/sync")
        assert r.status_code == 409
        assert "not linked" in r.json().get("detail", "").lower()

    def test_connect_fake_credentials_returns_400(self, api_client):
        r = api_client.post(
            f"{API}/shiprocket/connect",
            json={"email": "fake-test-user@example.com", "password": "badpassword-xyz"},
        )
        # Real Shiprocket rejects fake creds -> expected 400 (or 502 fallback if Shiprocket unreachable)
        assert r.status_code in (400, 502)
        msg = r.json().get("detail", "").lower()
        if r.status_code == 400:
            # Verify error message mentions "API user" as requested
            assert "api user" in msg, f"Expected 'API user' guidance in error message: {msg}"

    def test_disconnect_is_idempotent(self, api_client):
        r1 = api_client.post(f"{API}/shiprocket/disconnect")
        assert r1.status_code == 200
        assert r1.json() == {"connected": False}
        r2 = api_client.post(f"{API}/shiprocket/disconnect")
        assert r2.status_code == 200
        assert r2.json() == {"connected": False}


# --- Order status PATCH ---

@pytest.fixture(scope="module")
def paid_order(api_client):
    """Create a demo order and mark it paid; returns the order id."""
    prods = api_client.get(f"{API}/products").json()
    pid = prods[0]["id"]
    payload = {
        "items": [{"id": pid, "quantity": 1}],
        "customer": {
            "name": "TEST Status Buyer",
            "email": "status@test.com",
            "phone": "9998887777",
            "address": "221B Baker Street, London",
        },
        "altos_verified": False,
    }
    r = api_client.post(f"{API}/checkout/create-order", json=payload)
    assert r.status_code == 200
    oid = r.json()["order_id"]
    c = api_client.post(f"{API}/checkout/demo-complete", json={"order_id": oid})
    assert c.status_code == 200
    assert c.json()["status"] == "paid"
    return oid


class TestOrderStatus:
    def test_patch_shipped_with_tracking(self, api_client, paid_order):
        r = api_client.patch(
            f"{API}/orders/{paid_order}/status",
            json={
                "status": "shipped",
                "awb": "AWB123456",
                "courier_name": "Bluedart",
                "tracking_url": "https://shiprocket.co/tracking/AWB123456",
            },
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "shipped"
        assert d["awb"] == "AWB123456"
        assert d["courier_name"] == "Bluedart"
        assert d["tracking_url"].startswith("https://")
        assert "shipped_at" in d and d["shipped_at"]

        # Persistence via GET
        g = api_client.get(f"{API}/orders/{paid_order}").json()
        assert g["status"] == "shipped"
        assert g["awb"] == "AWB123456"
        assert g.get("shipped_at")

    def test_patch_delivered_sets_delivered_at(self, api_client, paid_order):
        r = api_client.patch(
            f"{API}/orders/{paid_order}/status",
            json={"status": "delivered"},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "delivered"
        assert d.get("delivered_at")
        # earlier shipped_at persists
        assert d.get("shipped_at")

    def test_patch_invalid_status_returns_400(self, api_client, paid_order):
        r = api_client.patch(
            f"{API}/orders/{paid_order}/status",
            json={"status": "cancelled"},
        )
        assert r.status_code == 400

    def test_patch_unknown_order_returns_404(self, api_client):
        r = api_client.patch(
            f"{API}/orders/no-such-id/status",
            json={"status": "shipped"},
        )
        assert r.status_code == 404
