import { NextResponse } from "next/server";
import { handleTicketAction, readTicket, requireTicketScope } from "@/lib/tickets/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireTicketScope("student");
  if (response) return response;
  const { id } = await params;
  const result = await readTicket(id);
  if (!result || result.ticket.student_id !== session!.userId) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireTicketScope("student");
  if (response) return response;
  const { id } = await params;
  const result = await handleTicketAction(request, id, "student", session!.userId, "student");
  return NextResponse.json(result.body, { status: result.status });
}