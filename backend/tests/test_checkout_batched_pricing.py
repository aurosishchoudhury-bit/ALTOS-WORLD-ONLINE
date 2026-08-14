"""Regression: checkout _price_cart after N+1 -> batched $in refactor.

Focuses on multi-item cart pricing paths (MRP/offer/DP), unknown product,
heavy-item cap, demo-complete snapshot integrity, and product/category smoke.

Cleanup: DELETEs orders it created (by test email) and reverts any product edits.
"""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
    "https://product-store-app-7.preview.emergentagent.com"
API = f"{BASE_URL}/api"

TEST_EMAIL = "test_batched_pricing@altos.test"

CUSTOMER = {
    "name": "TEST Batched Buyer",
    "email": TEST_EMAIL,
    "phone": "9999999999",
    "address": "221B Baker Street, London",
}


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo_orders():
    """Direct db handle so cleanup can remove test orders by email."""
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    dbname = os.environ.get("DB_NAME", "botanica_store")
    c = MongoClient(url)
    yield c[dbname].orders
    # Post-test: purge any orders created by this test module
    c[dbname].orders.delete_many({"customer.email": TEST_EMAIL})
    c.close()


@pytest.fixture(scope="module")
def products(api_client):
    r = api_client.get(f"{API}/products")
    assert r.status_code == 200, r.text
    arr = r.json()
    by_name = {p["name"]: p for p in arr}
    return by_name


def _expected_mrp_unit(p):
    offer = float(p.get("offer_price") or 0)
    mrp = float(p.get("mrp") or 0)
    if offer > 0:
        return offer
    return mrp if mrp > 0 else float(p["price"])


def _shipping(total_g: float) -> float:
    if total_g > 5000:
        return 100.0
    if total_g > 3000:
        return 50.0
    return 0.0


# ---------- Smoke ----------
class TestSmoke:
    def test_products_list(self, api_client):
        r = api_client.get(f"{API}/products")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 6
        assert "_id" not in arr[0]

    def test_categories(self, api_client):
        r = api_client.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()["categories"]
        for c in ("Supplements", "Skincare", "Home Care", "Personal Care"):
            assert c in cats


# ---------- Multi-item batched pricing ----------
class TestMultiItemPricing:
    def _pick_three(self, products):
        # Pick 3 distinct seed products with small weight (<500g so no cap issues)
        want = ["Aloe & Cucumber Gel", "Ashwagandha Root Extract", "Vitamin C Radiance Serum"]
        picked = [products[n] for n in want if n in products]
        assert len(picked) == 3, f"Missing seed products; found {list(products.keys())}"
        return picked

    def test_multi_item_non_verified(self, api_client, products, mongo_orders):
        p1, p2, p3 = self._pick_three(products)
        qtys = [2, 1, 3]
        items = [
            {"id": p1["id"], "quantity": qtys[0]},
            {"id": p2["id"], "quantity": qtys[1]},
            {"id": p3["id"], "quantity": qtys[2]},
        ]
        expected_sub = round(sum(_expected_mrp_unit(p) * q for p, q in zip((p1, p2, p3), qtys)), 2)
        expected_weight = round(sum(float(p["weight_grams"]) * q for p, q in zip((p1, p2, p3), qtys)), 1)
        expected_ship = _shipping(expected_weight)
        expected_total = round(expected_sub + expected_ship, 2)

        r = api_client.post(f"{API}/checkout/create-order",
                            json={"items": items, "customer": CUSTOMER, "altos_verified": False})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["subtotal"] == expected_sub, (d, expected_sub)
        assert d["shipping_charge"] == expected_ship
        assert d["total_weight_grams"] == expected_weight
        assert d["total_bv"] == 0  # non-verified: bv hidden
        assert d["amount"] == expected_total
        assert d["amount_paise"] == int(round(expected_total * 100))
        assert d["demo"] is True

    def test_multi_item_verified_dp_and_bv(self, api_client, products):
        p1, p2, p3 = self._pick_three(products)
        qtys = [2, 1, 3]
        items = [
            {"id": p1["id"], "quantity": qtys[0]},
            {"id": p2["id"], "quantity": qtys[1]},
            {"id": p3["id"], "quantity": qtys[2]},
        ]
        expected_sub = round(sum(float(p["price"]) * q for p, q in zip((p1, p2, p3), qtys)), 2)
        expected_weight = round(sum(float(p["weight_grams"]) * q for p, q in zip((p1, p2, p3), qtys)), 1)
        expected_ship = _shipping(expected_weight)
        expected_total = round(expected_sub + expected_ship, 2)
        expected_bv = round(sum(float(p.get("bv") or 0) * q for p, q in zip((p1, p2, p3), qtys)), 1)

        r = api_client.post(f"{API}/checkout/create-order",
                            json={"items": items, "customer": CUSTOMER, "altos_verified": True})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["subtotal"] == expected_sub
        assert d["shipping_charge"] == expected_ship
        assert d["total_weight_grams"] == expected_weight
        assert d["total_bv"] == expected_bv
        assert d["amount"] == expected_total

    def test_unknown_product_in_multi_cart(self, api_client, products):
        p1 = products["Aloe & Cucumber Gel"]
        items = [
            {"id": p1["id"], "quantity": 1},
            {"id": "does-not-exist-xxx", "quantity": 2},
        ]
        r = api_client.post(f"{API}/checkout/create-order",
                            json={"items": items, "customer": CUSTOMER, "altos_verified": False})
        assert r.status_code == 400, r.text
        assert "Unknown product" in r.json().get("detail", "")


