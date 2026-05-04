import { redirectRelative } from "@/lib/httpRedirect";

export async function POST() {
  // 303: nakon POST-a uvijek prebaci na GET
  const res = redirectRelative("/platform/login");
  res.cookies.set("vb_platform_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

