import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET() {
  const { response } = await requireRole("finance_manager", "admin");
  if (response) return response;

  const [depts, classes, teachers, students, activeStudents, unpaidBills, paidBills] =
    await Promise.all([
      queryOne<{ count: string }>(`select count(*)::text as count from departments`),
      queryOne<{ count: string }>(`select count(*)::text as count from classes`),
      queryOne<{ count: string }>(
        `select count(*)::text as count from teachers where deleted_at is null`,
      ),
      queryOne<{ count: string }>(
        `select count(*)::text as count from students where deleted_at is null`,
      ),
      queryOne<{ count: string }>(
        `select count(*)::text as count from students where deleted_at is null and status = 'active'`,
      ),
      queryOne<{ count: string }>(
        `select count(*)::text as count from bills where status = 'unpaid'`,
      ),
      queryOne<{ count: string }>(
        `select count(*)::text as count from bills where status = 'paid'`,
      ),
    ]);

  const recentBills = await query(
    `select b.bill_number, b.bill_type, b.total_amount, b.status, b.created_at,
            te.name as teacher_name, d.name as department_name
     from bills b
     join teachers te on te.id = b.teacher_id
     join departments d on d.id = b.department_id
     order by b.created_at desc
     limit 6`,
  );

  return NextResponse.json({
    stats: {
      departments: Number(depts?.count ?? 0),
      classes: Number(classes?.count ?? 0),
      teachers: Number(teachers?.count ?? 0),
      students: Number(students?.count ?? 0),
      active_students: Number(activeStudents?.count ?? 0),
      unpaid_bills: Number(unpaidBills?.count ?? 0),
      paid_bills: Number(paidBills?.count ?? 0),
    },
    recentBills,
  });
}
