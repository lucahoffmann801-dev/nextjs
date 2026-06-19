import { NextResponse } from "next/server";
import { supabaseRest } from "@/app/lib/supabase-rest";

export const dynamic = "force-dynamic";

const ORAKEL_ID = "ORAKEL26";

const INITIAL_BETS = Array.from({ length: 25 }, (_, idx) => ({
  idx,
  janBet: null as string | null,
  lucaBet: null as string | null,
  result: null as string | null,
  resolvedAt: null as string | null,
}));

export async function GET() {
  try {
    const rows = await supabaseRest<unknown[]>(
      `game_sessions?id=eq.${ORAKEL_ID}&select=*`,
    );
    if (rows && rows.length > 0) return NextResponse.json(rows[0]);

    // First run – create
    const created = await supabaseRest<unknown>(
      "game_sessions",
      {
        method: "POST",
        prefer: "return=representation",
        body: {
          id: ORAKEL_ID,
          game: "orakel",
          host: "Luca",
          guest: "Jan",
          status: "active",
          state: { bets: INITIAL_BETS, scores: { Jan: 0, Luca: 0 } },
        },
      },
    );
    return NextResponse.json(Array.isArray(created) ? created[0] : created);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { state } = await request.json() as { state: unknown };
    const updated = await supabaseRest<unknown[]>(
      `game_sessions?id=eq.${ORAKEL_ID}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: { state, updated_at: new Date().toISOString() },
      },
    );
    if (!updated || updated.length === 0)
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(updated[0]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler" },
      { status: 500 },
    );
  }
}
