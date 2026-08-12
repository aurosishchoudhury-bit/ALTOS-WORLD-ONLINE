"""Backend tests for Botanica Store API (products, categories, checkout demo flow)."""
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


# ---------- Health / root ----------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert "demo_mode" in data
        assert data["demo_mode"] is True  # placeholder keys -> demo mode expected


# ---------- Product listing ----------
class TestProducts:
    def test_list_products(self, api_client):
        r = api_client.get(f"{API}/products")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 6  # 6 seeded products
        p = arr[0]
        for k in ("id", "name", "price", "category", "image", "stock"):
            assert k in p
        assert "_id" not in p  # Mongo _id must be excluded

    def test_filter_by_category(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "Skincare"})
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) > 0
        assert all(p["category"] == "Skincare" for p in arr)

    def test_filter_all(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "All"})
        assert r.status_code == 200
        assert len(r.json()) >= 6

    def test_categories(self, api_client):
        r = api_client.get(f"{API}/categories")
        assert r.status_code == 200
        data = r.json()
        assert "categories" in data
        assert "Supplements" in data["categories"]
        assert "Skincare" in data["categories"]

    def test_get_product_by_id(self, api_client):
        arr = api_client.get(f"{API}/products").json()
        pid = arr[0]["id"]
        r = api_client.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_get_product_404(self, api_client):
        r = api_client.get(f"{API}/products/does-not-exist")
        assert r.status_code == 404


# ---------- Product CRUD (Admin) ----------
class TestProductCRUD:
    created_id = None

    def test_create_product(self, api_client):
        payload = {
            "name": "TEST_Neem Face Wash",
            "description": "Test product",
            "price": 299.0,
            "category": "Skincare",
            "image": "https://example.com/img.jpg",
            "stock": 20,
            "featured": False,
        }
        r = api_client.post(f"{API}/products", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == payload["name"]
        assert data["price"] == 299.0
        assert data["id"]
        TestProductCRUD.created_id = data["id"]

        # Verify persistence
        g = api_client.get(f"{API}/products/{data['id']}")
        assert g.status_code == 200
        assert g.json()["name"] == payload["name"]

    def test_update_product(self, api_client):
        pid = TestProductCRUD.created_id
        assert pid, "Create must run first"
        payload = {
            "name": "TEST_Neem Face Wash Updated",
            "description": "Updated",
            "price": 349.0,
            "category": "Skincare",
            "image": "https://example.com/img2.jpg",
            "stock": 15,
            "featured": True,
        }
        r = api_client.put(f"{API}/products/{pid}", json=payload)
        assert r.status_code == 200, r.text
        # Verify persistence
        g = api_client.get(f"{API}/products/{pid}").json()
        assert g["name"] == "TEST_Neem Face Wash Updated"
        assert g["price"] == 349.0
        assert g["featured"] is True

    def test_update_404(self, api_client):
        payload = {
            "name": "x", "description": "", "price": 1.0,
            "category": "Skincare", "image": "", "stock": 1, "featured": False,
        }
        r = api_client.put(f"{API}/products/no-such-id", json=payload)
        assert r.status_code == 404

    def test_delete_product(self, api_client):
        pid = TestProductCRUD.created_id
        r = api_client.delete(f"{API}/products/{pid}")
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # Verify deletion
        g = api_client.get(f"{API}/products/{pid}")
        assert g.status_code == 404

    def test_delete_404(self, api_client):
        r = api_client.delete(f"{API}/products/no-such-id")
        assert r.status_code == 404


# ---------- Checkout flow ----------
class TestCheckout:
    order_id = None
    product_id = None

    def test_create_order_demo(self, api_client):
        products = api_client.get(f"{API}/products").json()
        p = products[0]
        TestCheckout.product_id = p["id"]
        payload = {
            "items": [{"id": p["id"], "quantity": 2}],
            "customer": {
                "name": "TEST Buyer",
                "email": "test@example.com",
                "phone": "9999999999",
                "address": "221B Baker Street, London",
            },
        }
        r = api_client.post(f"{API}/checkout/create-order", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["demo"] is True
        assert d["currency"] == "INR"
        assert d["amount"] == round(p["price"] * 2, 2)
        assert d["amount_paise"] == int(round(p["price"] * 2 * 100))
        assert d["order_id"]
        TestCheckout.order_id = d["order_id"]

    def test_create_order_unknown_product(self, api_client):
        payload = {
            "items": [{"id": "no-such-id", "quantity": 1}],
            "customer": {
                "name": "TEST Buyer", "email": "a@b.co",
                "phone": "9999999999", "address": "some long address",
            },
        }
        r = api_client.post(f"{API}/checkout/create-order", json=payload)
        assert r.status_code == 400

    def test_create_order_validation(self, api_client):
        # empty items should 422
        payload = {
            "items": [],
            "customer": {"name": "a", "email": "abc", "phone": "999999", "address": "xxxxxx"},
        }
        r = api_client.post(f"{API}/checkout/create-order", json=payload)
        assert r.status_code == 422

    def test_demo_complete(self, api_client):
        oid = TestCheckout.order_id
        assert oid
        r = api_client.post(f"{API}/checkout/demo-complete", json={"order_id": oid})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "paid"

    def test_get_order(self, api_client):
        oid = TestCheckout.order_id
        r = api_client.get(f"{API}/orders/{oid}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == oid
        assert d["status"] == "paid"
        assert d["demo"] is True
        assert "razorpay_payment_id" in d
        assert d["razorpay_payment_id"].startswith("demo_")

    def test_get_order_404(self, api_client):
        r = api_client.get(f"{API}/orders/no-such-id")
        assert r.status_code == 404

    def test_demo_complete_404(self, api_client):
        r = api_client.post(f"{API}/checkout/demo-complete", json={"order_id": "no-such-id"})
        assert r.status_code == 404
