import { Linking } from "react-native";

export const STORE_WHATSAPP = "917735454828"; // Altos World support number

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

/** Opens a WhatsApp chat with the store admin for bulk order enquiries. */
export function openBulkOrderChat() {
  openWhatsApp(
    "Hi Altos World! I would like to place a *bulk order*. Please share pricing and availability details.",
    STORE_WHATSAPP,
  );
}

const GUARDIAN_LABEL: Record<string, string> = {
  S: "Son of",
  D: "Daughter of",
  W: "Wife of",
};

/** Formats a new Direct Seller registration as a WhatsApp message for the admin. */
export function registrationMessage(reg: {
  title: string;
  name: string;
  mobile: string;
  email: string;
  guardian_type: string;
  guardian_name: string;
  dob: string;
  address: string;
  nominee_name: string;
  nominee_relation: string;
}): string {
  const guardian = GUARDIAN_LABEL[reg.guardian_type] || "S/D/W of";
  return (
    `*Altos World — New Direct Seller Registration*\n\n` +
    `Title: ${reg.title}\n` +
    `Name: ${reg.name}\n` +
    `Mobile: ${reg.mobile}\n` +
    `Email: ${reg.email}\n` +
    `${guardian}: ${reg.guardian_name}\n` +
    `DOB: ${reg.dob}\n` +
    `Address: ${reg.address}\n` +
    `Nominee: ${reg.nominee_name} (${reg.nominee_relation})\n\n` +
    `Please generate the Altos ID & password and share with the applicant within 15 minutes.`
  );
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
