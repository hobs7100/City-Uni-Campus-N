import { NextResponse } from "next/server";
import { createStudentTicket, listTickets, requireTicketScope } from "@/lib/tickets/service";

export async function GET() {
  const { session, response } = await requireTicketScope("student");
  if (response) return response;
  const tickets = await listTickets("student", session!.userId);
  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const { session, response } = await requireTicketScope("student");
  if (response) return response;
  const result = await createStudentTicket(request, session!.userId);
  return NextResponse.json(result.body, { status: result.status });
}