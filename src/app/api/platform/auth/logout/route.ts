import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // 303: nakon POST-a uvijek prebaci na GET
  const res = NextResponse.redirect(new URL("/platform/login", req.url), 303);
  res.cookies.set("vb_platform_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

