/**
 * Centralni logger + opcionalna Sentry integracija.
 *
 * Zašto NE koristimo pino direktno:
 *  - Next.js middleware i Edge runtime ne podržavaju neke pino transport overheadu.
 *  - Umjesto toga koristimo lagani JSON console.log s razinama koji Vercel/Fly/Docker
 *    loggeri parsiraju bez problema.
 *  - Sentry se inicijalizira iz src/instrumentation.ts (Next.js konvencija).
 *
 * API:
 *   logInfo("user_signed_up", { companyId, accountUserId })
 *   logWarn("gmail_token_expired", { companyId })
 *   logError("work_order_delete_failed", err, { workOrderId })
 */

type LogFields = Record<string, unknown>;

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, event: string, fields?: LogFields): void {
  const payload = {
    t: new Date().toISOString(),
    lvl: level,
    evt: event,
    ...(fields ?? {}),
  };

  // U produkciji želimo JSON jedna linija da log collectori lako parsiraju.
  // U dev-u ostavljamo JSON zbog konzistentnosti (čitljivo preko Cursor terminala).
  const line = JSON.stringify(payload);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(event: string, fields?: LogFields): void {
  emit("info", event, fields);
}

export function logWarn(event: string, fields?: LogFields): void {
  emit("warn", event, fields);
}

export function logDebug(event: string, fields?: LogFields): void {
  if (process.env.NODE_ENV !== "production") {
    emit("debug", event, fields);
  }
}

export function logError(event: string, err: unknown, fields?: LogFields): void {
  const e = err instanceof Error ? err : new Error(String(err));
  emit("error", event, {
    ...fields,
    err: { name: e.name, message: e.message, stack: e.stack },
  });

  // Opcionalna Sentry integracija (bez tvrdog ovisnosti — ako instrumentation.ts
  // registrira captureException global, koristimo ga). Nema errora ako Sentry nije instaliran.
  try {
    const g = globalThis as unknown as { __sentryCapture?: (e: unknown, ctx?: unknown) => void };
    if (typeof g.__sentryCapture === "function") {
      g.__sentryCapture(e, fields);
    }
  } catch {
    // ignore
  }
}
