import { NextResponse } from "next/server";
import { supabaseRest } from "@/app/lib/supabase-rest";

export const dynamic = "force-dynamic";

interface StickerRow {
  id: number;
  luca_count: number;
  jan_count: number;
  updated_at: string;
}

function toClient(row: StickerRow) {
  return { lucaCount: row.luca_count, janCount: row.jan_count, updatedAt: row.updated_at };
}

async function getOrCreateRow(): Promise<StickerRow> {
  const rows = await supabaseRest<StickerRow[]>("sticker_battle?id=eq.1&select=*");
  if (rows && rows.length > 0) return rows[0]!;

  const created = await supabaseRest<StickerRow[]>("sticker_battle", {
    method: "POST",
    prefer: "return=representation",
    body: { id: 1, luca_count: 0, jan_count: 0 },
  });
  return Array.isArray(created) ? created[0]! : (created as unknown as StickerRow);
}

export async function GET() {
  try {
    const row = await getOrCreateRow();
    return NextResponse.json(toClient(row), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sticker-Stand konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { player?: string; delta?: number };
    const player = body.player;
    const delta = Number(body.delta);

    if (player !== "Luca" && player !== "Jan") {
      return NextResponse.json({ error: "player muss 'Luca' oder 'Jan' sein." }, { status: 400 });
    }
    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json({ error: "delta muss eine Zahl ungleich 0 sein." }, { status: 400 });
    }

    const current = await getOrCreateRow();
    const column = player === "Luca" ? "luca_count" : "jan_count";
    const nextValue = Math.max(0, current[column] + delta);

    const updated = await supabaseRest<StickerRow[]>("sticker_battle?id=eq.1", {
      method: "PATCH",
      prefer: "return=representation",
      body: { [column]: nextValue, updated_at: new Date().toISOString() },
    });
    const row = Array.isArray(updated) ? updated[0]! : (updated as unknown as StickerRow);

    return NextResponse.json(toClient(row), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sticker-Stand konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}
