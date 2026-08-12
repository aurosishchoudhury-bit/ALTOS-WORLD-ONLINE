const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BASE}/api`;

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  mrp: number;
  offer_price: number;
  weight: string;
  category: string;
  image: string;
  stock: number;
  featured: boolean;
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
  ) {
    return handle(
      await fetch(`${API}/checkout/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, customer, altos_verified: altosVerified }),
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
  webviewUrl(orderId: string): string {
    return `${API}/checkout/webview/${orderId}`;
  },
};
