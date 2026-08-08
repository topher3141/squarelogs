import { NextRequest, NextResponse } from "next/server";
import { config } from "../../../lib/config";
import {
  retrieveSquareOrder,
  squarePaymentType,
  SquareWebhook,
  verifySquareSignature,
} from "../../../lib/square";
import {
  ProtectTransaction,
  sendProtectTransaction,
} from "../../../lib/unifi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function quantityToInteger(quantity?: string): number {
  const n = Number(quantity ?? "1");

  if (!Number.isFinite(n) || n <= 0) {
    return 1;
  }

  // UniFi Protect's POS schema expects an integer quantity.
  return Math.max(1, Math.round(n));
}

function titleFor(item: {
  name?: string;
  variation_name?: string;
}): string {
  const base = item.name?.trim() || "Item";
  const variation = item.variation_name?.trim();

  if (!variation || variation.toLowerCase() === "regular") {
    return base;
  }

  return `${base} — ${variation}`;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  try {
    /*
     * Verify that the webhook actually came from Square.
     *
     * IMPORTANT:
     * SQUARE_WEBHOOK_NOTIFICATION_URL must exactly match:
     *
     * https://squarelogs-virid.vercel.app/api/square-webhook
     */
    const signature = request.headers.get(
      "x-square-hmacsha256-signature"
    );

    if (!verifySquareSignature(rawBody, signature)) {
      console.warn(
        "Rejected Square webhook: invalid signature."
      );

      return NextResponse.json(
        {
          ok: false,
          error: "invalid signature",
        },
        {
          status: 403,
        }
      );
    }

    const event = JSON.parse(rawBody) as SquareWebhook;

    console.info(
      JSON.stringify({
        message: "Square webhook received",
        type: event.type,
        eventId: event.event_id,
      })
    );

    /*
     * We only care about payment.updated.
     *
     * Square can send many different webhook types.
     */
    if (event.type !== "payment.updated") {
      return NextResponse.json({
        ok: true,
        ignored: "event type",
        eventType: event.type,
      });
    }

    const payment = event.data?.object?.payment;

    if (!payment?.id) {
      return NextResponse.json({
        ok: true,
        ignored: "missing payment object",
      });
    }

    /*
     * payment.updated can occur before a payment is actually
     * finished. Only send completed sales to Protect.
     */
    if (payment.status !== "COMPLETED") {
      return NextResponse.json({
        ok: true,
        ignored: `payment status ${
          payment.status ?? "unknown"
        }`,
      });
    }

    /*
     * Optional Square location restriction.
     *
     * If SQUARE_LOCATION_ID is blank, transactions from all
     * locations on the Square account will be accepted.
     */
    const allowedLocation = config.squareLocationId();

    if (
      allowedLocation &&
      payment.location_id !== allowedLocation
    ) {
      return NextResponse.json({
        ok: true,
        ignored: "different Square location",
        paymentLocation: payment.location_id,
      });
    }

    /*
     * A Square payment normally points to an Order.
     *
     * We need the Order so we can send individual line items
     * into UniFi Protect instead of only displaying the total.
     */
    if (!payment.order_id) {
      console.warn(
        `Payment ${payment.id} has no order_id; ` +
          "cannot retrieve line items."
      );

      return NextResponse.json({
        ok: true,
        ignored: "payment has no order_id",
      });
    }

    /*
     * Square stores USD amounts in cents.
     *
     * Example:
     * $19.99 = 1999
     *
     * This matches the format that successfully worked in
     * our UniFi Protect test.
     */
    const amount = payment.amount_money?.amount;
    const currency = payment.amount_money?.currency;

    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount < 0 ||
      !currency
    ) {
      throw new Error(
        `Payment ${payment.id} is missing valid amount_money.`
      );
    }

    /*
     * Retrieve the complete Square order.
     */
    const order = await retrieveSquareOrder(
      payment.order_id
    );

    /*
     * Convert Square's line items into UniFi's much simpler
     * line item structure.
     */
    const lineItems = (order.line_items ?? []).map(
      (item) => ({
        title: titleFor(item),
        quantity: quantityToInteger(item.quantity),
      })
    );

    /*
     * UniFi's schema expects lineItems.
     *
     * This fallback allows a valid sale to still appear in
     * Protect if Square happens to return an order without
     * accessible item details.
     */
    if (lineItems.length === 0) {
      lineItems.push({
        title: "Square POS Sale",
        quantity: 1,
      });
    }

    /*
     * UniFi accepted timestamps in milliseconds during our
     * API test.
     */
    const timestampSource =
      payment.updated_at ||
      payment.created_at ||
      event.created_at ||
      new Date().toISOString();

    const timestamp = Date.parse(timestampSource);

    if (!Number.isFinite(timestamp)) {
      throw new Error(
        `Invalid transaction timestamp: ${timestampSource}`
      );
    }

    /*
     * Use the actual Square Location ID whenever possible.
     */
    const locationId =
      payment.location_id ||
      order.location_id ||
      "square";

    /*
     * Build the exact transaction format expected by the
     * UniFi Protect POS ingestion endpoint.
     */
    const transaction: ProtectTransaction = {
      type: "sale",

      /*
       * Square Payment ID gives us a stable external reference
       * inside UniFi Protect.
       */
      externalId: payment.id,

      /*
       * Square amount is already cents for USD.
       */
      amount,

      currency: currency.toUpperCase(),

      lineItems,

      location: {
        id: locationId,
        name: config.posLocationName(),
      },

      /*
       * Examples could be:
       *
       * visa
       * mastercard
       * american_express
       * cash
       *
       * depending on what Square supplies.
       */
      paymentTypes: [
        squarePaymentType(payment),
      ],

      timestamp,
    };

    console.info(
      JSON.stringify({
        message:
          "Sending Square transaction to UniFi Protect",
        paymentId: payment.id,
        orderId: payment.order_id,
        amount,
        currency,
        itemCount: lineItems.length,
        locationId,
        timestamp,
      })
    );

    /*
     * Send the POS event through UniFi's remote connector to
     * the Checkout camera.
     */
    const result =
      await sendProtectTransaction(transaction);

    console.info(
      JSON.stringify({
        message:
          "Square sale successfully sent to UniFi Protect",
        squareEventId: event.event_id,
        paymentId: payment.id,
        orderId: payment.order_id,
        protectResult: result,
      })
    );

    /*
     * Returning HTTP 200 tells Square that the webhook was
     * successfully processed.
     */
    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      orderId: payment.order_id,
      protect: result,
    });
  } catch (error) {
    console.error(
      "Square → UniFi webhook processing failed:",
      error
    );

    /*
     * A 500 response tells Square the webhook wasn't
     * successfully handled. Square can then retry delivery.
     */
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "unknown error",
      },
      {
        status: 500,
      }
    );
  }
}
