import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Zivi uvid u stanje Postgres konekcija.
 *
 * Kad aplikacija pocne javljati "Can't reach database server", treba znati je li
 * uzrok iscrpljen `max_connections`, spori upiti koji drze konekcije, ili mreza.
 * Bez ovoga se to samo nagadja iz Sentry poruka.
 *
 * Read-only i iza platform sesije.
 */
export async function GET() {
  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  const startedAt = Date.now();

  /**
   * Deset uzastopnih trivijalnih upita. `SELECT 1` ne radi nikakav posao, pa je
   * izmjereno vrijeme cista cijena jednog kruga app -> Postgres. Time se
   * razlikuje "baza je spora" od "aplikacija radi previse upita".
   */
  const latencies: number[] = [];
  for (let i = 0; i < 10; i += 1) {
    const t = Date.now();
    try {
      await prisma.$queryRawUnsafe(`SELECT 1`);
      latencies.push(Date.now() - t);
    } catch {
      break;
    }
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const roundTrip = latencies.length
    ? {
        samples: latencies.length,
        minMs: sorted[0],
        medianMs: sorted[Math.floor(sorted.length / 2)],
        maxMs: sorted[sorted.length - 1],
        avgMs: Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length),
      }
    : null;

  try {
    const [maxConnRows, totalRows, byStateRows, longestRows, dbSizeRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ setting: string }>>(
        `SELECT setting FROM pg_settings WHERE name = 'max_connections'`,
      ),
      prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT count(*) AS total FROM pg_stat_activity WHERE datname = current_database()`,
      ),
      prisma.$queryRawUnsafe<Array<{ state: string | null; count: bigint }>>(
        `SELECT state, count(*) AS count
           FROM pg_stat_activity
          WHERE datname = current_database()
          GROUP BY state
          ORDER BY count DESC`,
      ),
      prisma.$queryRawUnsafe<
        Array<{ pid: number; state: string | null; seconds: number | null; query: string }>
      >(
        `SELECT pid,
                state,
                EXTRACT(EPOCH FROM (now() - query_start))::float AS seconds,
                left(query, 200) AS query
           FROM pg_stat_activity
          WHERE datname = current_database()
            AND state <> 'idle'
            AND pid <> pg_backend_pid()
          ORDER BY (now() - query_start) DESC NULLS LAST
          LIMIT 10`,
      ),
      prisma.$queryRawUnsafe<Array<{ size: string }>>(
        `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
      ),
    ]);

    const maxConnections = Number(maxConnRows[0]?.setting ?? 0);
    const total = Number(totalRows[0]?.total ?? 0);

    return NextResponse.json({
      ok: true,
      totalMs: Date.now() - startedAt,
      /** Cijena jednog kruga do baze. Zdravo je < 5 ms; > 50 ms znaci mrezni problem. */
      roundTrip,
      connections: {
        used: total,
        max: maxConnections,
        freePercent:
          maxConnections > 0 ? Math.round(((maxConnections - total) / maxConnections) * 100) : null,
        byState: byStateRows.map((r) => ({ state: r.state ?? "unknown", count: Number(r.count) })),
      },
      poolConfig: {
        connectionLimit: process.env.DATABASE_CONNECTION_LIMIT ?? "10 (default)",
        poolTimeout: process.env.DATABASE_POOL_TIMEOUT ?? "20 (default)",
        connectTimeout: process.env.DATABASE_CONNECT_TIMEOUT ?? "10 (default)",
      },
      longestRunning: longestRows.map((r) => ({
        pid: r.pid,
        state: r.state,
        seconds: r.seconds != null ? Number(r.seconds.toFixed(1)) : null,
        query: r.query,
      })),
      databaseSize: dbSizeRows[0]?.size ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        totalMs: Date.now() - startedAt,
        roundTrip,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
