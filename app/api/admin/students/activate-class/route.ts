import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Bulk activation is disabled. Reactivate each student through the individual Fine workflow." },
    { status: 410 },
  );
}