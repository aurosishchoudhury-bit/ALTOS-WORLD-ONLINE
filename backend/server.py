from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hmac
import hashlib
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta, timezone

import httpx
import razorpay

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Razorpay config
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
DEMO_MODE = (
    not RAZORPAY_KEY_ID
    or RAZORPAY_KEY_ID.endswith('placeholder')
    or 'placeholder' in RAZORPAY_KEY_SECRET
)
rzp_client = None
if not DEMO_MODE:
    rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------- Models ----------------
class ProductBase(BaseModel):
    name: str
    description: str = ""
    price: float  # DP / selling price in INR — charged only to verified Altos ID holders
    mrp: float = 0  # Maximum Retail Price; what regular (non-verified) customers pay
    offer_price: float = 0  # Optional offer for regular customers (admin-set); 0 = no offer
    weight: str = ""  # e.g. "60 capsules", "30ml", "250g"
    category: str = "Supplements"
    image: str = ""
    stock: int = 100
    featured: bool = False


class ProductCreate(ProductBase):
    pass


class Product(ProductBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


class CartItemIn(BaseModel):
    id: str
    quantity: int = Field(gt=0, le=50)


class Customer(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    phone: str = Field(min_length=6, max_length=20)
    address: str = Field(min_length=5, max_length=600)


class CreateOrderRequest(BaseModel):
    items: List[CartItemIn] = Field(min_length=1)
    customer: Customer
    altos_verified: bool = False


class VerifyRequest(BaseModel):
    order_id: str
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


class DemoCompleteRequest(BaseModel):
    order_id: str


class ShiprocketConnectRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)


class OrderStatusUpdate(BaseModel):
    status: str  # paid | shipped | delivered
    awb: Optional[str] = None
    courier_name: Optional[str] = None
    tracking_url: Optional[str] = None


# ---------------- Product routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Altos World Store API", "demo_mode": DEMO_MODE}


@api_router.get("/products", response_model=List[Product])
async def list_products(category: Optional[str] = None):
    query = {}
    if category and category.lower() != "all":
        query["category"] = category
    docs = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Product(**d) for d in docs]


@api_router.get("/categories")
async def list_categories():
    cats = await db.products.distinct("category")
    return {"categories": sorted([c for c in cats if c])}


@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Product not found")
    return Product(**doc)


@api_router.post("/products", response_model=Product)
async def create_product(payload: ProductCreate):
    product = Product(**payload.dict())
    await db.products.insert_one(product.dict())
    return product


@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, payload: ProductCreate):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Product not found")
    updated = {**existing, **payload.dict()}
    await db.products.update_one({"id": product_id}, {"$set": payload.dict()})
    return Product(**updated)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"ok": True}


# ---------------- Checkout routes ----------------
def _unit_price(product: dict, altos_verified: bool) -> float:
    """DP price for verified Altos ID holders; offer price or MRP for everyone else."""
    if altos_verified:
        return float(product["price"])
    offer = float(product.get("offer_price") or 0)
    mrp = float(product.get("mrp") or 0)
    if offer > 0:
        return offer
    return mrp if mrp > 0 else float(product["price"])


async def _price_cart(items: List[CartItemIn], altos_verified: bool = False):
    total = 0.0
    snapshot = []
    for item in items:
        product = await db.products.find_one({"id": item.id}, {"_id": 0})
        if not product:
            raise HTTPException(400, f"Unknown product: {item.id}")
        unit = _unit_price(product, altos_verified)
        line = unit * item.quantity
        total += line
        snapshot.append({
            "id": item.id,
            "name": product["name"],
            "image": product.get("image", ""),
            "unit_price": unit,
            "quantity": item.quantity,
            "line_total": line,
        })
    return round(total, 2), snapshot


