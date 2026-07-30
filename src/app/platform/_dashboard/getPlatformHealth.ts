/**
 * Agregira operativne statuse za platform dashboard health strip.
 *
 * Filozofija: status moze biti "ok" / "warn" / "down" / "off" (neaktivan/iskljucen).
 * Sve provjere su read-only i ne smiju baciti — vracaju "warn" + poruku.
 */
import { prisma } from "@/lib/prisma";
import { listRecentBackups, formatBytes } from "@/lib/backupListing";

export type HealthLevel = "ok" | "warn" | "down" | "off";

export type HealthItem = {
  key: string;
  label: string;
  level: HealthLevel;
  detail: string;
  href?: string;
};

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export async function getPlatformHealth(): Promise<HealthItem[]> {
  const items: HealthItem[] = [];

  // ─────────────────── Backup pipeline ───────────────────
  // Citamo zadnji uspjesan upload direktno iz R2/S3 bucketa (read-only ListObjectsV2).
  // Ako bucket/cred nije konfiguriran — "off". Ako je konfiguriran ali fail (timeout,
  // ACL, mreza) — "warn" s detaljnom porukom. Ako je sve OK ali nema objekata — "warn"
  // ("nije jos snimljen niti jedan backup"). Ako je objekt stariji od 36h — "warn"
  // (vjerojatno je cron faulty / token istekao).
  try {
    const backups = await listRecentBackups(1);
    if (!backups.configured) {
      items.push({
        key: "backup",
        label: "Backup",
        level: "off",
        detail: "S3 nije konfiguriran",
        href: "/platform/health",
      });
    } else if (!backups.ok) {
      items.push({
        key: "backup",
        label: "Backup",
        level: "warn",
        detail: `Provjera nije uspjela: ${backups.errorMessage ?? "nepoznata greska"}`,
        href: "/platform/health",
      });
    } else {
      const latest = backups.objects[0];
      if (!latest) {
        items.push({
          key: "backup",
          label: "Backup",
          level: "warn",
          detail: "Bucket je prazan — niti jedan backup nije zabiljezen",
          href: "/platform/health",
        });
      } else {
        const ageMs = Date.now() - latest.lastModified.getTime();
        const stale = ageMs > 36 * 60 * 60 * 1000; // 36h prag
        const dateTxt = latest.lastModified.toLocaleString("hr-HR", {
          dateStyle: "short",
          timeStyle: "short",
        });
        items.push({
          key: "backup",
          label: "Backup",
          level: stale ? "warn" : "ok",
          detail: stale
            ? `Zadnji backup ${dateTxt} (zastario — provjeri GH Actions)`
            : `Zadnji ${dateTxt} · ${formatBytes(latest.size)}`,
          href: "/platform/health",
        });
      }
    }
  } catch {
    items.push({
      key: "backup",
      label: "Backup",
      level: "warn",
      detail: "Backup readback je iznenadno bacio",
      href: "/platform/health",
    });
  }

  // ─────────────────── Sentry ───────────────────
  const sentryServer = hasEnv("SENTRY_DSN");
  const sentryClient = hasEnv("NEXT_PUBLIC_SENTRY_DSN");
  items.push({
    key: "sentry",
    label: "Sentry",
    level: sentryServer && sentryClient ? "ok" : sentryServer ? "warn" : "off",
    detail: !sentryServer
      ? "SENTRY_DSN nije postavljen"
      : sentryClient
        ? "Prate se greske servera i preglednika"
        : "Samo server — NEXT_PUBLIC_SENTRY_DSN nije postavljen, greske u pregledniku se ne prijavljuju",
    href: "https://sentry.io/",
  });

  // ─────────────────── Rate-limit (Upstash) ───────────────────
  const upstashOn = hasEnv("UPSTASH_REDIS_REST_URL") && hasEnv("UPSTASH_REDIS_REST_TOKEN");
  items.push({
    key: "ratelimit",
    label: "Rate-limit",
    level: upstashOn ? "ok" : "warn",
    detail: upstashOn
      ? "Upstash Redis"
      : "In-memory fallback (resetira se na restart, ne dijeli se izmedu instanci)",
  });

  // ─────────────────── Vendor Gmail ───────────────────
  try {
    const gmail = await prisma.platformIntegration.findUnique({
      where: { provider: "GMAIL" },
      select: {
        email: true,
        accessTokenEnc: true,
        refreshTokenEnc: true,
        expiresAt: true,
        connectedAt: true,
      },
    });
    if (!gmail || !gmail.accessTokenEnc) {
      items.push({
        key: "gmail",
        label: "Vendor Gmail",
        level: "warn",
        detail: "Nije povezan — sistemski mailovi mozda nece raditi",
        href: "/platform/settings",
      });
    } else {
      const hasRefresh = !!gmail.refreshTokenEnc;
      const accessExpired = gmail.expiresAt && gmail.expiresAt < new Date();
      items.push({
        key: "gmail",
        label: "Vendor Gmail",
        level: hasRefresh ? "ok" : accessExpired ? "warn" : "ok",
        detail:
          accessExpired && hasRefresh
            ? `${gmail.email} (access token istekao — obnavlja se pri slanju)`
            : `${gmail.email}`,
        href: "/platform/settings",
      });
    }
  } catch {
    items.push({
      key: "gmail",
      label: "Vendor Gmail",
      level: "warn",
      detail: "Provjera nije uspjela",
    });
  }

  // ─────────────────── Overdue zahtjevi (PENDING > 24h) ───────────────────
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const overdue = await prisma.registrationRequest.count({
      where: { status: "PENDING", createdAt: { lte: dayAgo } },
    });
    items.push({
      key: "requests",
      label: "Zahtjevi",
      level: overdue > 0 ? "warn" : "ok",
      detail:
        overdue > 0
          ? `${overdue} ${overdue === 1 ? "zahtjev ceka" : "zahtjeva ceka"} duze od 24h`
          : "Nijedan zahtjev ne ceka duze od 24h",
      href: "/platform/registration-requests?status=PENDING",
    });
  } catch {
    items.push({
      key: "requests",
      label: "Zahtjevi",
      level: "warn",
      detail: "Provjera nije uspjela",
    });
  }

  // ─────────────────── Auth anomalije (failed loginovi zadnjih 24h) ───────────────────
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failedLogins = await prisma.auditLog.count({
      where: {
        actorType: "PLATFORM",
        action: {
          in: [
            "platform.googleLogin.exchange_failed",
            "platform.googleLogin.not_allowlisted",
            "platform.googleLogin.no_match",
          ],
        },
        createdAt: { gte: dayAgo },
      },
    });
    items.push({
      key: "auth",
      label: "Auth",
      level: failedLogins >= 5 ? "warn" : "ok",
      detail:
        failedLogins === 0
          ? "Nema neuspjelih platform loginova (24h)"
          : `${failedLogins} ${failedLogins === 1 ? "neuspjeli login" : "neuspjelih loginova"} u 24h`,
      href: "/platform/audit",
    });
  } catch {
    // ignore
  }

  return items;
}
