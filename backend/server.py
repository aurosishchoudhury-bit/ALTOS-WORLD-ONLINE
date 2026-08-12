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
from datetime import datetime, timezone

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
    price: float  # in INR (rupees)
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


class VerifyRequest(BaseModel):
    order_id: str
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


class DemoCompleteRequest(BaseModel):
    order_id: str


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
async def _price_cart(items: List[CartItemIn]):
    total = 0.0
    snapshot = []
    for item in items:
        product = await db.products.find_one({"id": item.id}, {"_id": 0})
        if not product:
            raise HTTPException(400, f"Unknown product: {item.id}")
        line = float(product["price"]) * item.quantity
        total += line
        snapshot.append({
            "id": item.id,
            "name": product["name"],
            "image": product.get("image", ""),
            "unit_price": float(product["price"]),
            "quantity": item.quantity,
            "line_total": line,
        })
    return round(total, 2), snapshot


@api_router.post("/checkout/create-order")
async def create_order(payload: CreateOrderRequest):
    total, snapshot = await _price_cart(payload.items)
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
        "category": "Supplements",
        "image": "https://images.unsplash.com/photo-1675016276166-816be56a8c11?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        "stock": 120,
        "featured": True,
    },
    {
        "name": "Vitamin C Radiance Serum",
        "description": "A lightweight botanical serum with stabilised Vitamin C to brighten and even skin tone. 30ml.",
        "price": 699.0,
        "category": "Skincare",
        "image": "https://images.pexels.com/photos/20171275/pexels-photo-20171275.jpeg?auto=compress&cs=tinysrgb&w=1000",
        "stock": 80,
        "featured": True,
    },
    {
        "name": "Turmeric & Ginger Blend",
        "description": "Golden wellness blend with curcumin and ginger to support natural inflammation response. 90 capsules.",
        "price": 549.0,
        "category": "Supplements",
        "image": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        "stock": 100,
        "featured": False,
    },
    {
        "name": "Rosehip Facial Oil",
        "description": "Cold-pressed rosehip oil rich in essential fatty acids to nourish and restore skin overnight. 30ml.",
        "price": 799.0,
        "category": "Skincare",
        "image": "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        "stock": 60,
        "featured": True,
    },
    {
        "name": "Spirulina Green Boost",
        "description": "Nutrient-dense blue-green algae for daily energy and vitality. 120 tablets.",
        "price": 649.0,
        "category": "Supplements",
        "image": "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        "stock": 90,
        "featured": False,
    },
    {
        "name": "Aloe & Cucumber Gel",
        "description": "Soothing hydrating gel with pure aloe vera and cucumber extract for calm, refreshed skin. 100ml.",
        "price": 399.0,
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
    logger.info("Altos World Store API started. DEMO_MODE=%s", DEMO_MODE)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