@api_router.post("/checkout/create-order")
async def create_order(payload: CreateOrderRequest):
    total, snapshot = await _price_cart(payload.items, payload.altos_verified)
    amount_paise = int(round(total * 100))
    order_id = str(uuid.uuid4())
    receipt = "rcpt_" + order_id[:30]

    razorpay_order_id = None
    if not DEMO_MODE:
        rp_order = rzp_client.order.create(data={
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "payment_capture": 1,
            "notes": {"fulfilment": "physical_goods"},
        })
        razorpay_order_id = rp_order["id"]

    order_doc = {
        "id": order_id,
        "receipt": receipt,
        "razorpay_order_id": razorpay_order_id,
        "amount": total,
        "amount_paise": amount_paise,
        "currency": "INR",
        "items": snapshot,
        "customer": payload.customer.dict(),
        "altos_verified": payload.altos_verified,
        "status": "created",
        "demo": DEMO_MODE,
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order_doc)

    return {
        "order_id": order_id,
        "razorpay_order_id": razorpay_order_id,
        "amount": total,
        "amount_paise": amount_paise,
        "currency": "INR",
        "key_id": RAZORPAY_KEY_ID if not DEMO_MODE else None,
        "demo": DEMO_MODE,
    }


@api_router.post("/checkout/verify")
async def verify_payment(payload: VerifyRequest):
    saved = await db.orders.find_one({"id": payload.order_id})
    if not saved:
        raise HTTPException(404, "Order not found")

    message = f'{saved["razorpay_order_id"]}|{payload.razorpay_payment_id}'
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, payload.razorpay_signature):
        raise HTTPException(400, "Invalid payment signature")

    await db.orders.update_one(
        {"id": payload.order_id, "status": {"$ne": "paid"}},
        {"$set": {
            "status": "paid",
            "razorpay_payment_id": payload.razorpay_payment_id,
            "paid_at": now_iso(),
        }},
    )
    return {"ok": True, "order_id": payload.order_id, "status": "paid"}


@api_router.post("/checkout/demo-complete")
async def demo_complete(payload: DemoCompleteRequest):
    saved = await db.orders.find_one({"id": payload.order_id})
    if not saved:
        raise HTTPException(404, "Order not found")
    if not saved.get("demo"):
        raise HTTPException(400, "Order is not a demo order")
    await db.orders.update_one(
        {"id": payload.order_id, "status": {"$ne": "paid"}},
        {"$set": {
            "status": "paid",
            "razorpay_payment_id": "demo_" + uuid.uuid4().hex[:12],
            "paid_at": now_iso(),
        }},
    )
    return {"ok": True, "order_id": payload.order_id, "status": "paid"}


@api_router.get("/orders")
async def list_orders():
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    return doc


ALLOWED_ORDER_STATUSES = {"paid", "shipped", "delivered"}


@api_router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: OrderStatusUpdate):
    if payload.status not in ALLOWED_ORDER_STATUSES:
        raise HTTPException(400, f"Status must be one of {sorted(ALLOWED_ORDER_STATUSES)}")
    update = {"status": payload.status}
    for field in ("awb", "courier_name", "tracking_url"):
        value = getattr(payload, field)
        if value is not None:
            update[field] = value
    if payload.status == "shipped":
        update["shipped_at"] = now_iso()
    if payload.status == "delivered":
        update["delivered_at"] = now_iso()
    res = await db.orders.update_one({"id": order_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Order not found")
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return doc


# ---------------- Shiprocket integration ----------------
SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external"


async def _shiprocket_token() -> str:
    doc = await db.integrations.find_one({"_id": "shiprocket"})
    if not doc:
        raise HTTPException(409, "Shiprocket account not linked")
    expires_at = doc.get("token_expires_at")
    if doc.get("token") and expires_at:
        try:
            if datetime.fromisoformat(expires_at) > datetime.now(timezone.utc) + timedelta(minutes=10):
                return doc["token"]
        except ValueError:
            pass
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{SHIPROCKET_BASE}/auth/login",
            json={"email": doc["email"], "password": doc["password"]},
        )
    if r.status_code != 200:
        raise HTTPException(502, "Shiprocket login failed — check your API user email/password")
    token = r.json().get("token")
    if not token:
        raise HTTPException(502, "Shiprocket returned no token")
    await db.integrations.update_one(
        {"_id": "shiprocket"},
        {"$set": {
            "token": token,
            "token_expires_at": (datetime.now(timezone.utc) + timedelta(days=9)).isoformat(),
        }},
    )
    return token


@api_router.get("/shiprocket/status")
async def shiprocket_status():
    doc = await db.integrations.find_one({"_id": "shiprocket"})
    return {"connected": bool(doc), "email": doc.get("email") if doc else None}


@api_router.post("/shiprocket/connect")
async def shiprocket_connect(payload: ShiprocketConnectRequest):
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{SHIPROCKET_BASE}/auth/login",
            json={"email": payload.email, "password": payload.password},
        )
    if r.status_code != 200:
        raise HTTPException(400, "Shiprocket login failed. Use your API user credentials (Shiprocket Panel → Settings → API → Configure).")
    token = r.json().get("token")
    if not token:
        raise HTTPException(502, "Shiprocket returned no token")
    await db.integrations.update_one(
        {"_id": "shiprocket"},
        {"$set": {
            "provider": "shiprocket",
            "email": payload.email,
            "password": payload.password,
            "token": token,
            "token_expires_at": (datetime.now(timezone.utc) + timedelta(days=9)).isoformat(),
            "connected_at": now_iso(),
        }},
        upsert=True,
    )
    return {"connected": True, "email": payload.email}


