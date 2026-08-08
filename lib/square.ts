import crypto from "node:crypto";
import { config } from "./config";

export type SquareMoney = {
  amount?: number;
  currency?: string;
};

export type SquarePayment = {
  id?: string;
  status?: string;
  order_id?: string;
  location_id?: string;
  created_at?: string;
  updated_at?: string;
  source_type?: string;
  amount_money?: SquareMoney;
  card_details?: {
    card?: {
      card_brand?: string;
      last_4?: string;
    };
  };
};

export type SquareOrder = {
  id?: string;
  location_id?: string;
  line_items?: Array<{
    uid?: string;
    name?: string;
    variation_name?: string;
    quantity?: string;
  }>;
};

export type SquareWebhook = {
  merchant_id?: string;
  type?: string;
  event_id?: string;
  created_at?: string;
  data?: {
    type?: string;
    id?: string;
    object?: {
      payment?: SquarePayment;
    };
  };
};

export function verifySquareSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const payload = config.squareNotificationUrl() + rawBody;
  const expected = crypto
    .createHmac("sha256", config.squareSignatureKey())
    .update(payload, "utf8")
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function retrieveSquareOrder(orderId: string): Promise<SquareOrder> {
  const response = await fetch(
    `https://connect.squareup.com/v2/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.squareAccessToken()}`,
        "Square-Version": config.squareApiVersion(),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Square RetrieveOrder failed (${response.status}): ${body}`);
  }

  const parsed = JSON.parse(body);
  if (!parsed.order) throw new Error("Square RetrieveOrder returned no order.");

  return parsed.order as SquareOrder;
}

export function squarePaymentType(payment: SquarePayment): string {
  if (payment.card_details?.card?.card_brand) {
    return payment.card_details.card.card_brand.toLowerCase();
  }
  if (payment.source_type) return payment.source_type.toLowerCase();
  return "unknown";
}
