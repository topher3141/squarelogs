import { NextRequest, NextResponse } from "next/server";
import { getRecentReceiptRecords } from "@/lib/receipts";

export const dynamic = "force-dynamic";

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = normalize(url.searchParams.get("q"));
    const payment = normalize(url.searchParams.get("payment"));
    const register = normalize(url.searchParams.get("register"));
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 500), 1), 1000);

    let receipts = await getRecentReceiptRecords(limit);
    const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toMs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;

    receipts = receipts.filter((receipt) => {
      if (fromMs && receipt.timestamp < fromMs) return false;
      if (toMs && receipt.timestamp > toMs) return false;
      if (payment && normalize(receipt.paymentType) !== payment) return false;
      if (register && normalize(receipt.deviceName) !== register) return false;
      if (!q) return true;

      const haystack = [
        receipt.receiptNumber,
        receipt.paymentId,
        receipt.orderId,
        receipt.amount.toFixed(2),
        receipt.paymentType,
        receipt.deviceName,
        ...receipt.items.map((item) => item.title),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    return NextResponse.json({ ok: true, count: receipts.length, receipts });
  } catch (error) {
    console.error("Receipt search failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
