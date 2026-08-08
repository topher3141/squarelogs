import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "square-unifi-protect",
    time: new Date().toISOString(),
  });
}