# ---------- Heavy-item cap ----------
class TestHeavyItemLimit:
    """Temporarily bump Aloe & Cucumber Gel to weight_grams=500 and verify cap.
    Reverts to 180 (seed value) at teardown."""

    _pid = None
    _original = None

    @pytest.fixture(autouse=True, scope="class")
    def _prep(self, request):
        # Class-level setup/teardown
        api = requests.Session()
        api.headers.update({"Content-Type": "application/json"})
        arr = api.get(f"{API}/products").json()
        aloe = next(p for p in arr if p["name"] == "Aloe & Cucumber Gel")
        TestHeavyItemLimit._pid = aloe["id"]
        TestHeavyItemLimit._original = aloe

        payload = {
            "name": aloe["name"],
            "description": aloe.get("description", ""),
            "price": aloe["price"],
            "mrp": aloe.get("mrp", 0),
            "offer_price": aloe.get("offer_price", 0),
            "bestseller": aloe.get("bestseller", False),
            "bv": aloe.get("bv", 0),
            "weight": aloe.get("weight", ""),
            "weight_grams": 500,
            "category": aloe["category"],
            "image": aloe.get("image", ""),
            "stock": aloe.get("stock", 100),
            "featured": aloe.get("featured", False),
        }
        r = api.put(f"{API}/products/{aloe['id']}", json=payload)
        assert r.status_code == 200
        assert r.json()["weight_grams"] == 500

        yield

        # Teardown: revert to seed weight_grams=180
        payload["weight_grams"] = 180
        rev = api.put(f"{API}/products/{aloe['id']}", json=payload)
        assert rev.status_code == 200
        assert rev.json()["weight_grams"] == 180

    def test_qty_3_rejected(self, api_client):
        payload = {
            "items": [{"id": self._pid, "quantity": 3}],
            "customer": CUSTOMER,
            "altos_verified": False,
        }
        r = api_client.post(f"{API}/checkout/create-order", json=payload)
        assert r.status_code == 400, r.text
        assert "500g" in r.json().get("detail", "") or "allowed per order" in r.json().get("detail", "")

    def test_qty_2_ok(self, api_client):
        payload = {
            "items": [{"id": self._pid, "quantity": 2}],
            "customer": CUSTOMER,
            "altos_verified": False,
        }
        r = api_client.post(f"{API}/checkout/create-order", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        # 500g x 2 = 1000g -> shipping free (<=3000)
        assert d["total_weight_grams"] == 1000.0
        assert d["shipping_charge"] == 0.0


# ---------- Demo complete + order snapshot ----------
class TestDemoCompleteSnapshot:
    def test_create_complete_and_snapshot(self, api_client, products):
        p1 = products["Aloe & Cucumber Gel"]
        p2 = products["Ashwagandha Root Extract"]
        items = [
            {"id": p1["id"], "quantity": 2},
            {"id": p2["id"], "quantity": 1},
        ]
        r = api_client.post(f"{API}/checkout/create-order",
                            json={"items": items, "customer": CUSTOMER, "altos_verified": True})
        assert r.status_code == 200
        d = r.json()
        oid = d["order_id"]

        c = api_client.post(f"{API}/checkout/demo-complete", json={"order_id": oid})
        assert c.status_code == 200
        assert c.json()["status"] == "paid"

        o = api_client.get(f"{API}/orders/{oid}").json()
        assert o["status"] == "paid"
        assert o["altos_verified"] is True
        # Snapshot check per line
        snap_by_id = {i["id"]: i for i in o["items"]}
        assert snap_by_id[p1["id"]]["unit_price"] == float(p1["price"])
        assert snap_by_id[p1["id"]]["line_total"] == float(p1["price"]) * 2
        assert snap_by_id[p1["id"]]["bv"] == float(p1.get("bv") or 0)
        assert snap_by_id[p2["id"]]["unit_price"] == float(p2["price"])
        assert snap_by_id[p2["id"]]["line_total"] == float(p2["price"])
        assert snap_by_id[p2["id"]]["bv"] == float(p2.get("bv") or 0)
        # BV total = 2*bv(p1) + 1*bv(p2)
        expected_bv = round(float(p1.get("bv") or 0) * 2 + float(p2.get("bv") or 0), 1)
        assert o["total_bv"] == expected_bv
