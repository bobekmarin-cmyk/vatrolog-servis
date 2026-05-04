import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCode, fetchGmailEmail, encryptToken } from "@/lib/gmail";

import { redirectRelative } from "@/lib/httpRedirect";
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return redirectRelative("/login", 307);
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return redirectRelative("/admin/settings/mail?gmail=error&reason=missing_params", 307);
  }

  const companyId = state.split(":")[0];
  if (companyId !== session.companyId) {
    return redirectRelative("/admin/settings/mail?gmail=error&reason=invalid_state", 307);
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

    return redirectRelative("/admin/settings/mail?gmail=connected", 307);
  } catch (e: any) {
    console.error("Gmail callback error:", e);
    return redirectRelative(`/admin/settings/mail?gmail=error&reason=${encodeURIComponent(e.message?.slice(0, 100) ?? "unknown")}`, 307);
  }
}
