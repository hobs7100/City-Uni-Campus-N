import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireTicketScope } from "@/lib/tickets/service";
import { ticketEmployeeRoles } from "@/lib/tickets/types";

export async function GET() {
  const { response } = await requireTicketScope("admin");
  if (response) return response;
  const assignees = await query(
    `select id, name, email, role::text as role
     from users
     where status = 'active' and deleted_at is null and role::text = any($1::text[])
     order by name`,
    [ticketEmployeeRoles],
  );
  return NextResponse.json({ assignees });
}