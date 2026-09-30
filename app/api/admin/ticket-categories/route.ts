import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireTicketScope } from "@/lib/tickets/service";
import { ticketCategorySchema, uuidSchema } from "@/lib/tickets/types";

export async function GET() {
  const { response } = await requireTicketScope("admin");
  if (response) return response;
  const categories = await query(
    `select id, title, active, created_at, updated_at
     from ticket_categories order by active desc, lower(title)`,
  );
  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireTicketScope("admin");
  if (response) return response;
  const parsed = ticketCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid issue title." }, { status: 400 });
  try {
    const rows = await query(
      `insert into ticket_categories(title, created_by)
       values ($1,$2) returning id,title,active,created_at,updated_at`,
      [parsed.data.title, session!.userId],
    );
    return NextResponse.json({ category: rows[0] }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "An active issue title with this name already exists." }, { status: 409 });
    }
    console.error("Ticket category creation failed:", error);
    return NextResponse.json({ error: "Unable to create issue title." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { response } = await requireTicketScope("admin");
  if (response) return response;
  const body = await request.json().catch(() => null);
  const id = uuidSchema.safeParse(body?.id);
  const title = ticketCategorySchema.safeParse({ title: body?.title });
  const active = body?.active === undefined ? null
    : typeof body.active === "boolean" ? body.active : undefined;
  if (!id.success || !title.success || active === undefined) {
    return NextResponse.json({
      error: !id.success ? "A valid category ID is required."
        : !title.success ? title.error.issues[0]?.message
          : "Active must be true or false.",
    }, { status: 400 });
  }
  try {
    const rows = await query(
      `update ticket_categories
       set title = $2, active = coalesce($3::boolean, active), updated_at = now()
       where id = $1 returning id,title,active,created_at,updated_at`,
      [id.data, title.data.title, active],
    );
    if (!rows[0]) return NextResponse.json({ error: "Issue title not found." }, { status: 404 });
    return NextResponse.json({ category: rows[0] });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "An active issue title with this name already exists." }, { status: 409 });
    }
    console.error("Ticket category update failed:", error);
    return NextResponse.json({ error: "Unable to update issue title." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { response } = await requireTicketScope("admin");
  if (response) return response;
  const id = uuidSchema.safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "A valid category ID is required." }, { status: 400 });
  const rows = await query(
    `update ticket_categories set active = false, updated_at = now()
     where id = $1 returning id`,
    [id.data],
  );
  if (!rows[0]) return NextResponse.json({ error: "Issue title not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}