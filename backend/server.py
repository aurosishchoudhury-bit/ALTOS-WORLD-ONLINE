from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse, Response
from fastapi.concurrency import run_in_threadpool
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
import requests
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


# ---------------- Emergent Object Storage ----------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "altos-world"
storage_key = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def _put_object(path: str, data: bytes, content_type: str) -> dict:
    global storage_key
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 503:  # stale storage key — re-init once
        storage_key = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def _get_object(path: str):
    global storage_key
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        storage_key = None
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------- Models ----------------
class ProductBase(BaseModel):
    name: str
    description: str = ""
    price: float  # DP / selling price in INR — charged only to verified Altos ID holders
    mrp: float = 0  # Maximum Retail Price; what regular (non-verified) customers pay
    offer_price: float = 0  # Optional offer for regular customers (admin-set); 0 = no offer
    bestseller: bool = False  # Featured in the Bestsellers row on home
    bv: float = 0  # Business Volume points (visible to Altos ID holders)
    weight: str = ""  # display text, e.g. "60 capsules", "30ml", "250g"
    weight_grams: float = 0  # numeric weight used for shipping calculation
    category: str = "Supplements"
    image: str = ""
    stock: int = 100
    featured: bool = False


class ProductCreate(ProductBase):
    pass


class Product(ProductBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)
    rating_avg: float = 0  # computed from reviews, not stored
    rating_count: int = 0


class ReviewIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


