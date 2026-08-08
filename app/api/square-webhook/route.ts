import { NextRequest, NextResponse } from "next/server";
import { config } from "../../../lib/config";
import {
  retrieveSquareOrder,
  squarePaymentType,
  SquareWebhook,
  verifySquareSignature,
} from "../../../lib/square";
import { ProtectTransaction, sendProtectTransaction } from "../../../lib/unifi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function quantityToInteger(quantity?: string): number {
  const n = Number(quantity ?? "1");
  if (!Number.isFinite(n) || n <= 0) return 1;

  // Protect's POS schema shows quantity as an integer.
  // Square can support decimal quantities, so round to the closest visible unit.
  return Math.max(1, Math.round(n));
}

function titleFor(item: { name?: string; variation_name?: string }): string {
  const base = item.name?.trim() || "Item";
  const variation = item.variation_name?.trim();

  if (!variation || variation.toLowerCase() === "regular") return base;
  return `${base} — ${variation}`;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  try {
    const signature = request.headers.get("x-square-hmacsha256-signature");

    if (!verifySquareSignature(rawBody, signature)) {
      console.warn("Rejected webhook: invalid Square signature.");
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 403 });
    }

    const event = JSON.parse(rawBody) as SquareWebhook;

    // We only need the final completed payment event.
    if (event.type !== "payment.updated") {
      return NextResponse.json({ ok: true, ignored: "event type" });
    }

    const payment = event.data?.object?.payment;
    if (!payment?.id) {
      return NextResponse.json({ ok: true, ignored: "missing payment object" });
    }

    if (payment.status !== "COMPLETED") {
      return NextResponse.json({ ok: true, ignored: `payment status ${payment.status ?? "unknown"}` });
    }

    const allowedLocation = config.squareLocationId();
    if (allowedLocation && payment.location_id !== allowedLocation) {
      return NextResponse.json({ ok: true, ignored: "different Square location" });
    }

    if (!payment.order_id) {
      console.warn(`Payment ${payment.id} has no order_id; cannot retrieve line items.`);
      return NextResponse.json({ ok: true, ignored: "payment has no order_id" });
    }

    const amount = payment.amount_money?.amount;
    const currency = payment.amount_money?.currency;

    if (!Number.isInteger(amount) || amount! < 0 || !currency) {
      throw new Error(`Payment ${payment.id} is missing valid amount_money.`);
    }

    const order = await retrieveSquareOrder(payment.order_id);

    const lineItems = (order.line_items ?? []).map((item) => ({
      title: titleFor(item),
      quantity: quantityToInteger(item.quantity),
    }));

    // Protect requires at least one line item in the schema example.
    if (lineItems.length === 0) {
      lineItems.push({
        title: "Square POS Sale",
        quantity: 1,
      });
    }

    const timestampSource =
      payment.updated_at ||
      payment.created_at ||
      event.created_at ||
      new Date().toISOString();

    const timestamp = Date.parse(timestampSource);
    if (!Number.isFinite(timestamp)) {
      throw new Error(`Invalid transaction timestamp: ${timestampSource}`);
    }

    const locationId =
      payment.location_id ||
      order.location_id ||
      "square";

    const transaction: ProtectTransaction = {
      type: "sale",
      // A stable Square Payment ID gives Protect a consistent external reference.
      externalId: payment.id,
      // Square Money amounts are already expressed in the smallest currency unit (cents for USD).
      amount,
      currency: currency.toUpperCase(),
      lineItems,
      location: {
        id: locationId,
        name: config.posLocationName(),
      },
      paymentTypes: [squarePaymentType(payment)],
      timestamp,
    };

    const result = await sendProtectTransaction(transaction);

    console.info(
      JSON.stringify({
        message: "Square sale sent to UniFi Protect",
        squareEventId: event.event_id,
        paymentId: payment.id,
        orderId: payment.order_id,
        protectResult: result,
      })
    );

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      protect: result,
    });
  } catch (error) {
    console.error(error);

    // Returning 500 tells Square delivery failed so it can retry.
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 }
    );
  }
}
