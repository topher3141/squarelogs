import { NextRequest, NextResponse } from "next/server";
import { config } from "../../../lib/config";
import { wasProcessed, markProcessed } from "../../../lib/redis";
import { listRecentSquarePayments } from "../../../lib/square";
import { paymentToProtect } from "../../../lib/transaction";
import { buildReceiptRecord } from "@/lib/receipt-builder";
import { saveReceiptRecord } from "@/lib/receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = config.cronSecret();

  // If no secret is configured, allow calls.
  // This is convenient for initial testing.
  if (!secret) return true;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const now = new Date();

  // Look back five minutes so we don't miss payments
  // that take a few seconds to become visible in Square.
  const begin = new Date(now.getTime() - 5 * 60 * 1000);

  try {
    const payments = await listRecentSquarePayments(
      begin.toISOString(),
      now.toISOString()
    );

    // Only physical retail-register transactions.
    // This excludes invoices, ecommerce, payment links, etc.
    const completed = payments.filter(
      (payment) =>
        payment.status === "COMPLETED" &&
        payment.id &&
        payment.order_id &&
        payment.application_details?.square_product === "RETAIL" &&
        payment.device_details?.device_id
    );

    const results: Array<Record<string, unknown>> = [];

    for (const payment of completed) {
      const paymentId = payment.id!;

      if (await wasProcessed(paymentId)) {
        results.push({
          paymentId,
          status: "skipped",
          reason: "already processed",
        });

        continue;
      }

      try {
        const {
          transaction,
          protectResult,
          order,
        } = await paymentToProtect(payment);

        const eventId =
          protectResult &&
          typeof protectResult === "object" &&
          "eventId" in protectResult
            ? String(
                (protectResult as { eventId?: unknown }).eventId ?? ""
              )
            : "";

        // Save searchable receipt data for the portal.
        const receiptRecord = buildReceiptRecord({
          payment,
          order,
          protectEventId: eventId,
        });

        await saveReceiptRecord(receiptRecord);

        // Only mark processed after both Protect and receipt storage succeed.
        await markProcessed(paymentId, eventId);

        results.push({
          paymentId,
          receiptNumber: payment.receipt_number ?? null,
          status: "sent",
          receiptSaved: true,
          amount: transaction.amount,
          paymentType: transaction.paymentTypes[0],
          lineItems: transaction.lineItems.length,
          device: payment.device_details?.device_name ?? null,
          protect: protectResult,
        });

        console.info(
          JSON.stringify({
            message:
              "Polled Square sale sent to UniFi Protect and saved to receipt portal",
            paymentId,
            receiptNumber: payment.receipt_number,
            device: payment.device_details?.device_name,
            protectResult,
          })
        );
      } catch (error) {
        results.push({
          paymentId,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "unknown error",
        });

        console.error(
          `Failed processing Square payment ${paymentId}:`,
          error
        );
      }
    }

    return NextResponse.json({
      ok: true,
      window: {
        begin: begin.toISOString(),
        end: now.toISOString(),
      },
      found: payments.length,
      completed: completed.length,
      results,
    });
  } catch (error) {
    console.error("Square polling failed:", error);

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
