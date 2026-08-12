import { Linking } from "react-native";

const waPhone = (phone?: string): string => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `91${digits}` : digits;
};

/** Opens WhatsApp with a pre-filled message. With a phone it opens that chat;
 * without one it lets the user pick the chat. */
export function openWhatsApp(text: string, phone?: string) {
  const p = waPhone(phone);
  const url = p
    ? `https://wa.me/${p}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  Linking.openURL(url).catch(() => {});
}

export const orderCode = (id: string) => `#${String(id).slice(0, 8).toUpperCase()}`;

const itemLines = (order: any): string =>
  (order.items || []).map((i: any) => `• ${i.name} × ${i.quantity}`).join("\n");

export function orderConfirmationMessage(order: any): string {
  return (
    `*Altos World — Order Confirmed*\n\n` +
    `Order ${orderCode(order.id)}\n${itemLines(order)}\n\n` +
    `Total paid: ₹${order.amount}\n\n` +
    `Hi ${order.customer?.name || "there"}, thank you for shopping with Altos World (Cuttack Super Zone). ` +
    `We'll message you the tracking details as soon as your order ships.`
  );
}

export function shippingUpdateMessage(order: any): string {
  let tracking = "";
  if (order.courier_name) tracking += `Courier: ${order.courier_name}\n`;
  if (order.awb) tracking += `AWB / Tracking no: ${order.awb}\n`;
  if (order.tracking_url) tracking += `Track here: ${order.tracking_url}\n`;
  return (
    `*Altos World — Order Shipped!*\n\n` +
    `Hi ${order.customer?.name || "there"}, great news — your order ${orderCode(order.id)} is on its way.\n\n` +
    `${itemLines(order)}\n\n` +
    (tracking ? `${tracking}\n` : "") +
    `Thank you for shopping with Altos World (Cuttack Super Zone).`
  );
}
