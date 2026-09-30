import { NextResponse } from "next/server";
import { listTickets, requireTicketScope } from "@/lib/tickets/service";
import { ticketStatuses } from "@/lib/tickets/types";
import { query } from "@/lib/db";

export async function GET() {
  const { session, response } = await requireTicketScope("employee");
  if (response) return response;
  const [tickets, counts] = await Promise.all([
    listTickets("employee", session!.userId),
    query<{ status: string; count: number }>(
      `select status, count(*)::int as count from tickets where assigned_user_id = $1 group by status`,
      [session!.userId],
    ),
  ]);
  const stats = Object.fromEntries(ticketStatuses.map((status) => [
    status,
    counts.find((row) => row.status === status)?.count ?? 0,
  ]));
  return NextResponse.json({ tickets, stats });
}