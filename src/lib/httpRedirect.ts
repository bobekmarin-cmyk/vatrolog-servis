import { NextResponse } from "next/server";

/**
 * 303 (default) See Other redirect na **relativni** path.
 *
 * Razlog: u proxy okruženju (Railway, Cloudflare itd.) `req.url` u Next.js
 * route handlerima vraća internu adresu kontejnera, npr.
 * `http://localhost:8080/...`, jer proxy ne prepisuje Host header. Kad se
 * redirect gradi preko `NextResponse.redirect(new URL(target, req.url), 303)`
 * preglednik dobije `Location: http://localhost:8080/login` i tamo završi.
 *
 * Relativni `Location` (RFC 7231 §7.1.2) preglednik razrješava prema trenutnom
 * origin-u, pa korisnik uvijek ostaje na ispravnoj domeni.
 *
 * `NextResponse.redirect()` tipovi zahtijevaju apsolutni URL, pa ovo radimo
 * preko običnog `NextResponse(null, { status, headers: { Location } })`,
 * koji ima isti `.cookies.set(...)` API.
 */
export function redirectRelative(path: string, status: number = 303): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { Location: path },
  });
}