@api_router.post("/shiprocket/disconnect")
async def shiprocket_disconnect():
    await db.integrations.delete_one({"_id": "shiprocket"})
    return {"connected": False}


def _map_sr_status(raw: str) -> Optional[str]:
    s = (raw or "").upper()
    if "DELIVERED" in s:
        return "delivered"
    if "SHIPPED" in s or "IN TRANSIT" in s or "OUT FOR DELIVERY" in s or "PICKED" in s:
        return "shipped"
    return None


@api_router.post("/shiprocket/sync")
async def shiprocket_sync():
    """Pull recent Shiprocket orders and update matching local orders (match by order
    code — the first 8 chars of the local order id, or the full id — used as the
    Order ID when creating the shipment manually in Shiprocket)."""
    token = await _shiprocket_token()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{SHIPROCKET_BASE}/orders",
            params={"per_page": 100, "sort": "DESC"},
            headers={"Authorization": f"Bearer {token}"},
        )
    if r.status_code == 401:
        await db.integrations.update_one({"_id": "shiprocket"}, {"$unset": {"token": "", "token_expires_at": ""}})
        raise HTTPException(502, "Shiprocket session expired — tap Sync again")
    if r.status_code >= 400:
        raise HTTPException(502, f"Shiprocket request failed ({r.status_code})")

    sr_orders = r.json().get("data", []) or []
    by_channel_id = {}
    for so in sr_orders:
        cid = str(so.get("channel_order_id") or "").strip().lower().lstrip("#")
        if cid:
            by_channel_id[cid] = so

    local = await db.orders.find(
        {"status": {"$in": ["paid", "shipped"]}}, {"_id": 0}
    ).to_list(1000)

    updated = []
    for order in local:
        oid = str(order["id"]).lower()
        so = by_channel_id.get(oid) or by_channel_id.get(oid[:8])
        if not so:
            continue
        new_status = _map_sr_status(str(so.get("status", "")))
        if not new_status or new_status == order.get("status"):
            continue
        shipment = (so.get("shipments") or [{}])[0]
        awb = shipment.get("awb") or shipment.get("awb_code") or ""
        update = {
            "status": new_status,
            "awb": awb,
            "courier_name": shipment.get("courier") or so.get("courier_name") or "",
            "shiprocket_order_id": so.get("id"),
        }
        if awb:
            update["tracking_url"] = f"https://shiprocket.co/tracking/{awb}"
        if new_status == "shipped" and not order.get("shipped_at"):
            update["shipped_at"] = now_iso()
        if new_status == "delivered":
            update["delivered_at"] = now_iso()
        await db.orders.update_one({"id": order["id"]}, {"$set": update})
        updated.append({"id": order["id"], "status": new_status, "awb": awb})

    return {
        "checked": len(local),
        "shiprocket_orders": len(sr_orders),
        "updated": updated,
    }


