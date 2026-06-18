import { NextResponse } from "next/server";

import { getWeatherSnapshots, validWeatherPoint } from "@/app/lib/weather";
import type { WeatherPointRequest } from "@/app/lib/weather-types";

export const dynamic = "force-dynamic";

function parsePoints(value: unknown): WeatherPointRequest[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) {
    throw new Error("Bitte 1 bis 30 Wetterpunkte senden.");
  }
  const seen = new Set<string>();
  return value.map((item) => {
    const raw = item as Partial<WeatherPointRequest>;
    const point = {
      id: String(raw.id ?? "").trim(),
      lat: Number(raw.lat),
      lng: Number(raw.lng),
    };
    if (!validWeatherPoint(point)) {
      throw new Error(`Wetterpunkt "${point.id || "ohne ID"}" liegt nicht im erlaubten Kreta-Gebiet.`);
    }
    if (seen.has(point.id)) throw new Error(`Wetterpunkt-ID "${point.id}" wurde doppelt gesendet.`);
    seen.add(point.id);
    return point;
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { points?: unknown; date?: unknown; refresh?: unknown };
    const points = parsePoints(body.points);
    const date = body.date == null ? undefined : String(body.date);
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Das Wetterdatum muss im Format YYYY-MM-DD vorliegen.");
    }
    const result = await getWeatherSnapshots(points, date, body.refresh === true);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wetterdaten konnten nicht geladen werden.";
    const upstreamFailure = /Open-Meteo|Wetterquelle/.test(message);
    return NextResponse.json(
      { error: message },
      {
        status: upstreamFailure ? 502 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
