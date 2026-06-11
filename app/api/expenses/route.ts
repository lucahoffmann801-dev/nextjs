import { NextResponse } from "next/server";
import { createExpense } from "@/app/lib/trip-state";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const state = await createExpense({
      travelDay: String(body.travelDay ?? ""),
      category: String(body.category ?? ""),
      amount: Number(body.amount),
      paidBy: body.paidBy,
      splitMode: body.splitMode ? String(body.splitMode) : "50/50",
      splitLuca: body.splitLuca == null ? 0.5 : Number(body.splitLuca),
      splitJan: body.splitJan == null ? 0.5 : Number(body.splitJan),
      note: body.note ? String(body.note) : "",
    });

    return NextResponse.json(state, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ausgabe konnte nicht gespeichert werden." },
      { status: 400 },
    );
  }
}