# Razorpay hosted checkout inside a WebView (works in Expo Go)
@api_router.get("/checkout/webview/{order_id}", response_class=HTMLResponse)
async def checkout_webview(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    cust = order["customer"]
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<style>body{{margin:0;background:#FDFDF9;font-family:sans-serif;display:flex;height:100vh;align-items:center;justify-content:center;color:#2A2F2A}}</style>
</head>
<body>
<div>Loading secure payment…</div>
<script>
  var options = {{
    key: "{RAZORPAY_KEY_ID}",
    amount: "{order['amount_paise']}",
    currency: "INR",
    name: "Altos World",
    description: "Herbal supplements & skincare",
    order_id: "{order['razorpay_order_id']}",
    prefill: {{ name: "{cust['name']}", email: "{cust['email']}", contact: "{cust['phone']}" }},
    theme: {{ color: "#657962" }},
    handler: function (response) {{
      window.location.href = "https://botanica.callback/success?payment_id=" + response.razorpay_payment_id + "&order_id=" + response.razorpay_order_id + "&signature=" + response.razorpay_signature;
    }},
    modal: {{ ondismiss: function() {{ window.location.href = "https://botanica.callback/cancel"; }} }}
  }};
  var rzp = new Razorpay(options);
  rzp.on('payment.failed', function (){{ window.location.href = "https://botanica.callback/failed"; }});
  rzp.open();
</script>
</body>
</html>"""
    return HTMLResponse(content=html)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


SEED_PRODUCTS = [
    {
        "name": "Ashwagandha Root Extract",
        "description": "Traditional adaptogenic herb to support calm, balance, and everyday resilience. 60 vegetarian capsules, 600mg each.",
        "price": 499.0,
        "mrp": 699.0,
        "weight": "60 capsules",
        "category": "Supplements",
        "image": "https://images.unsplash.com/photo-1675016276166-816be56a8c11?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        "stock": 120,
        "featured": True,
    },
    {
        "name": "Vitamin C Radiance Serum",
        "description": "A lightweight botanical serum with stabilised Vitamin C to brighten and even skin tone. 30ml.",
        "price": 699.0,
        "mrp": 999.0,
        "weight": "30 ml",
        "category": "Skincare",
        "image": "https://images.pexels.com/photos/20171275/pexels-photo-20171275.jpeg?auto=compress&cs=tinysrgb&w=1000",
        "stock": 80,
        "featured": True,
    },
    {
        "name": "Turmeric & Ginger Blend",
        "description": "Golden wellness blend with curcumin and ginger to support natural inflammation response. 90 capsules.",
        "price": 549.0,
        "mrp": 749.0,
        "weight": "90 capsules",
        "category": "Supplements",
        "image": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        "stock": 100,
        "featured": False,
    },
    {
        "name": "Rosehip Facial Oil",
        "description": "Cold-pressed rosehip oil rich in essential fatty acids to nourish and restore skin overnight. 30ml.",
        "price": 799.0,
        "mrp": 1099.0,
        "weight": "30 ml",
        "category": "Skincare",
        "image": "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        "stock": 60,
        "featured": True,
    },
    {
        "name": "Spirulina Green Boost",
        "description": "Nutrient-dense blue-green algae for daily energy and vitality. 120 tablets.",
        "price": 649.0,
        "mrp": 899.0,
        "weight": "120 tablets",
        "category": "Supplements",
        "image": "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        "stock": 90,
        "featured": False,
    },
    {
        "name": "Aloe & Cucumber Gel",
        "description": "Soothing hydrating gel with pure aloe vera and cucumber extract for calm, refreshed skin. 100ml.",
        "price": 399.0,
        "mrp": 549.0,
        "weight": "100 ml",
        "category": "Skincare",
        "image": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        "stock": 110,
        "featured": False,
    },
]


@app.on_event("startup")
async def seed_data():
    count = await db.products.count_documents({})
    if count < len(SEED_PRODUCTS):
        for p in SEED_PRODUCTS:
            existing = await db.products.find_one({"name": p["name"]})
            if not existing:
                await db.products.insert_one(Product(**p).dict())
        logger.info("Seed check complete (had %d products)", count)

    # Backfill MRP / weight on existing seed products that predate these fields.
    for p in SEED_PRODUCTS:
        await db.products.update_one(
            {"name": p["name"], "$or": [{"mrp": {"$in": [0, None]}}, {"weight": {"$in": ["", None]}}]},
            {"$set": {"mrp": p["mrp"], "weight": p["weight"]}},
        )

    logger.info("Altos World Store API started. DEMO_MODE=%s", DEMO_MODE)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