class Review(ReviewIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    created_at: str = Field(default_factory=now_iso)


class DiseaseIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    product_ids: List[str] = Field(default_factory=list)


class Disease(DiseaseIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


class BannerIn(BaseModel):
    image: str = Field(min_length=1, max_length=1000)


class Banner(BannerIn):
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
    altos_id: str = Field(default="", max_length=60)


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


async def _rating_map(product_ids: List[str]) -> dict:
    pipeline = [
        {"$match": {"product_id": {"$in": product_ids}}},
        {"$group": {"_id": "$product_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    out = {}
    async for row in db.reviews.aggregate(pipeline):
        out[row["_id"]] = {"rating_avg": round(row["avg"], 1), "rating_count": row["count"]}
    return out


@api_router.get("/products", response_model=List[Product])
async def list_products(category: Optional[str] = None):
    query = {}
    if category and category.lower() != "all":
        query["category"] = category
    docs = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    ratings = await _rating_map([d["id"] for d in docs])
    return [Product(**{**d, **ratings.get(d["id"], {})}) for d in docs]


BASE_CATEGORIES = ["Supplements", "Skincare", "Home Care", "Personal Care"]


@api_router.get("/categories")
async def list_categories():
    cats = await db.products.distinct("category")
    return {"categories": sorted({c for c in cats if c} | set(BASE_CATEGORIES))}


@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Product not found")
    ratings = await _rating_map([product_id])
    return Product(**{**doc, **ratings.get(product_id, {})})


# ---------------- Reviews ----------------
@api_router.get("/products/{product_id}/reviews")
async def list_reviews(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(500)
    ratings = await _rating_map([product_id])
    summary = ratings.get(product_id, {"rating_avg": 0, "rating_count": 0})
    return {"reviews": reviews, **summary}


@api_router.post("/products/{product_id}/reviews")
async def add_review(product_id: str, payload: ReviewIn):
    product = await db.products.find_one({"id": product_id}, {"_id": 0, "id": 1})
    if not product:
        raise HTTPException(404, "Product not found")
    review = Review(product_id=product_id, **payload.dict())
    await db.reviews.insert_one(review.dict())
    return review.dict()


# ---------------- Home banners ----------------
MAX_BANNERS = 4


@api_router.get("/banners")
async def list_banners():
    return await db.banners.find({}, {"_id": 0}).sort("created_at", 1).to_list(MAX_BANNERS)


@api_router.post("/banners")
async def add_banner(payload: BannerIn):
    count = await db.banners.count_documents({})
    if count >= MAX_BANNERS:
        raise HTTPException(400, f"Maximum {MAX_BANNERS} banners allowed — delete one first")
    banner = Banner(**payload.dict())
    await db.banners.insert_one(banner.dict())
    return banner.dict()


@api_router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: str):
    res = await db.banners.delete_one({"id": banner_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Banner not found")
    return {"deleted": True}


# ---------------- Diseases (shop by health concern) ----------------
@api_router.get("/diseases")
async def list_diseases():
    docs = await db.diseases.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return [{**d, "product_count": len(d.get("product_ids", []))} for d in docs]


@api_router.post("/diseases")
async def create_disease(payload: DiseaseIn):
    disease = Disease(**payload.dict())
    await db.diseases.insert_one(disease.dict())
    return disease.dict()


@api_router.put("/diseases/{disease_id}")
async def update_disease(disease_id: str, payload: DiseaseIn):
    res = await db.diseases.update_one({"id": disease_id}, {"$set": payload.dict()})
    if res.matched_count == 0:
        raise HTTPException(404, "Disease not found")
    doc = await db.diseases.find_one({"id": disease_id}, {"_id": 0})
    return doc


@api_router.delete("/diseases/{disease_id}")
async def delete_disease(disease_id: str):
    res = await db.diseases.delete_one({"id": disease_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Disease not found")
    return {"deleted": True}


@api_router.get("/diseases/{disease_id}/products", response_model=List[Product])
async def disease_products(disease_id: str):
    doc = await db.diseases.find_one({"id": disease_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Disease not found")
    ids = doc.get("product_ids", [])
    docs = await db.products.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    ratings = await _rating_map([d["id"] for d in docs])
    return [Product(**{**d, **ratings.get(d["id"], {})}) for d in docs]


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


# ---------------- Image upload (Emergent Object Storage) ----------------
ALLOWED_IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


@api_router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Only JPG, PNG or WEBP images are allowed")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "Image too large (max 5 MB)")
    path = f"{APP_NAME}/uploads/products/{uuid.uuid4().hex}.{ALLOWED_IMAGE_TYPES[content_type]}"
    try:
        result = await run_in_threadpool(_put_object, path, data, content_type)
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 502
        if status == 402:
            raise HTTPException(402, "Storage credits exhausted — image uploads paused")
        raise HTTPException(502, "Image upload failed, please try again")
    return {"path": result["path"], "image_url": f"/api/files/{result['path']}"}


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    if not path.startswith(f"{APP_NAME}/"):
        raise HTTPException(404, "File not found")
    try:
        content, content_type = await run_in_threadpool(_get_object, path)
    except requests.HTTPError:
        raise HTTPException(404, "File not found")
    return Response(
        content=content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


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


# Shipping: free up to 3kg, Rs.50 above 3kg up to 5kg, Rs.100 above 5kg.
HEAVY_ITEM_THRESHOLD_G = 500  # items weighing >= 500g are limited per order
HEAVY_ITEM_MAX_QTY = 2


def _shipping_charge(total_weight_g: float) -> float:
    if total_weight_g > 5000:
        return 100.0
    if total_weight_g > 3000:
        return 50.0
    return 0.0


async def _price_cart(items: List[CartItemIn], altos_verified: bool = False):
    subtotal = 0.0
    total_weight = 0.0
    total_bv = 0.0
    snapshot = []
    ids = [item.id for item in items]
    docs = await db.products.find({"id": {"$in": ids}}, {"_id": 0}).to_list(len(ids))
    products = {p["id"]: p for p in docs}
    for item in items:
        product = products.get(item.id)
        if not product:
            raise HTTPException(400, f"Unknown product: {item.id}")
        grams = float(product.get("weight_grams") or 0)
        if grams >= HEAVY_ITEM_THRESHOLD_G and item.quantity > HEAVY_ITEM_MAX_QTY:
            raise HTTPException(
                400,
                f"Only {HEAVY_ITEM_MAX_QTY} pcs of {product['name']} allowed per order (500g+ item)",
            )
        unit = _unit_price(product, altos_verified)
        line = unit * item.quantity
        subtotal += line
        total_weight += grams * item.quantity
        item_bv = float(product.get("bv") or 0)
        total_bv += item_bv * item.quantity
        snapshot.append({
            "id": item.id,
            "name": product["name"],
            "image": product.get("image", ""),
            "unit_price": unit,
            "quantity": item.quantity,
            "line_total": line,
            "weight_grams": grams,
            "bv": item_bv,
        })
    shipping = _shipping_charge(total_weight)
    total = round(subtotal + shipping, 2)
    return round(subtotal, 2), shipping, round(total_weight, 1), round(total_bv, 1), total, snapshot


@api_router.post("/checkout/create-order")
async def create_order(payload: CreateOrderRequest):
    subtotal, shipping, total_weight, total_bv, total, snapshot = await _price_cart(
        payload.items, payload.altos_verified
    )
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
        "subtotal": subtotal,
        "shipping_charge": shipping,
        "total_weight_grams": total_weight,
        "total_bv": total_bv if payload.altos_verified else 0,
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
        "subtotal": subtotal,
        "shipping_charge": shipping,
        "total_weight_grams": total_weight,
        "total_bv": total_bv if payload.altos_verified else 0,
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
        "weight_grams": 120,
        "bv": 30,
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
        "weight_grams": 100,
        "bv": 45,
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
        "weight_grams": 180,
        "bv": 40,
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
        "weight_grams": 100,
        "bv": 50,
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
        "weight_grams": 220,
        "bv": 35,
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
        "weight_grams": 180,
        "bv": 25,
        "category": "Skincare",
        "image": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        "stock": 110,
        "featured": False,
    },
]


@app.on_event("startup")
async def seed_data():
    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage initialised")
    except Exception as e:
        logger.warning("Object storage init failed: %s", e)

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
        await db.products.update_one(
            {"name": p["name"], "weight_grams": {"$in": [0, None]}},
            {"$set": {"weight_grams": p["weight_grams"]}},
        )
        await db.products.update_one(
            {"name": p["name"], "bv": {"$in": [0, None]}},
            {"$set": {"bv": p["bv"]}},
        )

    logger.info("Altos World Store API started. DEMO_MODE=%s", DEMO_MODE)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
