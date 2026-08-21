const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BASE}/api`;

/** Product images uploaded via the app are stored as relative paths (/api/files/...). */
export const resolveImageUri = (uri?: string): string =>
  uri && uri.startsWith("/") ? `${BASE}${uri}` : uri || "";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  mrp: number;
  offer_price: number;
  bestseller?: boolean;
  bv?: number;
  weight: string;
  weight_grams?: number;
  dosage?: string;
  category: string;
  image: string;
  images?: string[];
  stock: number;
  featured: boolean;
  rating_avg?: number;
  rating_count?: number;
  created_at?: string;
};

export type Customer = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

async function handle(res: Response) {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  async listProducts(category?: string): Promise<Product[]> {
    const q = category && category !== "All" ? `?category=${encodeURIComponent(category)}` : "";
    return handle(await fetch(`${API}/products${q}`));
  },
  async getProduct(id: string): Promise<Product> {
    return handle(await fetch(`${API}/products/${id}`));
  },
  async categories(): Promise<string[]> {
    const j = await handle(await fetch(`${API}/categories`));
    return j.categories ?? [];
  },
  async createProduct(data: Partial<Product>): Promise<Product> {
    return handle(
      await fetch(`${API}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  },
  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    return handle(
      await fetch(`${API}/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  },
  async deleteProduct(id: string): Promise<void> {
    await handle(await fetch(`${API}/products/${id}`, { method: "DELETE" }));
  },
  async createOrder(
    items: { id: string; quantity: number }[],
    customer: Customer,
    altosVerified: boolean,
    couponCode = "",
    paymentMode: "full" | "partial_cod" = "full",
  ) {
    return handle(
      await fetch(`${API}/checkout/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          customer,
          altos_verified: altosVerified,
          coupon_code: couponCode,
          payment_mode: paymentMode,
        }),
      }),
    );
  },
  async demoComplete(orderId: string) {
    return handle(
      await fetch(`${API}/checkout/demo-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      }),
    );
  },
  async verify(payload: {
    order_id: string;
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) {
    return handle(
      await fetch(`${API}/checkout/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },
  async getOrder(orderId: string) {
    return handle(await fetch(`${API}/orders/${orderId}`));
  },
  async listOrders(): Promise<any[]> {
    return handle(await fetch(`${API}/orders`));
  },
  async getReviews(productId: string): Promise<{ reviews: any[]; rating_avg: number; rating_count: number }> {
    return handle(await fetch(`${API}/products/${productId}/reviews`));
  },
  async listBanners(): Promise<any[]> {
    return handle(await fetch(`${API}/banners`));
  },
  async addBanner(image: string) {
    return handle(
      await fetch(`${API}/banners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      }),
    );
  },
  async deleteBanner(id: string) {
    return handle(await fetch(`${API}/banners/${id}`, { method: "DELETE" }));
  },
  async listCertificates(): Promise<any[]> {
    return handle(await fetch(`${API}/certificates`));
  },
  async addCertificate(image: string) {
    return handle(
      await fetch(`${API}/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      }),
    );
  },
  async deleteCertificate(id: string) {
    return handle(await fetch(`${API}/certificates/${id}`, { method: "DELETE" }));
  },
  async listDiseases(): Promise<any[]> {
    return handle(await fetch(`${API}/diseases`));
  },
  async getDisease(id: string): Promise<any> {
    return handle(await fetch(`${API}/diseases/${id}`));
  },
  async createDisease(data: { name: string; product_ids: string[]; dosages?: Record<string, string> }) {
    return handle(
      await fetch(`${API}/diseases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  },
  async updateDisease(id: string, data: { name: string; product_ids: string[]; dosages?: Record<string, string> }) {
    return handle(
      await fetch(`${API}/diseases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  },
  async deleteDisease(id: string) {
    return handle(await fetch(`${API}/diseases/${id}`, { method: "DELETE" }));
  },
  async getDiseaseProducts(id: string): Promise<Product[]> {
    return handle(await fetch(`${API}/diseases/${id}/products`));
  },
  async addReview(
    productId: string,
    data: { name: string; rating: number; comment: string; altos_verified: boolean; phone?: string },
  ) {
    return handle(
      await fetch(`${API}/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  },
  async updateOrderStatus(
    orderId: string,
    data: { status: string; awb?: string; courier_name?: string; tracking_url?: string },
  ) {
    return handle(
      await fetch(`${API}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  },
  async shiprocketStatus(): Promise<{ connected: boolean; email?: string }> {
    return handle(await fetch(`${API}/shiprocket/status`));
  },
  async shiprocketConnect(email: string, password: string) {
    return handle(
      await fetch(`${API}/shiprocket/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );
  },
  async shiprocketDisconnect() {
    return handle(await fetch(`${API}/shiprocket/disconnect`, { method: "POST" }));
  },
  async shiprocketSync(): Promise<{ checked: number; shiprocket_orders: number; updated: any[] }> {
    return handle(await fetch(`${API}/shiprocket/sync`, { method: "POST" }));
  },
  async getSettings(): Promise<any> {
    return handle(await fetch(`${API}/settings`));
  },
  async updateSettings(data: any): Promise<any> {
    return handle(
      await fetch(`${API}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  },
  async lookupOrders(phone: string): Promise<any[]> {
    return handle(await fetch(`${API}/orders/lookup?phone=${encodeURIComponent(phone)}`));
  },
  async listCoupons(): Promise<any[]> {
    return handle(await fetch(`${API}/coupons`));
  },
  async createCoupon(data: any) {
    return handle(
      await fetch(`${API}/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  },
  async updateCoupon(id: string, data: any) {
    return handle(
      await fetch(`${API}/coupons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  },
  async deleteCoupon(id: string) {
    return handle(await fetch(`${API}/coupons/${id}`, { method: "DELETE" }));
  },
  async availableCoupons(altos: boolean, phone: string, subtotal: number): Promise<any[]> {
    const q = `?altos=${altos}&phone=${encodeURIComponent(phone)}&subtotal=${subtotal}`;
    return handle(await fetch(`${API}/coupons/available${q}`));
  },
  async validateCoupon(code: string, phone: string, altosVerified: boolean, subtotal: number) {
    return handle(
      await fetch(`${API}/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone, altos_verified: altosVerified, subtotal }),
      }),
    );
  },
  async createRegistration(data: any) {
    return handle(
      await fetch(`${API}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
  },
  async listRegistrations(): Promise<any[]> {
    return handle(await fetch(`${API}/registrations`));
  },
  async deleteRegistration(id: string) {
    return handle(await fetch(`${API}/registrations/${id}`, { method: "DELETE" }));
  },
  async reportMonths(): Promise<{ month: string; label: string; orders: number }[]> {
    return handle(await fetch(`${API}/reports/sales/available-months`));
  },
  salesReportUrl(month: string, format: "pdf" | "csv"): string {
    return `${API}/reports/sales?month=${month}&format=${format}`;
  },
  webviewUrl(orderId: string): string {
    return `${API}/checkout/webview/${orderId}`;
  },
};
