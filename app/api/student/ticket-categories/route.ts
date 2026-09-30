import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireTicketScope } from "@/lib/tickets/service";

export async function GET() {
  const { response } = await requireTicketScope("student");
  if (response) return response;
  const categories = await query(
    `select id, title from ticket_categories where active order by lower(title)`,
  );
  return NextResponse.json({ categories });
}