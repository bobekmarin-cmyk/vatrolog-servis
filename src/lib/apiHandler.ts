import { NextResponse } from "next/server";
import { AppAuthError } from "@/lib/auth";
import { logError } from "@/lib/logger";

export class AppValidationError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>, code = "VALIDATION_ERROR") {
    super(message);
    this.name = "AppValidationError";
    this.code = code;
    this.status = 400;
    this.fields = fields;
  }
}

/**
 * Wrapper za API route handlere. Hvata standardne greške i pretvara ih u
 * dosljedne JSON odgovore. Sprema error u logger.
 *
 * Uporaba:
 *   export const POST = apiHandler(async (req) => {
 *     const session = await requireActiveSession();
 *     ...
 *     return NextResponse.json({ ok: true });
 *   });
 */
export function apiHandler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AppAuthError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      if (err instanceof AppValidationError) {
        return NextResponse.json(
          { error: err.message, code: err.code, fields: err.fields },
          { status: err.status },
        );
      }
      const message = err instanceof Error ? err.message : "Neocekivana greska.";
      logError("api_handler_error", err, { message });
      return NextResponse.json({ error: "Dogodila se greška na poslužitelju.", code: "INTERNAL" }, { status: 500 });
    }
  };
}
