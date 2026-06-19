import { NextResponse } from "next/server";
import { supabaseRest } from "@/app/lib/supabase-rest";

export const dynamic = "force-dynamic";

const SOUND_ID = "SOUND26";

const INITIAL_STATE = {
  volumes: {
    wellen: 65,
    zikaden: 50,
    wind: 30,
    grillen: 0,
    hafen: 0,
    taverna: 0,
  } as Record<string, number>,
  muted: {
    wellen: false,
    zikaden: false,
    wind: false,
    grillen: true,
    hafen: true,
    taverna: true,
  } as Record<string, boolean>,
  lastBy: null as string | null,
};

export async function GET() {
  try {
    const rows = await supabaseRest<unknown[]>(
      `game_sessions?id=eq.${SOUND_ID}&select=*`,
    );
    if (rows && rows.length > 0) return NextResponse.json(rows[0]);

    const created = await supabaseRest<unknown>(
      "game_sessions",
      {
        method: "POST",
        prefer: "return=representation",
        body: {
          id: SOUND_ID,
          game: "soundscape",
          host: "Luca",
          guest: "Jan",
          status: "active",
          state: INITIAL_STATE,
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
      `game_sessions?id=eq.${SOUND_ID}`,
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
