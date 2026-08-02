import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// ── GET /api/admin/leave-management/[id] ─────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;

  const leave = await queryOne<{
    id: string;
    student_id: string;
    student_name: string;
    father_name: string | null;
    cnic: string;
    contact: string | null;
    class_name: string;
    session: string;
    department_name: string;
    issue_date: string;
    reason: string | null;
    notes: string | null;
    proof_urls: string[];
    issued_by_name: string | null;
    revoked_at: string | null;
    created_at: string;
  }>(
    `select
       sl.id,
       s.id              as student_id,
       s.name            as student_name,
       s.father_name,
       s.cnic,
       s.contact,
       cl.class_name,
       cl.session,
       d.name            as department_name,
       to_char(sl.issue_date, 'YYYY-MM-DD') as issue_date,
       sl.reason,
       sl.notes,
       sl.proof_urls,
       u.name            as issued_by_name,
       sl.revoked_at,
       sl.created_at
     from student_leaves sl
     join students s    on s.id  = sl.student_id
     join classes cl    on cl.id = s.class_id
     join departments d on d.id  = s.department_id
     left join users u  on u.id  = sl.issued_by
     where sl.id = $1`,
    [id]
  );

  if (!leave) return NextResponse.json({ error: "Leave not found." }, { status: 404 });
  return NextResponse.json({ leave });
}

// ── PUT /api/admin/leave-management/[id] ─────────────────────────────────────
const putSchema = z.object({
  issue_date:  z.string().optional(), // accept ISO or YYYY-MM-DD; normalized to YYYY-MM-DD below
  reason:      z.string().optional().nullable(),
  notes:       z.string().optional().nullable(),
  proof_urls:  z.array(z.string().url()).max(3).optional(),
  revoke:      z.boolean().optional(), // true = revoke leave → restore student to 'active'
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });

  const d = parsed.data;

  const existing = await queryOne<{ id: string; student_id: string; revoked_at: string | null }>(
    `select id, student_id, revoked_at from student_leaves where id = $1`,
    [id]
  );
  if (!existing) return NextResponse.json({ error: "Leave not found." }, { status: 404 });

  const client = await pool.connect();
  try {
    await client.query("begin");

    if (d.revoke) {
      // Revoke leave: set revoked_at, restore student status to 'active'
      if (existing.revoked_at)
        return NextResponse.json({ error: "Leave is already revoked." }, { status: 409 });

      await client.query(
        `update student_leaves
         set revoked_at = now(), revoked_by = $1, updated_at = now()
         where id = $2`,
        [session!.userId, id]
      );
      await client.query(
        `update students
         set status = 'active', status_changed_by_name = $1, updated_at = now()
         where id = $2`,
        [session!.name, existing.student_id]
      );
    } else {
      // Regular update of leave fields
      const sets: string[] = ["updated_at = now()"];
      const vals: unknown[] = [];
      let i = 1;
      if (d.issue_date !== undefined) { sets.unshift(`issue_date = $${i++}`);  vals.push(d.issue_date.slice(0, 10)); }
      if (d.reason     !== undefined) { sets.unshift(`reason = $${i++}`);      vals.push(d.reason); }
      if (d.notes      !== undefined) { sets.unshift(`notes = $${i++}`);       vals.push(d.notes); }
      if (d.proof_urls !== undefined) { sets.unshift(`proof_urls = $${i++}`);  vals.push(d.proof_urls); }
      vals.push(id);
      await client.query(
        `update student_leaves set ${sets.join(", ")} where id = $${i}`,
        vals
      );
    }

    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("rollback");
    console.error("Leave update error:", err);
    return NextResponse.json({ error: "Failed to update leave." }, { status: 500 });
  } finally {
    client.release();
  }
}
