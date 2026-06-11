import { NextResponse } from "next/server";
import { supabaseRest } from "@/app/lib/supabase-rest";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { field?: string; value?: boolean };
    if (!id) throw new Error("Pack item id missing.");
    if (body.field !== "lucaDone" && body.field !== "janDone") {
      throw new Error("Ungültiges Feld.");
    }

    const column = body.field === "lucaDone" ? "luca_done" : "jan_done";
    await supabaseRest<null>(`kreta_pack_items?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { [column]: Boolean(body.value) },
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Packliste konnte nicht gespeichert werden." },
      { status: 400 },
    );
  }
}
