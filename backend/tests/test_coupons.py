"""
Backend tests for the Coupon / discount system.

Covers:
  - CRUD create/update/delete/list (used_count populated)
  - Validation errors: duplicate code, percent>100, end_date<start_date
  - GET /coupons/available filtering by audience/date/active/phone-already-used, eligible flag
  - POST /coupons/validate audience/date/min_order/phone/already-used rules
  - /checkout/create-order applies discount and enforces one-use-per-phone
    (after demo-complete same phone rejected, different phone allowed)

Fresh phone numbers used: 9000000001 .. 9000000009 per agent-to-agent note.
Seeded coupons WELCOME10 & ALTOS100 are NOT modified — only referenced read-only.
Test-created coupons are cleaned up in a class-level teardown.
"""

import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ["EXPO_BACKEND_URL"].rstrip("/") if "EXPO_BACKEND_URL" in os.environ else (
    "https://product-store-app-7.preview.emergentagent.com"
)
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _unique_code(prefix: str) -> str:
    return (prefix + uuid.uuid4().hex[:6]).upper()[:20]


def _get_product(s):
    r = s.get(f"{API}/products", timeout=30)
    assert r.status_code == 200, r.text
    docs = r.json()
    assert len(docs) > 0, "no seed products available"
    # pick a lightweight non-heavy product for shipping-free order
    for d in docs:
        if float(d.get("weight_grams") or 0) < 500:
            return d
    return docs[0]


