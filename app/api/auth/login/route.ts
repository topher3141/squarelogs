import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  passwordMatches,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("ADMIN_PASSWORD is not configured.");

    return NextResponse.json(
      { ok: false, error: "Admin login is not configured." },
      { status: 500 }
    );
  }

  let body: {
    username?: string;
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  const username = body.username?.trim().toLowerCase() || "";
  const suppliedPassword = body.password || "";

  const usernameValid = username === "admin";
  const passwordValid = await passwordMatches(
    suppliedPassword,
    adminPassword
  );

  if (!usernameValid || !passwordValid) {
    return NextResponse.json(
      { ok: false, error: "Invalid username or password." },
      { status: 401 }
    );
  }

  const token = await createSessionToken(adminPassword);

  const response = NextResponse.json({
    ok: true,
  });

  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}
