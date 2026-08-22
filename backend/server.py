from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse, Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
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
    dosage: str = ""  # recommended dosage text shown on the product page
    images: List[str] = Field(default_factory=list, max_length=4)  # extra product photos
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
    altos_verified: bool = False
    phone: str = Field(default="", max_length=20)


class Review(ReviewIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    created_at: str = Field(default_factory=now_iso)


class DiseaseIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    product_ids: List[str] = Field(default_factory=list)
    dosages: dict = Field(default_factory=dict)  # product_id -> dosage text


class Disease(DiseaseIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


class BannerIn(BaseModel):
    image: str = Field(min_length=1, max_length=1000)


class Banner(BannerIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


class CertificateIn(BaseModel):
    image: str = Field(min_length=1, max_length=1000)


class Certificate(CertificateIn):
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
    coupon_code: str = Field(default="", max_length=30)
    payment_mode: str = Field(default="full")  # full | partial_cod


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


class CouponIn(BaseModel):
    code: str = Field(min_length=3, max_length=20)
    description: str = Field(default="", max_length=200)
    discount_type: str = Field(default="percent")  # percent | flat
    value: float = Field(gt=0)
    audience: str = Field(default="non_altos")  # altos | non_altos
    min_order: float = Field(default=0, ge=0)
    start_date: str = Field(min_length=10, max_length=10)  # YYYY-MM-DD
    end_date: str = Field(min_length=10, max_length=10)  # YYYY-MM-DD
    active: bool = True


class Coupon(CouponIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


class CouponValidateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    phone: str = Field(default="", max_length=20)
    altos_verified: bool = False
    subtotal: float = 0


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


BASE_CATEGORIES = ["Supplements", "Skincare", "Hair Care", "Home Care", "Personal Care", "Agriculture/Veterinary"]


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
    # Reviews are allowed for Altos ID holders, or non-Altos customers who purchased this product.
    if not payload.altos_verified:
        norm = _norm_phone(payload.phone)
        if len(norm) < 10:
            raise HTTPException(400, "Enter the mobile number you used to purchase this product")
        purchased = False
        docs = await db.orders.find(
            {"status": {"$ne": "created"}}, {"_id": 0, "customer.phone": 1, "items.id": 1}
        ).to_list(5000)
        for o in docs:
            if _norm_phone(o.get("customer", {}).get("phone", "")) != norm:
                continue
            if any(i.get("id") == product_id for i in o.get("items", [])):
                purchased = True
                break
        if not purchased:
            raise HTTPException(
                403,
                "Only Altos ID holders or customers who purchased this product can leave a review",
            )
    data = payload.dict()
    data.pop("altos_verified", None)
    data.pop("phone", None)
    review = Review(product_id=product_id, **data)
    doc = review.dict()
    doc["verified_buyer"] = not payload.altos_verified
    doc["altos_holder"] = payload.altos_verified
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc


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


# ---------------- Certificates (About Us) ----------------
@api_router.get("/certificates")
async def list_certificates():
    return await db.certificates.find({}, {"_id": 0}).sort("created_at", 1).to_list(50)


@api_router.post("/certificates")
async def add_certificate(payload: CertificateIn):
    cert = Certificate(**payload.dict())
    await db.certificates.insert_one(cert.dict())
    return cert.dict()


@api_router.delete("/certificates/{cert_id}")
async def delete_certificate(cert_id: str):
    res = await db.certificates.delete_one({"id": cert_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Certificate not found")
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


@api_router.get("/diseases/{disease_id}")
async def get_disease(disease_id: str):
    doc = await db.diseases.find_one({"id": disease_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Disease not found")
    return doc


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


ALLOWED_VIDEO_TYPES = {"video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm"}
MAX_VIDEO_BYTES = 50 * 1024 * 1024


@api_router.post("/upload/video")
async def upload_video(file: UploadFile = File(...)):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(400, "Only MP4, MOV or WEBM videos are allowed")
    data = await file.read()
    if len(data) > MAX_VIDEO_BYTES:
        raise HTTPException(400, "Video too large (max 50 MB)")
    path = f"{APP_NAME}/uploads/vlogs/{uuid.uuid4().hex}.{ALLOWED_VIDEO_TYPES[content_type]}"
    try:
        result = await run_in_threadpool(_put_object, path, data, content_type)
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 502
        if status == 402:
            raise HTTPException(402, "Storage credits exhausted — video uploads paused")
        raise HTTPException(502, "Video upload failed, please try again")
    return {"path": result["path"], "video_url": f"/api/files/{result['path']}"}


# ---------------- Blogs & Vlogs ----------------
class PostIn(BaseModel):
    type: str = Field(default="blog")  # blog | vlog
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(default="", max_length=20000)  # blog text
    cover_image: str = Field(default="", max_length=500)
    video_url: str = Field(default="", max_length=500)  # uploaded video
    youtube_url: str = Field(default="", max_length=500)


class Post(PostIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


def _validate_post(data: dict):
    if data["type"] not in ("blog", "vlog"):
        raise HTTPException(400, "type must be 'blog' or 'vlog'")
    if data["type"] == "blog" and not data["content"].strip():
        raise HTTPException(400, "Blog content is required")
    if data["type"] == "vlog" and not (data["video_url"] or data["youtube_url"]):
        raise HTTPException(400, "Upload a video or add a YouTube link for the vlog")


@api_router.get("/posts")
async def list_posts():
    return await db.posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)


@api_router.get("/posts/{post_id}")
async def get_post(post_id: str):
    doc = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Post not found")
    return doc


@api_router.post("/posts")
async def create_post(payload: PostIn):
    data = payload.dict()
    _validate_post(data)
    post = Post(**data)
    await db.posts.insert_one(post.dict())
    return post.dict()


@api_router.put("/posts/{post_id}")
async def update_post(post_id: str, payload: PostIn):
    data = payload.dict()
    _validate_post(data)
    res = await db.posts.update_one({"id": post_id}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(404, "Post not found")
    return await db.posts.find_one({"id": post_id}, {"_id": 0})


@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str):
    res = await db.posts.delete_one({"id": post_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Post not found")
    return {"ok": True}


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


# ---------------- Direct Seller Registration ----------------
class RegistrationIn(BaseModel):
    title: str = Field(default="Mr", max_length=10)  # Mr | Mrs | Ms | Dr
    name: str = Field(min_length=1, max_length=120)
    mobile: str = Field(min_length=6, max_length=20)
    email: str = Field(min_length=3, max_length=254)
    guardian_type: str = Field(default="S", max_length=2)  # S | D | W (Son/Daughter/Wife of)
    guardian_name: str = Field(min_length=1, max_length=120)  # S/D/W of ...
    dob: str = Field(min_length=1, max_length=20)  # YYYY-MM-DD
    address: str = Field(min_length=5, max_length=600)
    nominee_name: str = Field(min_length=1, max_length=120)
    nominee_relation: str = Field(min_length=1, max_length=60)


class Registration(RegistrationIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pdf_url: str = ""
    created_at: str = Field(default_factory=now_iso)


_GUARDIAN_LABEL = {"S": "Son of", "D": "Daughter of", "W": "Wife of"}


def _build_registration_pdf(reg: dict) -> bytes:
    from fpdf import FPDF

    pdf = FPDF(format="A4")
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Header
    pdf.set_fill_color(199, 0, 23)
    pdf.rect(0, 0, 210, 26, "F")
    pdf.set_xy(10, 7)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, "Altos World Online Store", ln=1)
    pdf.set_x(10)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 6, "Direct Seller Registration Form", ln=1)

    pdf.ln(14)
    pdf.set_text_color(30, 30, 30)

    guardian = _GUARDIAN_LABEL.get(reg.get("guardian_type", "S"), "S/D/W of")
    rows = [
        ("Title", reg.get("title", "")),
        ("Full Name", reg.get("name", "")),
        ("Mobile Number", reg.get("mobile", "")),
        ("Email ID", reg.get("email", "")),
        (guardian, reg.get("guardian_name", "")),
        ("Date of Birth", reg.get("dob", "")),
        ("Address", reg.get("address", "")),
        ("Nominee Name", reg.get("nominee_name", "")),
        ("Relation with Nominee", reg.get("nominee_relation", "")),
    ]

    label_w = 55
    val_w = 125
    for label, value in rows:
        pdf.set_x(10)
        y_start = pdf.get_y()
        pdf.set_font("Helvetica", "B", 11)
        pdf.multi_cell(label_w, 7, f"{label}", border=0)
        y_after_label = pdf.get_y()
        pdf.set_xy(10 + label_w, y_start)
        pdf.set_font("Helvetica", "", 11)
        pdf.multi_cell(val_w, 7, f": {value}", border=0)
        y_after_val = pdf.get_y()
        pdf.set_y(max(y_after_label, y_after_val))
        pdf.set_draw_color(220, 220, 220)
        pdf.line(10, pdf.get_y() + 1, 195, pdf.get_y() + 1)
        pdf.ln(3)

    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(120, 120, 120)
    pdf.set_x(10)
    pdf.multi_cell(185, 5, f"Submitted on {reg.get('created_at', '')}", border=0)
    pdf.set_x(10)
    pdf.multi_cell(
        185, 5,
        "Note: Altos ID and password will be shared with the applicant within 15 minutes "
        "via WhatsApp and text message.",
        border=0,
    )

    out = pdf.output()
    return bytes(out)


@api_router.get("/registrations")
async def list_registrations():
    return await db.registrations.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/registrations")
async def create_registration(payload: RegistrationIn):
    reg = Registration(**payload.dict())
    doc = reg.dict()
    try:
        pdf_bytes = await run_in_threadpool(_build_registration_pdf, doc)
        path = f"{APP_NAME}/registrations/{reg.id}.pdf"
        result = await run_in_threadpool(_put_object, path, pdf_bytes, "application/pdf")
        doc["pdf_url"] = f"/api/files/{result['path']}"
    except Exception as e:  # noqa: BLE001
        logger.warning("Registration PDF generation/upload failed: %s", e)
        doc["pdf_url"] = ""
    await db.registrations.insert_one(doc)
    return {"id": reg.id, "pdf_url": doc["pdf_url"], "created_at": doc["created_at"]}


@api_router.delete("/registrations/{reg_id}")
async def delete_registration(reg_id: str):
    res = await db.registrations.delete_one({"id": reg_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Registration not found")
    return {"ok": True}


# ---------------- Store Settings (shipping + minimum order) ----------------
class SettingsIn(BaseModel):
    shipping_mode: str = Field(default="weight")  # weight | flat
    free_upto_grams: float = Field(default=3000, ge=0)
    mid_upto_grams: float = Field(default=5000, ge=0)
    mid_charge: float = Field(default=50, ge=0)
    high_charge: float = Field(default=100, ge=0)
    flat_charge: float = Field(default=50, ge=0)
    free_above_amount: float = Field(default=0, ge=0)
    min_purchase_regular: float = Field(default=399, ge=0)
    min_purchase_altos: float = Field(default=599, ge=0)
    youtube_url: str = Field(default="", max_length=300)
    facebook_url: str = Field(default="", max_length=300)
    instagram_url: str = Field(default="", max_length=300)
    x_url: str = Field(default="", max_length=300)


@api_router.get("/settings")
async def get_settings():
    return await _get_settings()


@api_router.put("/settings")
async def update_settings(payload: SettingsIn):
    data = payload.dict()
    if data["shipping_mode"] not in ("weight", "flat"):
        raise HTTPException(400, "shipping_mode must be 'weight' or 'flat'")
    await db.settings.update_one({"_id": "store"}, {"$set": data}, upsert=True)
    return await _get_settings()


# ---------------- Customer order lookup by mobile ----------------
@api_router.get("/orders/lookup")
async def lookup_orders(phone: str):
    norm = _norm_phone(phone)
    if len(norm) < 10:
        raise HTTPException(400, "Enter a valid 10-digit mobile number")
    docs = await db.orders.find(
        {"status": {"$ne": "created"}}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    out = []
    for o in docs:
        if _norm_phone(o.get("customer", {}).get("phone", "")) != norm:
            continue
        out.append({
            "id": o["id"],
            "created_at": o.get("created_at"),
            "status": o.get("status"),
            "items": [
                {"name": i.get("name"), "quantity": i.get("quantity"), "line_total": i.get("line_total")}
                for i in o.get("items", [])
            ],
            "amount": o.get("amount"),
            "total_billing": o.get("total_billing") or o.get("amount"),
            "payment_mode": o.get("payment_mode", "full"),
            "cod_due": o.get("cod_due", 0),
            "awb": o.get("awb"),
            "courier_name": o.get("courier_name"),
            "tracking_url": o.get("tracking_url"),
        })
    return out


# ---------------- Monthly Sales Report (paid orders) ----------------
_MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _month_label(month: str) -> str:
    """'2026-08' -> 'August 2026'"""
    try:
        y, m = month.split("-")
        return f"{_MONTH_NAMES[int(m) - 1]} {y}"
    except Exception:  # noqa: BLE001
        return month


def _order_month(order: dict) -> str:
    """Bucket a paid order by paid_at (fallback created_at), first 7 chars = YYYY-MM."""
    d = order.get("paid_at") or order.get("created_at") or ""
    return d[:7]


def _order_date(order: dict) -> str:
    d = order.get("paid_at") or order.get("created_at") or ""
    return d[:10]


def _items_count(order: dict) -> int:
    return sum(int(i.get("quantity") or 0) for i in order.get("items", []))


async def _paid_orders_for_month(month: str) -> List[dict]:
    docs = await db.orders.find({"status": "paid"}, {"_id": 0}).to_list(5000)
    rows = [o for o in docs if _order_month(o) == month]
    rows.sort(key=lambda o: o.get("paid_at") or o.get("created_at") or "")
    return rows


def _order_value(order: dict) -> float:
    """Full billing value of the order (partial-COD orders store 30% in `amount`)."""
    return float(order.get("total_billing") or order.get("amount") or 0)


def _summarise(rows: List[dict]) -> dict:
    return {
        "total_orders": len(rows),
        "total_revenue": round(sum(_order_value(o) for o in rows), 2),
        "total_items": sum(_items_count(o) for o in rows),
        "total_bv": round(sum(float(o.get("total_bv") or 0) for o in rows), 1),
        "total_discount": round(sum(float(o.get("discount") or 0) for o in rows), 2),
    }


@api_router.get("/reports/sales/available-months")
async def report_available_months():
    docs = await db.orders.find({"status": "paid"}, {"_id": 0, "paid_at": 1, "created_at": 1}).to_list(5000)
    counts: dict = {}
    for o in docs:
        m = _order_month(o)
        if len(m) == 7:
            counts[m] = counts.get(m, 0) + 1
    months = sorted(counts.keys(), reverse=True)
    return [{"month": m, "label": _month_label(m), "orders": counts[m]} for m in months]


def _build_sales_csv(month: str, rows: List[dict], summary: dict) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Altos World Online Store - Monthly Sales Report"])
    w.writerow([f"Month: {_month_label(month)}"])
    w.writerow([])
    w.writerow(["Total Orders", summary["total_orders"]])
    w.writerow(["Total Revenue (INR)", summary["total_revenue"]])
    w.writerow(["Total Items Sold", summary["total_items"]])
    w.writerow(["Total BV", summary["total_bv"]])
    w.writerow(["Total Discount Given (INR)", summary["total_discount"]])
    w.writerow([])
    w.writerow(["Date", "Order #", "Customer", "Phone", "Items", "Amount (INR)", "Payment", "COD Due (INR)", "Status"])
    for o in rows:
        w.writerow([
            _order_date(o),
            str(o.get("id", ""))[:8].upper(),
            o.get("customer", {}).get("name", ""),
            o.get("customer", {}).get("phone", ""),
            _items_count(o),
            _order_value(o),
            "Partial COD" if o.get("payment_mode") == "partial_cod" else "Full Online",
            float(o.get("cod_due") or 0),
            o.get("status", ""),
        ])
    return buf.getvalue().encode("utf-8")


def _build_sales_pdf(month: str, rows: List[dict], summary: dict) -> bytes:
    from fpdf import FPDF

    pdf = FPDF(orientation="L", format="A4")
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=12)

    pdf.set_fill_color(199, 0, 23)
    pdf.rect(0, 0, 297, 24, "F")
    pdf.set_xy(10, 6)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 8, "Altos World Online Store", ln=1)
    pdf.set_x(10)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 6, f"Monthly Sales Report - {_month_label(month)}", ln=1)

    pdf.ln(12)
    pdf.set_text_color(30, 30, 30)

    # Summary
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_x(10)
    pdf.cell(0, 7, "Summary", ln=1)
    pdf.set_font("Helvetica", "", 10)
    summ = [
        ("Total Orders", str(summary["total_orders"])),
        ("Total Revenue", f"INR {summary['total_revenue']:.2f}"),
        ("Total Items Sold", str(summary["total_items"])),
        ("Total BV", f"{summary['total_bv']:g}"),
        ("Total Discount Given", f"INR {summary['total_discount']:.2f}"),
    ]
    for label, val in summ:
        pdf.set_x(10)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(55, 6, label, border=0)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, f": {val}", ln=1)

    pdf.ln(4)

    # Table header
    headers = ["Date", "Order #", "Customer", "Phone", "Items", "Amount", "Payment", "COD Due", "Status"]
    widths = [24, 24, 58, 30, 14, 30, 34, 28, 24]
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(240, 240, 240)
    pdf.set_x(10)
    for h, wd in zip(headers, widths):
        pdf.cell(wd, 8, h, border=1, fill=True)
    pdf.ln(8)

    pdf.set_font("Helvetica", "", 9)
    for o in rows:
        cust = (o.get("customer", {}).get("name", "") or "")[:28]
        partial = o.get("payment_mode") == "partial_cod"
        cells = [
            _order_date(o),
            str(o.get("id", ""))[:8].upper(),
            cust,
            o.get("customer", {}).get("phone", ""),
            str(_items_count(o)),
            f"{_order_value(o):.2f}",
            "Partial COD" if partial else "Full Online",
            f"{float(o.get('cod_due') or 0):.2f}",
            o.get("status", ""),
        ]
        pdf.set_x(10)
        for c, wd in zip(cells, widths):
            pdf.cell(wd, 7, str(c), border=1)
        pdf.ln(7)

    if not rows:
        pdf.set_x(10)
        pdf.set_font("Helvetica", "I", 10)
        pdf.cell(0, 8, "No paid orders in this month.", ln=1)

    out = pdf.output()
    return bytes(out)


@api_router.get("/reports/sales")
async def download_sales_report(month: str, format: str = "pdf"):
    if not (len(month) == 7 and month[4] == "-"):
        raise HTTPException(400, "month must be in YYYY-MM format")
    rows = await _paid_orders_for_month(month)
    summary = _summarise(rows)
    fmt = format.lower()
    if fmt == "csv":
        data = _build_sales_csv(month, rows, summary)
        return Response(
            content=data,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="sales-report-{month}.csv"'},
        )
    data = await run_in_threadpool(_build_sales_pdf, month, rows, summary)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="sales-report-{month}.pdf"'},
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

# Partial COD: advance fraction charged online (rest collected on delivery). Non-Altos only.
COD_ADVANCE_RATE = 0.30


# Store settings defaults (admin-editable via /api/settings).
DEFAULT_SETTINGS = {
    "shipping_mode": "weight",  # "weight" | "flat"
    # weight-based tiers
    "free_upto_grams": 3000,
    "mid_upto_grams": 5000,
    "mid_charge": 50.0,
    "high_charge": 100.0,
    # flat-rate mode
    "flat_charge": 50.0,
    "free_above_amount": 0,  # 0 = never free
    # minimum order value
    "min_purchase_regular": 399.0,
    "min_purchase_altos": 599.0,
    # social media links (shown in menu; empty = hidden)
    "youtube_url": "",
    "facebook_url": "",
    "instagram_url": "",
    "x_url": "",
}


async def _get_settings() -> dict:
    doc = await db.settings.find_one({"_id": "store"}, {"_id": 0})
    merged = {**DEFAULT_SETTINGS, **(doc or {})}
    return merged


async def _min_purchase(altos_verified: bool) -> float:
    s = await _get_settings()
    return float(s["min_purchase_altos"] if altos_verified else s["min_purchase_regular"])


def _shipping_charge(total_weight_g: float, subtotal: float, s: dict) -> float:
    if s.get("shipping_mode") == "flat":
        free_above = float(s.get("free_above_amount") or 0)
        if free_above > 0 and subtotal >= free_above:
            return 0.0
        return float(s.get("flat_charge") or 0)
    # weight-based tiers
    if total_weight_g > float(s.get("mid_upto_grams") or 5000):
        return float(s.get("high_charge") or 0)
    if total_weight_g > float(s.get("free_upto_grams") or 3000):
        return float(s.get("mid_charge") or 0)
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
    s = await _get_settings()
    shipping = _shipping_charge(total_weight, subtotal, s)
    total = round(subtotal + shipping, 2)
    return round(subtotal, 2), shipping, round(total_weight, 1), round(total_bv, 1), total, snapshot


# ---------------- Coupons ----------------
def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _norm_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def _coupon_discount(coupon: dict, subtotal: float) -> float:
    if coupon.get("discount_type") == "percent":
        d = subtotal * float(coupon["value"]) / 100.0
    else:
        d = float(coupon["value"])
    return round(min(d, subtotal), 2)


async def _check_coupon(code: str, phone: str, altos_verified: bool, subtotal: float):
    """Validate a coupon for this customer. Returns (coupon, discount) or raises HTTPException."""
    coupon = await db.coupons.find_one({"code": code.strip().upper()}, {"_id": 0})
    if not coupon:
        raise HTTPException(400, "Invalid coupon code")
    if not coupon.get("active", True):
        raise HTTPException(400, "This coupon is no longer active")
    today = _today_str()
    if coupon.get("start_date") and today < coupon["start_date"]:
        raise HTTPException(400, f"Coupon valid from {coupon['start_date']}")
    if coupon.get("end_date") and today > coupon["end_date"]:
        raise HTTPException(400, "This coupon has expired")
    audience = coupon.get("audience", "non_altos")
    if audience == "altos" and not altos_verified:
        raise HTTPException(400, "This coupon is only for Altos ID holders")
    if audience == "non_altos" and altos_verified:
        raise HTTPException(400, "This coupon is only for non-Altos customers")
    min_order = float(coupon.get("min_order") or 0)
    if subtotal < min_order:
        raise HTTPException(400, f"Minimum order of ₹{min_order:g} required for this coupon")
    norm = _norm_phone(phone)
    if not norm:
        raise HTTPException(400, "Enter your mobile number to use a coupon")
    used = await db.coupon_redemptions.find_one({"coupon_id": coupon["id"], "phone": norm})
    if used:
        raise HTTPException(400, "This coupon was already used with this mobile number")
    return coupon, _coupon_discount(coupon, subtotal)


async def _record_redemption(order: dict):
    """Record one-time coupon usage per mobile number after successful payment."""
    if not order.get("coupon_id"):
        return
    norm = _norm_phone(order.get("customer", {}).get("phone", ""))
    existing = await db.coupon_redemptions.find_one({"coupon_id": order["coupon_id"], "phone": norm})
    if not existing:
        await db.coupon_redemptions.insert_one({
            "id": str(uuid.uuid4()),
            "coupon_id": order["coupon_id"],
            "code": order.get("coupon_code", ""),
            "phone": norm,
            "order_id": order["id"],
            "created_at": now_iso(),
        })


@api_router.get("/coupons")
async def list_coupons():
    docs = await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for c in docs:
        c["used_count"] = await db.coupon_redemptions.count_documents({"coupon_id": c["id"]})
    return docs


def _validate_coupon_fields(data: dict):
    if data["discount_type"] not in ("percent", "flat"):
        raise HTTPException(400, "discount_type must be percent or flat")
    if data["audience"] not in ("altos", "non_altos"):
        raise HTTPException(400, "audience must be altos or non_altos")
    if data["discount_type"] == "percent" and data["value"] > 100:
        raise HTTPException(400, "Percent discount cannot exceed 100")
    if data["end_date"] < data["start_date"]:
        raise HTTPException(400, "End date must be after start date")


@api_router.post("/coupons")
async def create_coupon(payload: CouponIn):
    data = payload.dict()
    data["code"] = data["code"].strip().upper()
    _validate_coupon_fields(data)
    if await db.coupons.find_one({"code": data["code"]}):
        raise HTTPException(400, "A coupon with this code already exists")
    coupon = Coupon(**data)
    await db.coupons.insert_one(coupon.dict())
    return coupon.dict()


@api_router.put("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, payload: CouponIn):
    data = payload.dict()
    data["code"] = data["code"].strip().upper()
    _validate_coupon_fields(data)
    if await db.coupons.find_one({"code": data["code"], "id": {"$ne": coupon_id}}):
        raise HTTPException(400, "A coupon with this code already exists")
    res = await db.coupons.update_one({"id": coupon_id}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(404, "Coupon not found")
    return await db.coupons.find_one({"id": coupon_id}, {"_id": 0})


@api_router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str):
    res = await db.coupons.delete_one({"id": coupon_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Coupon not found")
    return {"ok": True}


@api_router.get("/coupons/available")
async def available_coupons(altos: bool = False, phone: str = "", subtotal: float = 0):
    audience = "altos" if altos else "non_altos"
    today = _today_str()
    docs = await db.coupons.find(
        {"audience": audience, "active": True, "start_date": {"$lte": today}, "end_date": {"$gte": today}},
        {"_id": 0},
    ).sort("value", -1).to_list(100)
    norm = _norm_phone(phone)
    out = []
    for c in docs:
        if norm and await db.coupon_redemptions.find_one({"coupon_id": c["id"], "phone": norm}):
            continue
        c["eligible"] = subtotal >= float(c.get("min_order") or 0)
        c["discount_preview"] = _coupon_discount(c, subtotal) if c["eligible"] else 0
        out.append(c)
    return out


@api_router.post("/coupons/validate")
async def validate_coupon(payload: CouponValidateRequest):
    coupon, discount = await _check_coupon(
        payload.code, payload.phone, payload.altos_verified, payload.subtotal
    )
    return {"valid": True, "code": coupon["code"], "coupon_id": coupon["id"], "discount": discount}


@api_router.post("/checkout/create-order")
async def create_order(payload: CreateOrderRequest):
    subtotal, shipping, total_weight, total_bv, total, snapshot = await _price_cart(
        payload.items, payload.altos_verified
    )
    min_purchase = await _min_purchase(payload.altos_verified)
    if subtotal < min_purchase:
        who = "Altos ID holders" if payload.altos_verified else "orders"
        raise HTTPException(
            400,
            f"Minimum purchase for {who} is ₹{min_purchase:g}. Please add ₹{min_purchase - subtotal:.2f} more.",
        )
    coupon = None
    discount = 0.0
    if payload.coupon_code.strip():
        coupon, discount = await _check_coupon(
            payload.coupon_code, payload.customer.phone, payload.altos_verified, subtotal
        )
        total = round(subtotal - discount + shipping, 2)

    # Payment mode: full online, or partial COD (30% advance online, 70% on delivery).
    # Partial COD is only available to non-Altos customers.
    mode = payload.payment_mode if payload.payment_mode in ("full", "partial_cod") else "full"
    if mode == "partial_cod" and payload.altos_verified:
        raise HTTPException(400, "Partial COD is not available for Altos ID holders")
    total_billing = total
    if mode == "partial_cod":
        charge_amount = round(total_billing * COD_ADVANCE_RATE, 2)
        cod_due = round(total_billing - charge_amount, 2)
    else:
        charge_amount = total_billing
        cod_due = 0.0

    amount_paise = int(round(charge_amount * 100))
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
        "amount": charge_amount,
        "amount_paise": amount_paise,
        "payment_mode": mode,
        "total_billing": total_billing,
        "advance_amount": charge_amount if mode == "partial_cod" else 0,
        "cod_due": cod_due,
        "subtotal": subtotal,
        "shipping_charge": shipping,
        "coupon_code": coupon["code"] if coupon else "",
        "coupon_id": coupon["id"] if coupon else "",
        "discount": discount,
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
        "amount": charge_amount,
        "amount_paise": amount_paise,
        "payment_mode": mode,
        "total_billing": total_billing,
        "cod_due": cod_due,
        "subtotal": subtotal,
        "shipping_charge": shipping,
        "coupon_code": coupon["code"] if coupon else "",
        "discount": discount,
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
    await _record_redemption(saved)
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
    await _record_redemption(saved)
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
    if _sr_waf_blocked(r):
        raise HTTPException(
            400,
            "Shiprocket is blocking requests from this development server. Sync will work after the app is deployed.",
        )
    if r.status_code != 200:
        raise HTTPException(400, "Shiprocket login failed — check your API user email/password")
    token = r.json().get("token")
    if not token:
        raise HTTPException(400, "Shiprocket returned no token")
    await db.integrations.update_one(
        {"_id": "shiprocket"},
        {"$set": {
            "token": token,
            "verified": True,
            "token_expires_at": (datetime.now(timezone.utc) + timedelta(days=9)).isoformat(),
        }},
    )
    return token


def _sr_waf_blocked(resp) -> bool:
    """Shiprocket's WAF returns a 403 HTML page when it blocks a server IP
    (common for datacenter/dev environments). Distinguish that from bad credentials."""
    return resp.status_code == 403 and "<html" in (resp.text or "").lower()


@api_router.get("/shiprocket/status")
async def shiprocket_status():
    doc = await db.integrations.find_one({"_id": "shiprocket"})
    return {
        "connected": bool(doc),
        "email": doc.get("email") if doc else None,
        "verified": bool(doc.get("verified")) if doc else False,
    }


@api_router.post("/shiprocket/connect")
async def shiprocket_connect(payload: ShiprocketConnectRequest):
    verified = False
    token = None
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"{SHIPROCKET_BASE}/auth/login",
                json={"email": payload.email, "password": payload.password},
            )
    except httpx.HTTPError:
        r = None
    if r is not None:
        if r.status_code == 200:
            token = r.json().get("token")
            verified = bool(token)
        elif not _sr_waf_blocked(r):
            raise HTTPException(
                400,
                "Shiprocket login failed. Use your API user credentials (Shiprocket Panel → Settings → API → Configure).",
            )
    update = {
        "provider": "shiprocket",
        "email": payload.email,
        "password": payload.password,
        "verified": verified,
        "connected_at": now_iso(),
    }
    if token:
        update["token"] = token
        update["token_expires_at"] = (datetime.now(timezone.utc) + timedelta(days=9)).isoformat()
    await db.integrations.update_one({"_id": "shiprocket"}, {"$set": update}, upsert=True)
    return {
        "connected": True,
        "email": payload.email,
        "verified": verified,
        "warning": None if verified else (
            "Credentials saved, but Shiprocket is blocking requests from this development server. "
            "The link will verify automatically once the app is deployed."
        ),
    }


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
        raise HTTPException(400, "Shiprocket session expired — tap Sync again")
    if r.status_code >= 400:
        raise HTTPException(400, f"Shiprocket request failed ({r.status_code})")

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
    config: {{
      display: {{
        blocks: {{
          upi: {{
            name: "Pay via UPI",
            instruments: [ {{ method: "upi", flows: ["collect", "intent", "qr"] }} ]
          }}
        }},
        sequence: ["block.upi"],
        preferences: {{ show_default_blocks: true }}
      }}
    }},
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
