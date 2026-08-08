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
  cash_details?: unknown;
  external_details?: {
    type?: string;
    source?: string;
  };
  device_details?: {
    device_id?: string;
    device_name?: string;
    device_installation_id?: string;
  };
  application_details?: {
    square_product?: string;
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

function squareHeaders() {
  return {
    Authorization: `Bearer ${config.squareAccessToken()}`,
    "Square-Version": config.squareApiVersion(),
    "Content-Type": "application/json",
  };
}

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

export async function listRecentSquarePayments(
  beginTimeIso: string,
  endTimeIso: string
): Promise<SquarePayment[]> {
  const params = new URLSearchParams({
    begin_time: beginTimeIso,
    end_time: endTimeIso,
    sort_order: "ASC",
    limit: "100",
    location_id: config.squareLocationId(),
  });

  const response = await fetch(
    `https://connect.squareup.com/v2/payments?${params.toString()}`,
    {
      method: "GET",
      headers: squareHeaders(),
      cache: "no-store",
    }
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Square ListPayments failed (${response.status}): ${body}`);
  }

  const parsed = JSON.parse(body);
  return (parsed.payments ?? []) as SquarePayment[];
}

export async function retrieveSquareOrder(orderId: string): Promise<SquareOrder> {
  const response = await fetch(
    `https://connect.squareup.com/v2/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: squareHeaders(),
      cache: "no-store",
    }
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Square RetrieveOrder failed (${response.status}): ${body}`);
  }

  const parsed = JSON.parse(body);

  if (!parsed.order) {
    throw new Error("Square RetrieveOrder returned no order.");
  }

  return parsed.order as SquareOrder;
}

export function squarePaymentType(payment: SquarePayment): string {
  if (payment.source_type === "CASH") return "cash";

  if (payment.source_type === "EXTERNAL") {
    return payment.external_details?.source?.trim().toLowerCase() || "external";
  }

  if (payment.card_details?.card?.card_brand) {
    return payment.card_details.card.card_brand.toLowerCase();
  }

  if (payment.source_type) return payment.source_type.toLowerCase();

  return "unknown";
}
