# PRD — Altos World Online Store (Cuttack Superzone)

## Product
Mobile app (Expo + FastAPI + MongoDB) for online purchase of herbal supplements & skincare products.
- Guest checkout only (no user accounts). Special WebView session login for Altos ID holders.
- Clean & minimal design, branded "Altos World Online Store".

## Completed Features
- Product catalog with categories, search, bestsellers row
- Dynamic pricing: verified Altos ID holders see DP price (`price`) + BV; guests see `offer_price`. MRP strikethrough shown.
- Altos ID WebView login with auto-logout session (AltosAuthContext)
- BV (Business Volume) totals + gated WhatsApp Instant BV button
- Weight-based shipping calculation, max-qty constraints for heavy items
- Minimum purchase (June 2026): cart subtotal must be ≥ ₹399 for non-Altos customers and ≥ ₹599 for Altos ID holders. Enforced in backend /checkout/create-order and shown in cart (notice + disabled checkout button with "Add ₹X more"). Constants in backend server.py (_min_purchase) and frontend pricing.ts (minPurchaseFor).
- Multi-image products (up to 4) via Emergent Object Storage + full-screen image viewer
- Home banners (auto-scroll carousel, admin gallery uploads)
- Admin dashboard: products CRUD, orders, low-stock alerts, banners, certificates, diseases
- Shop by Disease: home button, list with search bar, disease detail with "Recommended Dosage" table (product name + dosage), admin dosage input per mapped product — VERIFIED WORKING (June 2026)
- Customer ratings & reviews, packing/weight info display
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
1. **Razorpay real keys (P0)** — checkout currently in DEMO_MODE (mocked). User will provide Key ID & Secret later; backend auto-switches when keys added to backend/.env.
2. **Total Savings in cart (P1)** — show savings vs MRP at cart/checkout.
3. **Shiprocket API integration (P2)** — currently manual admin toggles; needs user API creds.

## Notes
- No auth anywhere by design; admin tab openly accessible.
- Backend: /app/backend/server.py (single file). Frontend routes in /app/frontend/app.
- Test creds file: /app/memory/test_credentials.md (no creds needed — guest app).
