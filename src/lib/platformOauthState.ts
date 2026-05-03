/**
 * Jednokratan, signed OAuth `state` za platform Gmail flow.
 * State je JWT vezan na platformUserId, s kratkim TTL (10 min) i nonce-om.
 * Validacija u callbacku traži match platformUserId iz aktivne sesije.
 */
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { resolvePlatformJwtSecret } from "@/lib/authEnv";

const STATE_TTL_SEC = 600; // 10 min
const ISS = "vatrolog-platform-oauth";

function getSecret(): Uint8Array {
  const s = resolvePlatformJwtSecret();
  if (!s) throw new Error("PLATFORM_AUTH_SECRET not set");
  return new TextEncoder().encode(s);
}

export async function createOauthState(platformUserId: string): Promise<string> {
  const nonce = crypto.randomBytes(16).toString("base64url");
  return await new SignJWT({ platformUserId, nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISS)
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SEC}s`)
    .sign(getSecret());
}

export async function verifyOauthState(
  state: string,
  expectedPlatformUserId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const { payload } = await jwtVerify(state, getSecret(), { issuer: ISS });
    if (payload.platformUserId !== expectedPlatformUserId) {
      return { ok: false, reason: "user_mismatch" };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.code || "invalid_state" };
  }
}
