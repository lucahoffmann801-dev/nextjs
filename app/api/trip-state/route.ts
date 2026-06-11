import { NextResponse } from "next/server";
import { getTripState } from "@/app/lib/trip-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getTripState();
  return NextResponse.json(state, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
