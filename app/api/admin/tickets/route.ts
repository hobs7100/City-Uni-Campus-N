import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { listTickets, requireTicketScope } from "@/lib/tickets/service";
import { ticketStatuses } from "@/lib/tickets/types";

export async function GET() {
  const { session, response } = await requireTicketScope("admin");
  if (response) return response;
  const [tickets, counts] = await Promise.all([
    listTickets("admin", session!.userId),
    query<{ status: string; count: number }>(
      `select status, count(*)::int as count from tickets group by status`,
    ),
  ]);
  const stats = Object.fromEntries(ticketStatuses.map((status) => [
    status,
    counts.find((row) => row.status === status)?.count ?? 0,
  ]));
  return NextResponse.json({ tickets, stats });
}