class TestCouponCRUD:
    created_ids: list = []

    @classmethod
    def teardown_class(cls):
        sess = requests.Session()
        for cid in cls.created_ids:
            try:
                sess.delete(f"{API}/coupons/{cid}", timeout=15)
            except Exception:
                pass

    def test_create_percent_coupon(self, s):
        code = _unique_code("TESTP")
        payload = {
            "code": code,
            "description": "test percent",
            "discount_type": "percent",
            "value": 15,
            "audience": "non_altos",
            "min_order": 0,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "active": True,
        }
        r = s.post(f"{API}/coupons", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["code"] == code
        assert data["discount_type"] == "percent"
        assert data["value"] == 15
        TestCouponCRUD.created_ids.append(data["id"])

        # GET list — verify persistence + used_count field present
        r2 = s.get(f"{API}/coupons", timeout=30)
        assert r2.status_code == 200
        listed = r2.json()
        got = next((c for c in listed if c["id"] == data["id"]), None)
        assert got is not None
        assert "used_count" in got
        assert got["used_count"] == 0

    def test_create_flat_coupon(self, s):
        code = _unique_code("TESTF")
        payload = {
            "code": code,
            "description": "flat off",
            "discount_type": "flat",
            "value": 75,
            "audience": "non_altos",
            "min_order": 200,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "active": True,
        }
        r = s.post(f"{API}/coupons", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["discount_type"] == "flat"
        assert data["value"] == 75
        assert data["min_order"] == 200
        TestCouponCRUD.created_ids.append(data["id"])

    def test_duplicate_code_rejected(self, s):
        code = _unique_code("DUPL")
        base = {
            "code": code,
            "discount_type": "percent",
            "value": 10,
            "audience": "non_altos",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        }
        r1 = s.post(f"{API}/coupons", json=base, timeout=30)
        assert r1.status_code == 200, r1.text
        TestCouponCRUD.created_ids.append(r1.json()["id"])

        r2 = s.post(f"{API}/coupons", json=base, timeout=30)
        assert r2.status_code == 400
        assert "already exists" in r2.json()["detail"].lower()

    def test_percent_over_100_rejected(self, s):
        payload = {
            "code": _unique_code("BAD"),
            "discount_type": "percent",
            "value": 150,
            "audience": "non_altos",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        }
        r = s.post(f"{API}/coupons", json=payload, timeout=30)
        assert r.status_code == 400
        assert "100" in r.json()["detail"]

    def test_end_before_start_rejected(self, s):
        payload = {
            "code": _unique_code("BAD"),
            "discount_type": "flat",
            "value": 50,
            "audience": "non_altos",
            "start_date": "2026-06-01",
            "end_date": "2026-05-01",
        }
        r = s.post(f"{API}/coupons", json=payload, timeout=30)
        assert r.status_code == 400
        assert "end date" in r.json()["detail"].lower()

    def test_update_coupon(self, s):
        code = _unique_code("UPD")
        create = s.post(f"{API}/coupons", json={
            "code": code, "discount_type": "flat", "value": 20,
            "audience": "non_altos", "start_date": "2026-01-01", "end_date": "2026-12-31",
        }, timeout=30).json()
        TestCouponCRUD.created_ids.append(create["id"])

        r = s.put(f"{API}/coupons/{create['id']}", json={
            "code": code, "description": "updated desc",
            "discount_type": "flat", "value": 30,
            "audience": "non_altos", "start_date": "2026-01-01", "end_date": "2026-12-31",
            "active": False,
        }, timeout=30)
        assert r.status_code == 200, r.text
        # GET to verify persistence
        listed = s.get(f"{API}/coupons", timeout=30).json()
        upd = next((c for c in listed if c["id"] == create["id"]), None)
        assert upd["value"] == 30
        assert upd["description"] == "updated desc"
        assert upd["active"] is False

    def test_delete_coupon(self, s):
        code = _unique_code("DEL")
        create = s.post(f"{API}/coupons", json={
            "code": code, "discount_type": "flat", "value": 10,
            "audience": "non_altos", "start_date": "2026-01-01", "end_date": "2026-12-31",
        }, timeout=30).json()
        cid = create["id"]

        r = s.delete(f"{API}/coupons/{cid}", timeout=30)
        assert r.status_code == 200

        listed = s.get(f"{API}/coupons", timeout=30).json()
        assert not any(c["id"] == cid for c in listed)


class TestCouponAvailable:
    created_ids: list = []

    @classmethod
    def teardown_class(cls):
        sess = requests.Session()
        for cid in cls.created_ids:
            try:
                sess.delete(f"{API}/coupons/{cid}", timeout=15)
            except Exception:
                pass

    def test_available_filters_audience_and_active(self, s):
        # active non-altos coupon valid today (2026 dates work since we're in Jan 2026)
        active = s.post(f"{API}/coupons", json={
            "code": _unique_code("AVAIL"), "discount_type": "percent", "value": 5,
            "audience": "non_altos", "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True,
        }, timeout=30).json()
        TestCouponAvailable.created_ids.append(active["id"])

        inactive = s.post(f"{API}/coupons", json={
            "code": _unique_code("INACT"), "discount_type": "percent", "value": 5,
            "audience": "non_altos", "start_date": "2026-01-01", "end_date": "2026-12-31", "active": False,
        }, timeout=30).json()
        TestCouponAvailable.created_ids.append(inactive["id"])

        altos_only = s.post(f"{API}/coupons", json={
            "code": _unique_code("ALTOSO"), "discount_type": "flat", "value": 50,
            "audience": "altos", "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True,
        }, timeout=30).json()
        TestCouponAvailable.created_ids.append(altos_only["id"])

        # non-altos guest
        r = s.get(f"{API}/coupons/available", params={"altos": "false", "phone": "9000000001", "subtotal": 1000}, timeout=30)
        assert r.status_code == 200
        codes = [c["code"] for c in r.json()]
        assert active["code"] in codes
        assert inactive["code"] not in codes  # inactive filtered
        assert altos_only["code"] not in codes  # wrong audience filtered

        # altos side
        r2 = s.get(f"{API}/coupons/available", params={"altos": "true", "phone": "9000000001", "subtotal": 1000}, timeout=30)
        codes2 = [c["code"] for c in r2.json()]
        assert altos_only["code"] in codes2
        assert active["code"] not in codes2

    def test_available_eligible_flag_min_order(self, s):
        c = s.post(f"{API}/coupons", json={
            "code": _unique_code("MINOR"), "discount_type": "flat", "value": 100,
            "audience": "non_altos", "min_order": 500,
            "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True,
        }, timeout=30).json()
        TestCouponAvailable.created_ids.append(c["id"])

        r = s.get(f"{API}/coupons/available", params={"altos": "false", "phone": "9000000002", "subtotal": 100}, timeout=30)
        entry = next((x for x in r.json() if x["code"] == c["code"]), None)
        assert entry is not None
        assert entry["eligible"] is False
        assert entry["discount_preview"] == 0

        r2 = s.get(f"{API}/coupons/available", params={"altos": "false", "phone": "9000000002", "subtotal": 800}, timeout=30)
        entry2 = next((x for x in r2.json() if x["code"] == c["code"]), None)
        assert entry2["eligible"] is True
        assert entry2["discount_preview"] == 100


class TestCouponValidate:
    created_ids: list = []

    @classmethod
    def teardown_class(cls):
        sess = requests.Session()
        for cid in cls.created_ids:
            try:
                sess.delete(f"{API}/coupons/{cid}", timeout=15)
            except Exception:
                pass

    def test_wrong_audience_altos_for_guest(self, s):
        c = s.post(f"{API}/coupons", json={
            "code": _unique_code("VAUD"), "discount_type": "percent", "value": 10,
            "audience": "altos", "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True,
        }, timeout=30).json()
        TestCouponValidate.created_ids.append(c["id"])

        r = s.post(f"{API}/coupons/validate", json={
            "code": c["code"], "phone": "9000000003", "altos_verified": False, "subtotal": 1000,
        }, timeout=30)
        assert r.status_code == 400
        assert "altos" in r.json()["detail"].lower()

    def test_wrong_audience_non_altos_for_altos_user(self, s):
        c = s.post(f"{API}/coupons", json={
            "code": _unique_code("VNON"), "discount_type": "percent", "value": 10,
            "audience": "non_altos", "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True,
        }, timeout=30).json()
        TestCouponValidate.created_ids.append(c["id"])

        r = s.post(f"{API}/coupons/validate", json={
            "code": c["code"], "phone": "9000000004", "altos_verified": True, "subtotal": 1000,
        }, timeout=30)
        assert r.status_code == 400
        assert "non-altos" in r.json()["detail"].lower() or "non_altos" in r.json()["detail"].lower()

    def test_expired_coupon(self, s):
        c = s.post(f"{API}/coupons", json={
            "code": _unique_code("EXP"), "discount_type": "percent", "value": 10,
            "audience": "non_altos", "start_date": "2020-01-01", "end_date": "2020-12-31", "active": True,
        }, timeout=30).json()
        TestCouponValidate.created_ids.append(c["id"])

        r = s.post(f"{API}/coupons/validate", json={
            "code": c["code"], "phone": "9000000005", "altos_verified": False, "subtotal": 1000,
        }, timeout=30)
        assert r.status_code == 400
        assert "expired" in r.json()["detail"].lower()

    def test_below_min_order(self, s):
        c = s.post(f"{API}/coupons", json={
            "code": _unique_code("MIN"), "discount_type": "flat", "value": 100,
            "audience": "non_altos", "min_order": 999,
            "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True,
        }, timeout=30).json()
        TestCouponValidate.created_ids.append(c["id"])

        r = s.post(f"{API}/coupons/validate", json={
            "code": c["code"], "phone": "9000000006", "altos_verified": False, "subtotal": 100,
        }, timeout=30)
        assert r.status_code == 400
        assert "minimum" in r.json()["detail"].lower()

    def test_missing_phone(self, s):
        c = s.post(f"{API}/coupons", json={
            "code": _unique_code("NOPH"), "discount_type": "percent", "value": 5,
            "audience": "non_altos", "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True,
        }, timeout=30).json()
        TestCouponValidate.created_ids.append(c["id"])

        r = s.post(f"{API}/coupons/validate", json={
            "code": c["code"], "phone": "", "altos_verified": False, "subtotal": 500,
        }, timeout=30)
        assert r.status_code == 400
        assert "mobile" in r.json()["detail"].lower() or "phone" in r.json()["detail"].lower()

    def test_valid_success(self, s):
        c = s.post(f"{API}/coupons", json={
            "code": _unique_code("OK"), "discount_type": "percent", "value": 20,
            "audience": "non_altos", "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True,
        }, timeout=30).json()
        TestCouponValidate.created_ids.append(c["id"])

        r = s.post(f"{API}/coupons/validate", json={
            "code": c["code"], "phone": "9000000007", "altos_verified": False, "subtotal": 500,
        }, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["valid"] is True
        assert data["code"] == c["code"]
        assert data["discount"] == 100  # 20% of 500


class TestCouponCheckoutFlow:
    """Full flow: create-order with coupon → demo-complete → same phone rejected → different phone allowed."""
    created_ids: list = []

    @classmethod
    def teardown_class(cls):
        sess = requests.Session()
        for cid in cls.created_ids:
            try:
                sess.delete(f"{API}/coupons/{cid}", timeout=15)
            except Exception:
                pass

    def test_full_one_use_per_phone(self, s):
        product = _get_product(s)
        # Ensure subtotal high enough for both min_order (0) and shipping thresholds not to matter much.
        code = _unique_code("FLOW")
        coupon = s.post(f"{API}/coupons", json={
            "code": code, "discount_type": "percent", "value": 10,
            "audience": "non_altos", "min_order": 0,
            "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True,
        }, timeout=30).json()
        TestCouponCheckoutFlow.created_ids.append(coupon["id"])

        phone_a = "9000000101"
        phone_b = "9000000102"

        customer_a = {
            "name": "Test A", "email": "test_a@example.com",
            "phone": phone_a, "address": "123 Test street, City",
        }
        items = [{"id": product["id"], "quantity": 1}]

        # 1. Create order with coupon
        r = s.post(f"{API}/checkout/create-order", json={
            "items": items, "customer": customer_a, "altos_verified": False, "coupon_code": code,
        }, timeout=30)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["coupon_code"] == code
        assert order["discount"] > 0

        # Sanity: total = subtotal - discount + shipping
        expected_total = round(order["subtotal"] - order["discount"] + order["shipping_charge"], 2)
        assert abs(order["amount"] - expected_total) < 0.01

        # 2. Demo complete
        r2 = s.post(f"{API}/checkout/demo-complete", json={"order_id": order["order_id"]}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "paid"

        # 3. Same phone re-attempts create-order with same coupon → should be rejected
        r3 = s.post(f"{API}/checkout/create-order", json={
            "items": items, "customer": customer_a, "altos_verified": False, "coupon_code": code,
        }, timeout=30)
        assert r3.status_code == 400, r3.text
        assert "already used" in r3.json()["detail"].lower()

        # 4. Different phone can still use the coupon
        customer_b = {**customer_a, "phone": phone_b, "email": "test_b@example.com", "name": "Test B"}
        r4 = s.post(f"{API}/checkout/create-order", json={
            "items": items, "customer": customer_b, "altos_verified": False, "coupon_code": code,
        }, timeout=30)
        assert r4.status_code == 200, r4.text
        assert r4.json()["discount"] > 0

        # 5. Verify used_count increments after completed redemption(s)
        listed = s.get(f"{API}/coupons", timeout=30).json()
        entry = next((c for c in listed if c["id"] == coupon["id"]), None)
        assert entry is not None
        # phone_a completed one redemption
        assert entry["used_count"] >= 1

        # 6. available list for phone_a should no longer show this coupon
        avail = s.get(f"{API}/coupons/available", params={
            "altos": "false", "phone": phone_a, "subtotal": 1000,
        }, timeout=30).json()
        assert not any(c["code"] == code for c in avail)

        # available list for phone_b should still show it (redemption only after paid)
        avail_b = s.get(f"{API}/coupons/available", params={
            "altos": "false", "phone": phone_b, "subtotal": 1000,
        }, timeout=30).json()
        assert any(c["code"] == code for c in avail_b)
