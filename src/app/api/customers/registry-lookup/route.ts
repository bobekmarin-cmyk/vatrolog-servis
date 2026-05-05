import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchCompanyByOibFromSudreg } from "@/lib/sudreg";
import { isValidCroatianOib } from "@/schemas/common";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const oib = String(searchParams.get("oib") ?? "").trim();

  if (!isValidCroatianOib(oib)) {
    return NextResponse.json({ error: "OIB nije valjan." }, { status: 400 });
  }

  try {
    const company = await fetchCompanyByOibFromSudreg(oib);
    return NextResponse.json(company);
  } catch (e) {
    if (e instanceof Error) {
      switch (e.message) {
        case "INVALID_OIB":
          return NextResponse.json({ error: "Neispravan OIB." }, { status: 400 });
        case "SUBJECT_NOT_FOUND":
          return NextResponse.json({ error: "Subjekt nije pronađen u Sudskom registru." }, { status: 404 });
        case "SUDREG_NOT_CONFIGURED":
          return NextResponse.json(
            {
              error:
                "Sudski registar nije konfiguriran na poslužitelju (nedostaju SUDREG_CLIENT_ID / SUDREG_CLIENT_SECRET). Kontaktirajte vendora.",
            },
            { status: 503 },
          );
        case "SUDREG_BAD_REQUEST":
          return NextResponse.json(
            { error: "Neispravan zahtjev prema Sudskom registru." },
            { status: 502 }
          );
        case "SUDREG_UNAUTHORIZED":
          return NextResponse.json(
            { error: "Greška autorizacije prema Sudskom registru. Provjeri API pristupne podatke." },
            { status: 502 }
          );
        case "SUDREG_PARSE_FAILED":
          return NextResponse.json(
            { error: "Podaci iz Sudskog registra su u neočekivanom formatu." },
            { status: 502 }
          );
        default:
          break;
      }
    }
    console.error("[registry-lookup] sudreg error:", e);

    return NextResponse.json(
      { error: "Greška pri dohvaćanju podataka iz Sudskog registra." },
      { status: 502 }
    );
  }
}
