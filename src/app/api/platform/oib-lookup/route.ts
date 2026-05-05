import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import { fetchCompanyByOibFromSudreg } from "@/lib/sudreg";

export async function POST(req: Request) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { oib } = (await req.json()) as { oib?: string };
  const cleaned = (oib ?? "").replace(/\D/g, "");

  if (cleaned.length !== 11) {
    return NextResponse.json({ error: "OIB mora imati točno 11 znamenki." }, { status: 400 });
  }

  try {
    const company = await fetchCompanyByOibFromSudreg(cleaned);

    return NextResponse.json({
      found: true,
      data: {
        name: company.name,
        street: company.street ?? "",
        city: company.city ?? "",
        postalCode: company.postalCode ?? "",
      },
    });
  } catch (e) {
    if (e instanceof Error) {
      switch (e.message) {
        case "INVALID_OIB":
          return NextResponse.json({ error: "Neispravan OIB." }, { status: 400 });
        case "SUBJECT_NOT_FOUND":
          return NextResponse.json({ found: false, message: "OIB nije pronađen u registru." });
        case "SUDREG_NOT_CONFIGURED":
          return NextResponse.json(
            {
              found: false,
              message:
                "Sudski registar nije konfiguriran na poslužitelju (nedostaju SUDREG_CLIENT_ID / SUDREG_CLIENT_SECRET).",
            },
            { status: 503 },
          );
        case "SUDREG_BAD_REQUEST":
          return NextResponse.json(
            { found: false, message: "Neispravan zahtjev prema Sudskom registru." },
            { status: 502 },
          );
        case "SUDREG_UNAUTHORIZED":
          return NextResponse.json(
            { found: false, message: "Greška autorizacije prema Sudskom registru. Provjeri API pristupne podatke." },
            { status: 502 },
          );
        case "SUDREG_PARSE_FAILED":
          return NextResponse.json(
            { found: false, message: "Podaci iz Sudskog registra su u neočekivanom formatu." },
            { status: 502 },
          );
        default:
          break;
      }
    }
    console.error("[platform/oib-lookup] sudreg error:", e);

    return NextResponse.json(
      { found: false, message: "Greška pri dohvaćanju podataka iz Sudskog registra." },
      { status: 502 },
    );
  }
}
