import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySessionToken(
    token,
    process.env.ADMIN_PASSWORD
  );

  if (valid) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/receipts")) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/",
    "/api/receipts/:path*",
  ],
};
