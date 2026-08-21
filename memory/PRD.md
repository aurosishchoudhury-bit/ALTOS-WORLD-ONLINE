# PRD — Altos World Online Store (Cuttack Superzone)

## Product
Mobile app (Expo + FastAPI + MongoDB) for online purchase of herbal supplements & skincare products.
- Guest checkout only (no user accounts). Special WebView session login for Altos ID holders.
- Clean & minimal design, branded "Altos World Online Store".

## Completed Features
- Product catalog with categories, search, bestsellers row. Categories (June 2026): Supplements, Skincare, Hair Care, Home Care, Personal Care, Agriculture/Veterinary (BASE_CATEGORIES in server.py + CATEGORY_OPTIONS in admin/product-form.tsx).
- Dynamic pricing: verified Altos ID holders see DP price (`price`) + BV; guests see `offer_price`. MRP strikethrough shown.
- Altos ID WebView login with auto-logout session (AltosAuthContext)
- BV (Business Volume) totals + gated WhatsApp Instant BV button
- Weight-based shipping calculation, max-qty constraints for heavy items
- Minimum purchase (June 2026): cart subtotal must be ≥ ₹399 for non-Altos customers and ≥ ₹599 for Altos ID holders. Enforced in backend /checkout/create-order and shown in cart (notice + disabled checkout button with "Add ₹X more"). Constants in backend server.py (_min_purchase) and frontend pricing.ts (minPurchaseFor).
- Partial COD (June 2026): non-Altos customers can choose at checkout between "Pay Full Online" and "Partial COD (pay 30% now via Razorpay, remaining 70% cash on delivery)". Altos ID holders always pay full online (COD rejected backend-side). Order stores payment_mode, total_billing, advance_amount, cod_due; amount = online charge. order-success + WhatsApp confirmation show the split. Sales report Amount uses full billing and adds Payment mode + COD Due columns. Backend: COD_ADVANCE_RATE=0.30 in server.py.
- Multi-image products (up to 4) via Emergent Object Storage + full-screen image viewer
- Home banners (auto-scroll carousel, admin gallery uploads) — displayed in 9:16 PORTRAIT ratio (changed from 16:9 on user request, June 2026), width capped at 420 and centered on wide screens; the old "Rooted in Nature" hero image was removed so banners are the first visual under the logo.
- Admin dashboard: products CRUD, orders, low-stock alerts, banners, certificates, diseases
- Shop by Disease: home button, list with search bar, disease detail with "Recommended Dosage" table (product name + dosage), admin dosage input per mapped product — VERIFIED WORKING (June 2026)
- Product info card (June 2026): every product page shows dispatch/delivery timeline ("dispatched within 2 days, delivered within 7–10 days"), shipping charges (free ≤3kg, ₹50 3–5kg, ₹100 >5kg), and "Partial COD available" line (shown only to non-Altos users).
- Product dosage box (June 2026): products have a `dosage` text field (admin product form input "Dosage (shown on product page)"). When set, a "Dosage" box appears under the product description on the product page.
- Customer ratings & reviews, packing/weight info display. Review gating (June 2026): only Altos ID holders OR non-Altos customers who purchased that product (validated by mobile number against non-"created" orders containing the product id) can review. Non-Altos form shows "Mobile number used at purchase" field; backend POST /products/{id}/reviews takes altos_verified + phone, returns 403 otherwise. Reviews store verified_buyer/altos_holder flags.
- About Us + downloadable certificates gallery, WhatsApp support FAB
- Bulk Orders via WhatsApp (June 2026): "For Bulk Orders — Click Here" green button at bottom of home page + menu item in hamburger drawer; both open WhatsApp chat with admin (917735454828) with pre-filled bulk order message.
- Direct Seller Registration (June 2026): "Register as a Direct Seller" link on home (non-verified) + hamburger menu → /register form (title Mr/Mrs/Ms/Dr, name, mobile, email, S/D/W of + guardian name, DOB, address, nominee name & relation). On submit: backend generates a PDF (fpdf2) stored in Object Storage, saves record, and opens WhatsApp to admin with all details as text (option 1-b). Disclaimer shown: Altos ID & password shared within 15 min via WhatsApp/SMS, keep for future purchases. Admin → "Registrations" screen lists submissions with PDF download + delete. Backend: /api/registrations GET/POST/DELETE.
- Franchise enquiry (June 2026): "Want to become a Franchise Centre? Click Here" hamburger menu item → opens WhatsApp to admin with franchise enquiry message.
- Monthly Sales Report (June 2026): Admin → "Sales Reports" screen lists months with paid orders; download each as PDF or Excel/CSV. Report has summary (total orders, revenue, items, BV, discount) + per-order table (date, order#, customer, phone, items, amount, status). Only PAID orders included; bucketed by paid_at (fallback created_at). Backend: /api/reports/sales/available-months, /api/reports/sales?month=YYYY-MM&format=pdf|csv.
- Order success + WhatsApp order confirmation; manual Shiprocket status toggles in admin
- Coupons/discounts (June 2026): admin creates coupons (percent or flat, audience: Altos ID holders vs non-Altos, optional min order, start/end dates, active flag) at /admin/coupons. Customers tap "Apply Coupon" at checkout to see available offers; one use per mobile number (recorded in coupon_redemptions on payment success). Fully tested — iteration_8.json.

## Key Schemas
- products: {id, name, description, price(DP), mrp, offer_price, weight_grams, weight, category, stock, images[], bv, featured}
- diseases: {id, name, product_ids[], dosages: {product_id: dosage_text}}
- coupons: {id, code, description, discount_type(percent|flat), value, audience(altos|non_altos), min_order, start_date, end_date, active}
- coupon_redemptions: {id, coupon_id, code, phone(normalized last 10 digits), order_id}
- orders: {id, items, total, total_bv, status, customer}
- banners/certificates: {id, image_url}

## Pending / Upcoming
1. **Razorpay LIVE keys (P0)** — TEST keys connected (June 2026): rzp_test_TS4UDRJIbLGJab in backend/.env, DEMO_MODE=false, real Razorpay checkout sheet loads in webview (cards/EMI/netbanking/wallet/UPI). UPI pinned as first block via checkout config.display.blocks (QR + intent + collect flows) — verified visible with mobile UA. Swap to rzp_live_ keys in backend/.env when user's KYC is done to accept real money.
2. **Total Savings in cart (P1)** — show savings vs MRP at cart/checkout.
3. **Shiprocket verification (P2)** — account LINKED (altosworldonline@gmail.com, creds in db.integrations doc _id="shiprocket"). Shiprocket WAF blocks this dev environment IP (403 HTML on all endpoints) so verified=false; token/verification + "Sync shipping status" auto-activate from production after deploy. Connect endpoint stores creds on WAF block (verified=false) and errors return 400 (not 502 — Cloudflare replaces 502 bodies).

## Notes
- Store settings (June 2026): admin → "Store Settings" (/admin/settings) controls shipping (mode: weight-based tiers OR flat rate + free-above-amount) and minimum order values (non-Altos & Altos). Backend db.settings doc _id="store" with DEFAULT_SETTINGS fallback; _get_settings/_shipping_charge/_min_purchase read it (min_purchase now async). GET/PUT /api/settings. Product shipping-info text and cart min-purchase read live from settings.
- Order lookup (June 2026): customers → hamburger "Track My Orders" (/orders) enter mobile → GET /api/orders/lookup?phone= returns their non-"created" orders with items, totals, COD due, and Shiprocket tracking_url/courier when available.
- Vibrant palette (June 2026): theme.ts colors brightened — brand #3E8E4C (vibrant herbal green), success #2E9E5B, warning #E8963E, error #D9534F, greener surface tints (#F1F7EC etc.). All components consume theme constants so change is global.
- Social media links (June 2026): settings fields youtube_url/facebook_url/instagram_url/x_url (editable in Admin → Store Settings, blank = icon hidden). Icons (FontAwesome) shown at bottom of hamburger menu drawer, open via Linking. Placeholder links (@altosworld handles) currently seeded — admin should replace with real URLs.
- No auth anywhere by design; admin tab openly accessible.
- Backend: /app/backend/server.py (single file). Frontend routes in /app/frontend/app.
- Test creds file: /app/memory/test_credentials.md (no creds needed — guest app).
