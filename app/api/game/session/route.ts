import { NextResponse } from "next/server";
import { supabaseRest } from "@/app/lib/supabase-rest";

export const dynamic = "force-dynamic";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(request: Request) {
  try {
    const { game, host } = await request.json() as { game: string; host: string };
    if (!game || !host) return NextResponse.json({ error: "game und host erforderlich." }, { status: 400 });

    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await supabaseRest<unknown[]>(`game_sessions?id=eq.${code}&select=id`);
      if (!existing || (existing as unknown[]).length === 0) break;
      code = generateCode();
      attempts++;
    }

    const session = await supabaseRest<unknown>(
      "game_sessions",
      {
        method: "POST",
        prefer: "return=representation",
        body: { id: code, game, host, guest: null, status: "waiting", state: {} },
      },
    );

    return NextResponse.json(Array.isArray(session) ? session[0] : session);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Session konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
