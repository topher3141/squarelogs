import type { ReceiptRecord } from "@/lib/receipts";

type SquareMoney = { amount?: number; currency?: string };

type SquarePayment = {
  id?: string;
  order_id?: string;
  receipt_number?: string;
  receipt_url?: string;
  created_at?: string;
  updated_at?: string;
  amount_money?: SquareMoney;
  source_type?: string;
  device_details?: { device_id?: string; device_name?: string };
  card_details?: { card?: { card_brand?: string; last_4?: string } };
  external_details?: { type?: string; source?: string };
};

type SquareOrder = {
  line_items?: Array<{
    name?: string;
    quantity?: string;
    total_money?: SquareMoney;
  }>;
};

function qty(value?: string) {
  const n = Number(value || "1");
  return Number.isFinite(n) ? n : 1;
}

function paymentType(payment: SquarePayment) {
  if (payment.source_type === "CASH") return "Cash";
  if (payment.source_type === "EXTERNAL") {
    return payment.external_details?.source || payment.external_details?.type || "External";
  }
  if (payment.source_type === "CARD") {
    return payment.card_details?.card?.card_brand || "Card";
  }
  return payment.source_type || "Unknown";
}

export function buildReceiptRecord(args: {
  payment: SquarePayment;
  order: SquareOrder;
  protectEventId?: string;
}): ReceiptRecord {
  const { payment, order, protectEventId } = args;

  if (!payment.id) throw new Error("Cannot store receipt without payment.id");
  if (!payment.order_id) throw new Error("Cannot store receipt without order_id");

  const rawTimestamp = payment.updated_at || payment.created_at;
  const timestamp = rawTimestamp ? Date.parse(rawTimestamp) : Date.now();
  const consoleId = process.env.UNIFI_CONSOLE_ID;
  const cameraId = process.env.UNIFI_CAMERA_ID;

  if (!consoleId || !cameraId) {
    throw new Error("UNIFI_CONSOLE_ID and UNIFI_CAMERA_ID are required");
  }

  const footageStart = Math.max(0, timestamp - 20_000);
const footageUrl =
  `https://unifi.ui.com/consoles/${consoleId}` +
  `/protect/timelapse/${cameraId}` +
  `?start=${footageStart}`;
  
  return {
    paymentId: payment.id,
    orderId: payment.order_id,
    receiptNumber: payment.receipt_number || payment.id.slice(0, 8),
    amount: (payment.amount_money?.amount || 0) / 100,
    currency: payment.amount_money?.currency || "USD",
    timestamp,
    createdAt: payment.created_at,
    deviceName: payment.device_details?.device_name,
    deviceId: payment.device_details?.device_id,
    paymentType: paymentType(payment),
    cardBrand: payment.card_details?.card?.card_brand,
    receiptUrl: payment.receipt_url,
    items: (order.line_items || []).map((item) => ({
      title: item.name || "Item",
      quantity: qty(item.quantity),
      amount:
        typeof item.total_money?.amount === "number"
          ? item.total_money.amount / 100
          : undefined,
    })),
    footageUrl,
    protectEventId,
  };
}
