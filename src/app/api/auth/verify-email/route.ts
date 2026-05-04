import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/authTokens";
import { logInfo, logWarn } from "@/lib/logger";
import { apiHandler } from "@/lib/apiHandler";

import { redirectRelative } from "@/lib/httpRedirect";
export const runtime = "nodejs";

/**
 * Potvrdi email adresu preko tokena iz emaila.
 * Query param: ?token=<plaintext>
 */
export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) {
    return redirectRelative("/verify-email?status=invalid", 303);
  }

  const hash = hashToken(token);
  const record = await prisma.authToken.findFirst({
    where: {
      tokenHash: hash,
      type: "EMAIL_VERIFY",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record?.accountUserId) {
    logWarn("verify_email_invalid_token");
    return redirectRelative("/verify-email?status=invalid", 303);
  }

  await prisma.$transaction([
    prisma.accountUser.update({
      where: { id: record.accountUserId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  logInfo("verify_email_success", { accountUserId: record.accountUserId });
  return redirectRelative("/verify-email?status=ok", 303);
});
