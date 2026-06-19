import { NextResponse } from "next/server";
import { supabaseRest } from "@/app/lib/supabase-rest";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const rows = await supabaseRest<unknown[]>(`game_sessions?id=eq.${encodeURIComponent(id.toUpperCase())}&select=*`);
    if (!rows || rows.length === 0) return NextResponse.json({ error: "Session nicht gefunden." }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Session konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const updated = await supabaseRest<unknown[]>(
      `game_sessions?id=eq.${encodeURIComponent(id.toUpperCase())}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: { ...body, updated_at: new Date().toISOString() },
      },
    );
    if (!updated || updated.length === 0) return NextResponse.json({ error: "Session nicht gefunden." }, { status: 404 });
    return NextResponse.json(updated[0]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Session konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}
