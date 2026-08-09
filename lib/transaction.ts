import {
  retrieveSquareOrder,
  squarePaymentType,
  SquarePayment,
} from "./square";
import { ProtectTransaction, sendProtectTransaction } from "./unifi";

function quantityToInteger(quantity?: string): number {
  const n = Number(quantity ?? "1");

  if (!Number.isFinite(n) || n <= 0) return 1;

  return Math.max(1, Math.round(n));
}

function titleFor(item: { name?: string; variation_name?: string }): string {
  const base = item.name?.trim() || "Item";
  const variation = item.variation_name?.trim();

  if (!variation || variation.toLowerCase() === "regular") {
    return base;
  }

  return `${base} — ${variation}`;
}

export async function paymentToProtect(payment: SquarePayment) {
  if (!payment.id) throw new Error("Square payment has no id.");
  if (!payment.order_id) throw new Error(`Payment ${payment.id} has no order_id.`);

  const amount = payment.amount_money?.amount;
  const currency = payment.amount_money?.currency;

  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount < 0 ||
    !currency
  ) {
    throw new Error(`Payment ${payment.id} has invalid amount_money.`);
  }

  const order = await retrieveSquareOrder(payment.order_id);

  const lineItems = (order.line_items ?? []).map((item) => ({
    title: titleFor(item),
    quantity: quantityToInteger(item.quantity),
  }));

  if (lineItems.length === 0) {
    lineItems.push({
      title: "Square POS Sale",
      quantity: 1,
    });
  }

  const timestampSource =
    payment.updated_at ||
    payment.created_at ||
    new Date().toISOString();

  const timestamp = Date.parse(timestampSource);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Payment ${payment.id} has invalid timestamp.`);
  }

  const transaction: ProtectTransaction = {
    type: "sale",
    externalId:
  payment.receipt_number ||
  payment.id,

amount:
  amount / 100,
    currency: currency.toUpperCase(),
    lineItems,
    location: {
      id: payment.location_id || order.location_id || "square",
      name: process.env.POS_LOCATION_NAME?.trim() || "Deals & Steals",
    },
    paymentTypes: [squarePaymentType(payment)],
    timestamp,
  };

  const protectResult = await sendProtectTransaction(transaction);

  return {
    transaction,
    protectResult,
  };
}
