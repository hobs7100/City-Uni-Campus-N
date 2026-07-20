import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

/**
 * GET /api/admin/allocations/history?course_id=&semester_id=
 *
 * Returns the full transfer chain for a given course+semester combination,
 * ordered by started_at. Works by finding all allocations that share the
 * same transfer_group_id (or a single allocation with no group id).
 */
export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const courseId    = request.nextUrl.searchParams.get("course_id");
  const semesterId  = request.nextUrl.searchParams.get("semester_id");
  const allocationId = request.nextUrl.searchParams.get("allocation_id");

  if (!allocationId && (!courseId || !semesterId)) {
    return NextResponse.json(
      { error: "Provide either allocation_id, or both course_id and semester_id." },
      { status: 400 },
    );
  }

  // Resolve which allocation to start from
  let anchorAllocId = allocationId;
  if (!anchorAllocId) {
    const anchor = await query<{ id: string }>(
      `select a.id
       from allocations a
       join allocation_semesters als on als.allocation_id = a.id
       where als.course_id   = $1
         and als.semester_id = $2
       order by a.created_at
       limit 1`,
      [courseId, semesterId],
    );
    if (anchor.length === 0) {
      return NextResponse.json({ history: [] });
    }
    anchorAllocId = anchor[0].id;
  }

  // Find the transfer_group_id (if any) for the anchor allocation
  const anchor = await query<{ transfer_group_id: string | null }>(
    `select transfer_group_id from allocations where id = $1`,
    [anchorAllocId],
  );
  const groupId = anchor[0]?.transfer_group_id ?? null;

  // Fetch the full chain
  let rows: {
    id: string;
    teacher_id: string;
    teacher_name: string;
    teacher_type: string;
    allocation_type: string;
    rate: string;
    status: string;
    started_at: string | null;
    end_date: string | null;
    lecture_seq_offset: number;
    transfer_group_id: string | null;
    total_lectures: string;
    unbilled_lectures: string;
    delivered_from: number;
    delivered_to: number;
    semesters: { semester_id: string; class_name: string; session: string; semester_number: number }[];
  }[];

  if (groupId) {
    rows = await query(
      `select a.id, a.teacher_id, t.name as teacher_name, t.type as teacher_type,
              a.allocation_type, a.rate, a.status,
              to_char(a.started_at, 'YYYY-MM-DD') as started_at,
              to_char(a.end_date,   'YYYY-MM-DD') as end_date,
              a.lecture_seq_offset,
              a.transfer_group_id,
              coalesce((select sum(ar.lecture_count)
                        from attendance_records ar
                        where ar.allocation_id = a.id), 0)::text as total_lectures,
              coalesce((select sum(ar.lecture_count)
                        from attendance_records ar
                        where ar.allocation_id = a.id
                          and ar.bill_item_id is null), 0)::text as unbilled_lectures
       from allocations a
       join teachers t on t.id = a.teacher_id
       where a.transfer_group_id = $1
       order by a.started_at nulls first, a.created_at`,
      [groupId],
    );
  } else {
    // Single allocation with no transfer group
    rows = await query(
      `select a.id, a.teacher_id, t.name as teacher_name, t.type as teacher_type,
              a.allocation_type, a.rate, a.status,
              to_char(a.started_at, 'YYYY-MM-DD') as started_at,
              to_char(a.end_date,   'YYYY-MM-DD') as end_date,
              a.lecture_seq_offset,
              a.transfer_group_id,
              coalesce((select sum(ar.lecture_count)
                        from attendance_records ar
                        where ar.allocation_id = a.id), 0)::text as total_lectures,
              coalesce((select sum(ar.lecture_count)
                        from attendance_records ar
                        where ar.allocation_id = a.id
                          and ar.bill_item_id is null), 0)::text as unbilled_lectures
       from allocations a
       join teachers t on t.id = a.teacher_id
       where a.id = $1`,
      [anchorAllocId],
    );
  }

  // Fetch semesters for each allocation in one query and attach
  const allocIds = rows.map((r) => r.id);
  const semRows = await query<{
    allocation_id: string;
    semester_id: string;
    class_name: string;
    session: string;
    semester_number: number;
  }>(
    `select als.allocation_id, als.semester_id, cl.class_name, cl.session, s.semester_number
     from allocation_semesters als
     join semesters s on s.id = als.semester_id
     join classes cl on cl.id = s.class_id
     where als.allocation_id = any($1::uuid[])`,
    [allocIds],
  );
  const semMap = new Map<string, typeof semRows>();
  for (const sr of semRows) {
    if (!semMap.has(sr.allocation_id)) semMap.set(sr.allocation_id, []);
    semMap.get(sr.allocation_id)!.push(sr);
  }

  const history = rows.map((r) => {
    const localLectures = Math.round(Number(r.total_lectures));
    const fromLec = r.lecture_seq_offset + 1;
    const toLec   = r.lecture_seq_offset + localLectures;
    return {
      id:                 r.id,
      teacher_id:         r.teacher_id,
      teacher_name:       r.teacher_name,
      teacher_type:       r.teacher_type,
      allocation_type:    r.allocation_type,
      rate:               r.rate,
      status:             r.status,
      started_at:         r.started_at,
      end_date:           r.end_date,
      lecture_seq_offset: r.lecture_seq_offset,
      total_lectures:     localLectures,
      unbilled_lectures:  Math.round(Number(r.unbilled_lectures)),
      delivered_from:     localLectures > 0 ? fromLec : 0,
      delivered_to:       localLectures > 0 ? toLec   : 0,
      semesters:          semMap.get(r.id) ?? [],
    };
  });

  return NextResponse.json({ history });
}
