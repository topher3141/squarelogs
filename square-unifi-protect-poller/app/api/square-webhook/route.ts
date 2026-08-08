import { NextRequest, NextResponse } from "next/server";
import { verifySquareSignature, SquareWebhook } from "../../../lib/square";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  try {
    const signature =
      request.headers.get("x-square-hmacsha256-signature");

    if (!verifySquareSignature(rawBody, signature)) {
      return NextResponse.json(
        { ok: false, error: "invalid signature" },
        { status: 403 }
      );
    }

    const event = JSON.parse(rawBody) as SquareWebhook;

    // Webhooks are retained only as a diagnostic/fallback signal.
    // The /api/poll-square cron route is the primary ingestion path.
    console.info(
      JSON.stringify({
        message: "Square webhook received (poller is primary)",
        type: event.type,
        eventId: event.event_id,
        paymentId: event.data?.object?.payment?.id,
      })
    );

    return NextResponse.json({
      ok: true,
      received: true,
      ingestionMode: "polling",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "unknown error",
      },
      { status: 500 }
    );
  }
}
