import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export type AccountRole = "ADMIN" | "WORKSHOP";

export type SessionPayload = {
  accountUserId: string;
  companyId: string;
  role: AccountRole;
  // true => admin je popunio obavezne podatke tvrtke (IBAN/email/telefon)
  setupComplete?: boolean;
  /** Unix ms timestamp do kojeg pretplata vrijedi. 0 = neograničeno (null u DB). */
  activeUntilTs?: number;
  /** Ručna blokada od strane platform ownera u trenutku izdavanja tokena. */
  blocked?: boolean;
  /** True samo kad platform owner radi tenant impersonation. */
  isVendorImpersonation?: boolean;
  /**
   * Servisna lokacija na koju je račun vezan (refreshano iz DB-a u getSession).
   * Null za ADMIN i za stare/legacy račune bez lokacije. Koristi se za pre-select
   * na novom radnom nalogu i za enforcement (workshop user može birati samo svoju).
   */
  serviceLocationId?: string | null;
  /** Per-login id za WORKSHOP račune; novi login invalidira staru workshop sesiju. */
  sessionId?: string;
};

const SESSION_COOKIE_NAME = "vb_session";

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Missing AUTH_SECRET env var. Set it to a long random string (e.g. 32+ chars)."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getAuthSecret();
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const secret = getAuthSecret();
  const { payload } = await jwtVerify(token, secret);

  const accountUserId = payload.accountUserId;
  const companyId = payload.companyId;
  const role = payload.role;
  const setupComplete = payload.setupComplete;
  const activeUntilTs = payload.activeUntilTs;
  const blocked = payload.blocked;
  const isVendorImpersonation = payload.isVendorImpersonation;
  const serviceLocationRaw = payload.serviceLocationId;
  const sessionId = payload.sessionId;

  if (typeof accountUserId !== "string" || typeof companyId !== "string") {
    throw new Error("Invalid session token payload.");
  }
  if (role !== "ADMIN" && role !== "WORKSHOP") {
    throw new Error("Invalid session token role.");
  }

  return {
    accountUserId,
    companyId,
    role,
    setupComplete: typeof setupComplete === "boolean" ? setupComplete : true,
    activeUntilTs: typeof activeUntilTs === "number" ? activeUntilTs : undefined,
    blocked: typeof blocked === "boolean" ? blocked : undefined,
    isVendorImpersonation:
      typeof isVendorImpersonation === "boolean" ? isVendorImpersonation : undefined,
    serviceLocationId:
      typeof serviceLocationRaw === "string"
        ? serviceLocationRaw
        : serviceLocationRaw === null
          ? null
          : undefined,
    sessionId: typeof sessionId === "string" ? sessionId : undefined,
  };
}

export type SubscriptionStatus = "active" | "expired" | "blocked";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const secret = getAuthSecret();
    const verified = await jwtVerify(token, secret);
    const payload = await verifySessionToken(token);
    const iatSec = typeof verified.payload.iat === "number" ? verified.payload.iat : null;

    const account = await prisma.accountUser.findFirst({
      where: {
        id: payload.accountUserId,
        companyId: payload.companyId,
        active: true,
      },
      select: {
        sessionsValidAfter: true,
        currentSessionId: true,
        serviceLocationId: true,
        company: { select: { id: true, activeUntil: true, blocked: true, deletedAt: true } },
      },
    });
    if (!account?.company) return null;
    if (account.company.deletedAt) return null;

    // Force-logout: ako je platform owner pozvao "Force logout", sve sesije izdane prije
    // tog trenutka su nevažeće.
    if (account.sessionsValidAfter && iatSec !== null) {
      const cutoffSec = Math.floor(account.sessionsValidAfter.getTime() / 1000);
      if (iatSec < cutoffSec) return null;
    }

    // WORKSHOP računi smiju imati samo jednu aktivnu sesiju. Kad se isti username
    // prijavi na drugom uređaju, login ruta zamijeni currentSessionId i stari JWT pada ovdje.
    if (payload.role === "WORKSHOP") {
      if (!payload.sessionId || account.currentSessionId !== payload.sessionId) return null;
    }

    // Osvježi subscription polja na temelju aktualnog DB stanja
    // (ako platform owner promijeni activeUntil/blocked, korisnik ne mora čekati re-login).
    const freshActiveUntilTs = account.company.activeUntil ? account.company.activeUntil.getTime() : 0;
    return {
      ...payload,
      activeUntilTs: freshActiveUntilTs,
      blocked: account.company.blocked,
      serviceLocationId: account.serviceLocationId,
    };
  } catch {
    return null;
  }
}

