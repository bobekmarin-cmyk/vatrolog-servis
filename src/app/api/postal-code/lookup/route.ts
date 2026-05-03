import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type ZipApiResponse = {
  places?: Array<{ "place name"?: string }>;
};

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const postalCode = String(searchParams.get("postalCode") ?? "").trim();

  if (!/^\d{5}$/.test(postalCode)) {
    return NextResponse.json({ error: "Poštanski broj mora imati 5 znamenki." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.zippopotam.us/hr/${postalCode}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Grad nije pronađen za taj poštanski broj." }, { status: 404 });
    }

    const data = (await response.json()) as ZipApiResponse;
    const city = data.places?.[0]?.["place name"]?.trim() ?? "";
    if (!city) {
      return NextResponse.json({ error: "Grad nije pronađen za taj poštanski broj." }, { status: 404 });
    }

    return NextResponse.json({ city });
  } catch {
    return NextResponse.json({ error: "Greška kod dohvata grada po poštanskom broju." }, { status: 502 });
  }
}
