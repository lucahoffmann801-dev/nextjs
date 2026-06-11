import { NextResponse } from "next/server";
import { createRoute } from "@/app/lib/trip-state";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const state = await createRoute({
      id: String(body.id ?? ""),
      day: String(body.day ?? ""),
      title: String(body.title ?? ""),
      stops: Array.isArray(body.stops) ? body.stops.map(String) : [],
      maps: String(body.maps ?? ""),
      cost: String(body.cost ?? ""),
      status: String(body.status ?? "Smart"),
      note: String(body.note ?? ""),
    });

    return NextResponse.json(state, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Route konnte nicht gespeichert werden." },
      { status: 400 },
    );
  }
}
