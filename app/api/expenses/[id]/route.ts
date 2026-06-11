import { NextResponse } from "next/server";
import { deleteExpense } from "@/app/lib/trip-state";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const state = await deleteExpense(id);
    return NextResponse.json(state, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ausgabe konnte nicht gelöscht werden." },
      { status: 400 },
    );
  }
}