export async function getSubscriptionStatus(companyId: string): Promise<SubscriptionStatus> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { blocked: true, activeUntil: true },
  });
  if (!company) return "expired";
  if (company.blocked) return "blocked";
  if (company.activeUntil && company.activeUntil < new Date()) return "expired";
  return "active";
}

export type SubscriptionInfo = {
  status: SubscriptionStatus;
  activeUntil: Date | null;
  /** Broj dana do isteka (0 = ističe danas, negativno = već isteklo). null ako je pretplata neograničena. */
  daysUntilExpiry: number | null;
  /** true ako je status "active" i do isteka je ≤ 5 dana. */
  expiringSoon: boolean;
};

export async function getSubscriptionInfo(companyId: string): Promise<SubscriptionInfo> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { blocked: true, activeUntil: true },
  });

  if (!company) {
    return { status: "expired", activeUntil: null, daysUntilExpiry: null, expiringSoon: false };
  }

  const now = new Date();
  const activeUntil = company.activeUntil ?? null;

  let status: SubscriptionStatus = "active";
  if (company.blocked) status = "blocked";
  else if (activeUntil && activeUntil < now) status = "expired";

  let daysUntilExpiry: number | null = null;
  if (activeUntil) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(activeUntil.getFullYear(), activeUntil.getMonth(), activeUntil.getDate());
    daysUntilExpiry = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  const expiringSoon =
    status === "active" &&
    daysUntilExpiry !== null &&
    daysUntilExpiry <= 5 &&
    daysUntilExpiry >= 0;

  return { status, activeUntil, daysUntilExpiry, expiringSoon };
}

export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}

export function hasRole(session: SessionPayload, allowed: AccountRole | AccountRole[]): boolean {
  return Array.isArray(allowed) ? allowed.includes(session.role) : session.role === allowed;
}

/**
 * Sentinel klasa za API error handlere. Baca se iz helpera (requireActiveSession)
 * i hvata u apiHandler wrapperu koji pretvara u NextResponse.json s pravim statusom.
 */
export class AppAuthError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "AppAuthError";
  }
}

/**
 * Vrati sesiju + verificiraj da je pretplata aktivna i da tvrtka nije blokirana.
 * Baca AppAuthError koji apiHandler pretvori u JSON odgovor s pravim statusom (401/402/403).
 *
 * Koristi JWT payload za brzu provjeru; dodatno DB hit kroz getSession() da zaustavi
 * dezaktivirane AccountUser-e.
 */
export async function requireActiveSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new AppAuthError("UNAUTHENTICATED", "Niste prijavljeni.", 401);

  if (s.blocked) {
    throw new AppAuthError("SUBSCRIPTION_BLOCKED", "Vaša tvrtka je blokirana. Kontaktirajte podršku.", 402);
  }
  if (s.activeUntilTs && s.activeUntilTs > 0 && s.activeUntilTs < Date.now()) {
    throw new AppAuthError("SUBSCRIPTION_EXPIRED", "Pretplata je istekla. Obnovite pretplatu za nastavak rada.", 402);
  }

  return s;
}

/** Kao requireActiveSession + samo ADMIN role smije proći. */
export async function requireAdminSession(): Promise<SessionPayload> {
  const s = await requireActiveSession();
  if (s.role !== "ADMIN") {
    throw new AppAuthError("FORBIDDEN", "Nemate ovlasti za ovu radnju.", 403);
  }
  return s;
}

