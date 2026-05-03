import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCode, fetchGmailEmail, encryptToken } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/admin/settings/mail?gmail=error&reason=missing_params", req.url));
  }

  const companyId = state.split(":")[0];
  if (companyId !== session.companyId) {
    return NextResponse.redirect(new URL("/admin/settings/mail?gmail=error&reason=invalid_state", req.url));
  }

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchGmailEmail(tokens.access_token);

    await prisma.company.update({
      where: { id: session.companyId },
      data: {
        gmailAccessToken: encryptToken(tokens.access_token),
        gmailRefreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
        gmailEmail: email,
        gmailConnectedAt: new Date(),
      },
    });

    return NextResponse.redirect(new URL("/admin/settings/mail?gmail=connected", req.url));
  } catch (e: any) {
    console.error("Gmail callback error:", e);
    return NextResponse.redirect(
      new URL(`/admin/settings/mail?gmail=error&reason=${encodeURIComponent(e.message?.slice(0, 100) ?? "unknown")}`, req.url),
    );
  }
}
