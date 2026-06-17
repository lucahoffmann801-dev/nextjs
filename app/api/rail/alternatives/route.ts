import { NextResponse } from "next/server";

import { getRailAlternatives } from "../../../lib/rail-live";
import type { RailLegLookup } from "../../../lib/rail-live-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as RailLegLookup;
    if (!input?.id || !input.train || !input.from || !input.to || !input.date || !input.plannedDeparture) {
      return NextResponse.json({ error: "Unvollständige Zugdaten." }, { status: 400 });
    }
    const result = await getRailAlternatives(input);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Alternativen konnten nicht geladen werden.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
