import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClient, query } from "@/lib/db";
import { requirePortalPermission } from "@/lib/portalPermissions";

const roles = ["admin", "assistant", "coordinator", "hod", "finance_manager"] as const;
const batches = ["Batch-1", "Batch-2", "Batch-3", "Batch-4", "Batch-5"] as const;

const createSlipSchema = z.object({
  student_name: z.string().trim().min(1).max(200),
  father_name: z.string().trim().min(1).max(200),
  program: z.string().trim().min(1).max(200),
  academic_year: z.coerce.number().int().min(2000).max(2100),
  batch: z.enum(batches),
  admission_fee: z.coerce.number().finite().min(0).max(9999999999),
  lat_fee: z.coerce.number().finite().min(0).max(9999999999),
  other_charges: z.coerce.number().finite().min(0).max(9999999999),
});

type SlipRow = {
  id: string;
  fid: string;
  student_name: string;
  father_name: string;
  program: string;
  academic_year: number;
  batch: (typeof batches)[number];
  admission_fee: string;
  lat_fee: string;
  other_charges: string;
  total_amount: string;
  generated_by_name: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const { response } = await requirePortalPermission("lat_slip", "view", ...roles);
  if (response) return response;

  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const values: unknown[] = [];
  const where = search
    ? `where l.fid::text = $1
        or l.student_name ilike '%' || $1 || '%'
        or l.father_name ilike '%' || $1 || '%'`
    : "";
  if (search) values.push(search);

  const [slips, counters] = await Promise.all([
    query<SlipRow>(
      `select l.id, l.fid::text, l.student_name, l.father_name, l.program,
              l.academic_year, l.batch, l.admission_fee::text, l.lat_fee::text,
              l.other_charges::text, l.total_amount::text, u.name as generated_by_name,
              l.created_at
       from lat_slips l
       left join users u on u.id = l.generated_by
       ${where}
       order by l.fid desc`,
      values,
    ),
    query<{ batch: (typeof batches)[number]; slip_count: string; revenue: string }>(
      `select batch, count(*)::text as slip_count, coalesce(sum(total_amount), 0)::text as revenue
       from lat_slips
       group by batch
       order by batch`,
    ),
  ]);

  const counterMap = new Map(counters.map((item) => [item.batch, item]));
  return NextResponse.json({
    slips,
    batch_counters: batches.map((batch) => ({
      batch,
      slip_count: Number(counterMap.get(batch)?.slip_count ?? 0),
      revenue: counterMap.get(batch)?.revenue ?? "0",
    })),
  });
}

export async function POST(request: NextRequest) {
  const { session, response } = await requirePortalPermission("lat_slip", "edit", ...roles);
  if (response || !session) return response;

  const parsed = createSlipSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid slip details." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const client = await getClient();
  try {
    await client.query("begin");
    const result = await client.query<SlipRow>(
      `with inserted as (
         insert into lat_slips (
           student_name, father_name, program, academic_year, batch,
           admission_fee, lat_fee, other_charges, generated_by
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning *
       )
       select i.id, i.fid::text, i.student_name, i.father_name, i.program,
              i.academic_year, i.batch, i.admission_fee::text, i.lat_fee::text,
              i.other_charges::text, i.total_amount::text, u.name as generated_by_name,
              i.created_at
       from inserted i
       left join users u on u.id = i.generated_by`,
      [
        data.student_name,
        data.father_name,
        data.program,
        data.academic_year,
        data.batch,
        data.admission_fee,
        data.lat_fee,
        data.other_charges,
        session.userId,
      ],
    );
    await client.query("commit");
    return NextResponse.json({ slip: result.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query("rollback");
    console.error("LAT slip generation failed:", error);
    return NextResponse.json({ error: "Unable to save the LAT slip." }, { status: 500 });
  } finally {
    client.release();
  }
}