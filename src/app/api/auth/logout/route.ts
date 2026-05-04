import { NextResponse } from "next/server";
import { redirectRelative } from "@/lib/httpRedirect";

function clearSessionCookie(res: NextResponse) {
  res.cookies.set("vb_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set("vb_impersonation_mode", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set("vb_impersonation_write", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function POST() {
  const res = redirectRelative("/login");
  clearSessionCookie(res);
  return res;
}

/** GET: odjava nakon isteka sesije / obrisanog računa (redirect iz layouta). */
export async function GET() {
  const res = redirectRelative("/login");
  clearSessionCookie(res);
  return res;
}

